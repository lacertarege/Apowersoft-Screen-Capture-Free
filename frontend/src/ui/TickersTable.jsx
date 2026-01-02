import React from 'react'
import { fmtCurr, fmtPct, fmtDateLima } from './utils'
import NumberCell from './NumberCell.jsx'
import { TickerRow } from '../components/TickerRow.jsx'

export default function TickersTable({ items, onDelete, onOpenInvest, onOpenDetail, onUpdatePrice, onEdit, refreshingMap = {}, onShowEvolucion }){
  const [empresasSortField, setEmpresasSortField] = React.useState('ticker')
  const [empresasSortOrder, setEmpresasSortOrder] = React.useState('asc')

  const handleEmpresasSort = (field) => {
    if (empresasSortField === field){
      setEmpresasSortOrder(empresasSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setEmpresasSortField(field); setEmpresasSortOrder('asc')
    }
  }
  const getEmpresasSortIcon = (field) => {
    if (empresasSortField !== field) return ''
    return empresasSortOrder === 'asc' ? ' ↑' : ' ↓'
  }

  const sortedItems = React.useMemo(()=>{
    const arr = [...items]
    arr.sort((a,b)=>{
      const dir = empresasSortOrder === 'asc' ? 1 : -1
      const num = (v)=> Number(v) || 0
      const str = (v)=> String(v||'').toLowerCase()
      let av, bv
      switch (empresasSortField){
        case 'ticker': av = str(a.ticker); bv = str(b.ticker); break
        case 'nombre': av = str(a.nombre); bv = str(b.nombre); break
        case 'tipo_inversion_nombre': av = str(a.tipo_inversion_nombre || ''); bv = str(b.tipo_inversion_nombre || ''); break
        case 'precio_reciente': av = num(a.precio_reciente); bv = num(b.precio_reciente); break
        case 'importe_total': av = num(a.importe_total); bv = num(b.importe_total); break
        case 'cantidad_total': av = num(a.cantidad_total); bv = num(b.cantidad_total); break
        case 'costo_promedio': {
          const ac = (num(a.importe_total) && num(a.cantidad_total)) ? (num(a.importe_total)/num(a.cantidad_total)) : 0
          const bc = (num(b.importe_total) && num(b.cantidad_total)) ? (num(b.importe_total)/num(b.cantidad_total)) : 0
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
          const ap = ad ? ((num(a.precio_reciente) * num(a.cantidad_total) - ad)/ad) : 0
          const bp = bd ? ((num(b.precio_reciente) * num(b.cantidad_total) - bd)/bd) : 0
          av = ap; bv = bp
          break
        }
        default: av = 0; bv = 0
      }
      if (av === bv) return 0
      return av > bv ? dir : -dir
    })
    return arr
  }, [items, empresasSortField, empresasSortOrder])

  return (
    <div className="card">
      <h3 className="card-title">Empresas</h3>
      <div style={{overflowX: 'auto', marginTop: '8px'}}>
        <table style={{fontSize: '13px', minWidth: '1060px', width: '100%'}}>
          <colgroup>
            <col style={{width: '65px'}} />
            <col style={{minWidth: '150px'}} />
            <col style={{width: '120px'}} />
            <col style={{width: '105px'}} />
            <col style={{width: '105px'}} />
            <col style={{width: '75px'}} />
            <col style={{width: '105px'}} />
            <col style={{width: '105px'}} />
            <col style={{width: '85px'}} />
            <col style={{width: '100px'}} />
          </colgroup>
          <thead>
            <tr>
              <th style={{cursor:'pointer', textAlign:'left', whiteSpace:'nowrap', padding:'8px 6px'}} onClick={()=>handleEmpresasSort('ticker')}>Ticker{getEmpresasSortIcon('ticker')}</th>
              <th style={{cursor:'pointer', textAlign:'left', padding:'8px 6px'}} onClick={()=>handleEmpresasSort('nombre')}>Nombre{getEmpresasSortIcon('nombre')}</th>
              <th style={{cursor:'pointer', textAlign:'left', whiteSpace:'nowrap', padding:'8px 6px'}} onClick={()=>handleEmpresasSort('tipo_inversion_nombre')}>Tipo{getEmpresasSortIcon('tipo_inversion_nombre')}</th>
              <th style={{cursor:'pointer', whiteSpace:'nowrap', padding:'8px 6px'}} onClick={()=>handleEmpresasSort('precio_reciente')}>Precio{getEmpresasSortIcon('precio_reciente')}</th>
              <th style={{cursor:'pointer', whiteSpace:'nowrap', padding:'8px 6px'}} onClick={()=>handleEmpresasSort('importe_total')}>Inversión{getEmpresasSortIcon('importe_total')}</th>
              <th style={{cursor:'pointer', whiteSpace:'nowrap', padding:'8px 6px'}} onClick={()=>handleEmpresasSort('cantidad_total')}>Cant.{getEmpresasSortIcon('cantidad_total')}</th>
              <th style={{cursor:'pointer', whiteSpace:'nowrap', padding:'8px 6px'}} onClick={()=>handleEmpresasSort('costo_promedio')}>C. Prom.{getEmpresasSortIcon('costo_promedio')}</th>
              <th style={{cursor:'pointer', whiteSpace:'nowrap', padding:'8px 6px'}} onClick={()=>handleEmpresasSort('valor_actual')}>Valor{getEmpresasSortIcon('valor_actual')}</th>
              <th style={{cursor:'pointer', whiteSpace:'nowrap', padding:'8px 6px'}} onClick={()=>handleEmpresasSort('rendimiento')}>Rendim.{getEmpresasSortIcon('rendimiento')}</th>
              <th style={{cursor:'pointer', whiteSpace:'nowrap', padding:'8px 6px'}} onClick={()=>handleEmpresasSort('rentabilidad')}>Rentab.{getEmpresasSortIcon('rentabilidad')}</th>
              <th style={{padding:'8px 6px', textAlign:'center'}}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map(it => (
              <TickerRow
                key={it.id}
                ticker={it}
                onUpdate={onUpdatePrice}
                onDelete={onDelete}
                onInvest={onOpenInvest}
                onEdit={onEdit}
                onDetail={onOpenDetail}
                onShowEvolucion={onShowEvolucion}
                refreshing={refreshingMap[it.id] || false}
              />
            ))}
          </tbody>
          <tbody><tr><td colSpan="11" style={{height:0,padding:0,borderBottom:'2px solid var(--border)'}}></td></tr></tbody>
        </table>
      </div>
    </div>
  )
}