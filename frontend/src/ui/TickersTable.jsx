import React from 'react'
import { fmtCurr, fmtPct, fmtDateLima } from './utils'
import NumberCell from './NumberCell.jsx'
import { TickerRow } from '../components/TickerRow.jsx'

export default function TickersTable({ items, currency = 'PEN', onDelete, onOpenInvest, onOpenDesinvest, onOpenDetail, onUpdatePrice, onEdit, refreshingMap = {}, onShowEvolucion, showClosed = false }) {
  const [empresasSortField, setEmpresasSortField] = React.useState('ticker')
  const [empresasSortOrder, setEmpresasSortOrder] = React.useState('asc')

  const handleEmpresasSort = (field) => {
    if (empresasSortField === field) {
      setEmpresasSortOrder(empresasSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setEmpresasSortField(field); setEmpresasSortOrder('asc')
    }
  }
  const getEmpresasSortIcon = (field) => {
    if (empresasSortField !== field) return ''
    return empresasSortOrder === 'asc' ? ' ↑' : ' ↓'
  }

  const sortedItems = React.useMemo(() => {
    // Filter out closed positions if showClosed is false
    let arr = showClosed ? [...items] : items.filter(item => item.cantidad_total > 0)

    arr.sort((a, b) => {
      const dir = empresasSortOrder === 'asc' ? 1 : -1
      const num = (v) => Number(v) || 0
      const str = (v) => String(v || '').toLowerCase()
      let av, bv
      switch (empresasSortField) {
        case 'ticker': av = str(a.ticker); bv = str(b.ticker); break
        case 'nombre': av = str(a.nombre); bv = str(b.nombre); break
        case 'tipo_inversion_nombre': av = str(a.tipo_inversion_nombre || ''); bv = str(b.tipo_inversion_nombre || ''); break
        case 'precio_reciente': av = num(a.precio_reciente); bv = num(b.precio_reciente); break
        case 'importe_total': av = num(a.importe_total); bv = num(b.importe_total); break
        case 'cantidad_total': av = num(a.cantidad_total); bv = num(b.cantidad_total); break
        case 'costo_promedio': {
          const ac = (num(a.importe_total) && num(a.cantidad_total)) ? (num(a.importe_total) / num(a.cantidad_total)) : 0
          const bc = (num(b.importe_total) && num(b.cantidad_total)) ? (num(b.importe_total) / num(b.cantidad_total)) : 0
          av = ac; bv = bc
          break
        }
        case 'valor_actual': {
          const ap = num(a.precio_reciente) * num(a.cantidad_total)
          const bp = num(b.precio_reciente) * num(b.cantidad_total)
          av = ap; bv = bp
          break
        }
        case 'rendimiento': {
          const ap = num(a.precio_reciente) * num(a.cantidad_total) - num(a.importe_total)
          const bp = num(b.precio_reciente) * num(b.cantidad_total) - num(b.importe_total)
          av = ap; bv = bp
          break
        }
        case 'rentabilidad': {
          const ad = num(a.importe_total); const bd = num(b.importe_total)
          const ap = ad ? ((num(a.precio_reciente) * num(a.cantidad_total) - ad) / ad) : 0
          const bp = bd ? ((num(b.precio_reciente) * num(b.cantidad_total) - bd) / bd) : 0
          av = ap; bv = bp
          break
        }
        case 'portfolio_percentage': {
          // Sort by portfolio percentage (balance)
          av = num(a.balance); bv = num(b.balance)
          break
        }
        case 'pais': av = str(a.pais); bv = str(b.pais); break
        case 'sector_nombre': av = str(a.sector_nombre); bv = str(b.sector_nombre); break
        default: av = 0; bv = 0
      }
      if (av === bv) return 0
      return av > bv ? dir : -dir
    })
    return arr
  }, [items, empresasSortField, empresasSortOrder, showClosed])

  // Calculate total portfolio value for percentage calculations
  const totalPortfolioValue = React.useMemo(() => {
    return sortedItems.reduce((sum, item) => sum + (Number(item.balance) || 0), 0)
  }, [sortedItems])

  // Calculate totals for Summary Card
  const summary = React.useMemo(() => {
    return items.reduce((acc, item) => {
      // Filter for active positions only
      if ((Number(item.cantidad_total) || 0) > 0.000001) {
        acc.invested += Number(item.importe_total) || 0
        acc.value += Number(item.balance) || 0
        acc.return += Number(item.rendimiento) || 0
      }
      return acc
    }, { invested: 0, value: 0, return: 0 })
  }, [items])

  const totalRentability = summary.invested ? (summary.return / summary.invested) * 100 : 0

  return (
    <div className="card">
      <div style={{ marginBottom: '20px' }}>
        <h3 className="card-title" style={{ marginBottom: '16px' }}>Empresas</h3>

        {/* Fintech Summary Card */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          backgroundColor: '#f8fafc',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Invertido</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'Roboto Mono, monospace' }}>{fmtCurr(summary.invested, currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Valor Actual</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'Roboto Mono, monospace' }}>{fmtCurr(summary.value, currency)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Rendimiento</div>
            <div style={{
              fontSize: '20px',
              fontWeight: 'bold',
              fontFamily: 'Roboto Mono, monospace',
              color: summary.return >= 0 ? '#22c55e' : '#ef4444'
            }}>
              {summary.return >= 0 ? '+' : ''}{fmtCurr(summary.return, currency)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Rentabilidad</div>
            <div style={{
              fontSize: '20px',
              fontWeight: 'bold',
              fontFamily: 'Roboto Mono, monospace',
              color: totalRentability >= 0 ? '#22c55e' : '#ef4444'
            }}>
              {totalRentability >= 0 ? '+' : ''}{totalRentability.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>


      <div style={{ overflowX: 'auto', marginTop: '8px' }}>
        <table style={{ fontSize: '13px', minWidth: '900px', width: '100%', borderCollapse: 'collapse' }}>
          <colgroup>
            <col style={{ minWidth: '80px' }} /><col style={{ width: '80px' }} /><col style={{ width: '120px' }} /><col style={{ width: '105px' }} /><col style={{ width: '85px' }} /><col style={{ width: '105px' }} /><col style={{ width: '150px' }} /><col style={{ width: '60px' }} /><col style={{ width: '7%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', padding: '8px 6px', paddingLeft: '8px' }} onClick={() => handleEmpresasSort('ticker')}>Activo{getEmpresasSortIcon('ticker')}</th>
              <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '8px 6px', textAlign: 'center' }} onClick={() => handleEmpresasSort('pais')}>País{getEmpresasSortIcon('pais')}</th>
              <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '8px 6px', textAlign: 'left' }} onClick={() => handleEmpresasSort('sector_nombre')}>Sector{getEmpresasSortIcon('sector_nombre')}</th>
              <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '8px 6px', textAlign: 'right' }} onClick={() => handleEmpresasSort('precio_reciente')}>Precio{getEmpresasSortIcon('precio_reciente')}</th>
              <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '8px 6px', textAlign: 'right' }} onClick={() => handleEmpresasSort('cantidad_total')}>Cant.{getEmpresasSortIcon('cantidad_total')}</th>
              <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '8px 6px', textAlign: 'right' }} onClick={() => handleEmpresasSort('valor_actual')}>Valor{getEmpresasSortIcon('valor_actual')}</th>
              <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '8px 6px', textAlign: 'right' }} onClick={() => handleEmpresasSort('rentabilidad')}>Rentabilidad{getEmpresasSortIcon('rentabilidad')}</th>
              <th style={{ cursor: 'pointer', whiteSpace: 'nowrap', padding: '8px 6px', textAlign: 'right' }} onClick={() => handleEmpresasSort('portfolio_percentage')}>% Portaf.{getEmpresasSortIcon('portfolio_percentage')}</th>
              <th style={{ padding: '8px 6px', textAlign: 'center' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((it, index) => (
              <TickerRow
                key={it.id}
                ticker={it}
                onUpdate={onUpdatePrice}
                onDelete={onDelete}
                onInvest={onOpenInvest}
                onDesinvest={onOpenDesinvest}
                onEdit={onEdit}
                onDetail={onOpenDetail}
                onShowEvolucion={onShowEvolucion}
                refreshing={refreshingMap[it.id] || false}
                totalPortfolioValue={totalPortfolioValue}
                rowIndex={index}
              />
            ))}
          </tbody>
          <tbody><tr><td colSpan="8" style={{ height: 0, padding: 0, borderBottom: '2px solid var(--border)' }}></td></tr></tbody>
        </table>
      </div>
    </div>
  )
}