import React from 'react'
import { fmtCurr, fmtPct } from '../ui/utils'

// Helper function to get investment type icon
function getInvestmentTypeIcon(tipo) {
  const lower = String(tipo || '').toLowerCase()
  if (lower.includes('accion') || lower.includes('acciones')) return '📈'
  if (lower.includes('fondo') || lower.includes('mutu')) return '🏢'
  if (lower.includes('etf')) return '💰'
  return '📊' // Default for other types
}

export function TickerRow({
  ticker,
  onUpdate,
  onDelete,
  onInvest,
  onDesinvest,
  onEdit,
  onDetail,
  onShowEvolucion,
  refreshing = false,
  totalPortfolioValue = 1,
  rowIndex = 0
}) {
  const [showContextMenu, setShowContextMenu] = React.useState(false)
  const menuRef = React.useRef(null)

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowContextMenu(false)
      }
    }
    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showContextMenu])

  const cellStyle = { padding: '8px 6px', whiteSpace: 'nowrap' }

  // Calculate portfolio percentage
  const portfolioPercentage = totalPortfolioValue > 0
    ? ((Number(ticker.balance) || 0) / totalPortfolioValue) * 100
    : 0

  // Zebra striping
  const rowBackground = rowIndex % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'

  // Calculate values for tooltip
  const costoPromedio = ticker.cantidad_total && ticker.importe_total
    ? ticker.importe_total / ticker.cantidad_total
    : 0

  // Dividends (for display in tooltip only)
  const totalDividends = Number(ticker.total_dividends || 0)

  // Total Return - Backend already calculates: unrealizedGain + realizedGain + dividends
  // Do NOT add dividends again here!
  const totalReturn = Number(ticker.rendimiento || 0)

  // Total ROI %
  const invested = Number(ticker.importe_total || 0)
  const totalRoi = invested !== 0 ? (totalReturn / invested) : 0

  const rentabilidad = totalRoi * 100
  const rentabilidadColor = totalReturn >= 0 ? '#10b981' : '#ef4444'
  const rentabilidadSign = totalReturn >= 0 ? '+' : ''
  const rentabilidadText = `${rentabilidadSign}${fmtCurr(totalReturn, ticker.moneda)} (${rentabilidadSign}${fmtPct(totalRoi)})`

  // Calculate unrealized gain for tooltip (Value - Investment Cost)
  const unrealizedGain = (Number(ticker.balance || 0)) - invested

  // Tooltip content - show breakdown
  const tooltipContent = `Capital Invertido: ${fmtCurr(invested, ticker.moneda)}
Ganancia No Realizada: ${fmtCurr(unrealizedGain, ticker.moneda)}
Dividendos: ${fmtCurr(totalDividends, ticker.moneda)}
─────────────────
Retorno Total: ${fmtCurr(totalReturn, ticker.moneda)}`

  return (
    <tr style={{
      backgroundColor: rowBackground,
      transition: 'background-color 0.15s ease'
    }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rowBackground}
    >
      {/* ACTIVO Column (Ticker + Nombre + Icon) */}
      <td style={{ ...cellStyle, textAlign: 'left', paddingLeft: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px' }} title={ticker.tipo_inversion_nombre || 'Sin tipo'}>
            {getInvestmentTypeIcon(ticker.tipo_inversion_nombre)}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => onDetail?.(ticker)}
              style={{
                background: 'rgba(0,0,0,0.03)',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: '4px',
                padding: '2px 6px',
                cursor: 'pointer',
                textAlign: 'center',
                width: 'fit-content'
              }}
              aria-label={`Ver detalles de ${ticker.ticker}`}
            >
              <code style={{ color: '#0f172a', fontSize: '12px', fontWeight: '700', fontFamily: 'Roboto Mono, monospace' }}>{ticker.ticker}</code>
            </button>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ticker.nombre}
            </span>
          </div>
        </div>
      </td>

      {/* PRECIO */}
      <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'Roboto Mono, monospace' }}>
        {fmtCurr(ticker.precio_reciente, ticker.moneda)}
      </td>

      {/* CANTIDAD */}
      <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'Roboto Mono, monospace' }}>
        {ticker.cantidad_total?.toFixed?.(2)}
      </td>

      {/* VALOR (Market Value / Balance) */}
      <td style={{ ...cellStyle, textAlign: 'right', fontWeight: '500', fontFamily: 'Roboto Mono, monospace' }}>
        {fmtCurr(ticker.balance || 0, ticker.moneda)}
      </td>

      {/* RENTABILIDAD (Merged: Amount + Percentage with Tooltip + Visual Bar) */}
      <td
        style={{
          ...cellStyle,
          textAlign: 'right',
          color: rentabilidadColor,
          fontWeight: '500',
          cursor: 'help',
          fontFamily: 'Roboto Mono, monospace'
        }}
        title={tooltipContent}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span>{rentabilidadText}</span>
          {/* Visual Bar for Rentability Magnitude */}
          <div style={{
            height: '4px',
            width: `${Math.min(Math.abs(rentabilidad), 100)}%`, // Cap at 100% width visually
            backgroundColor: rentabilidad >= 0 ? '#22c55e' : '#ef4444',
            opacity: 0.3,
            borderRadius: '2px'
          }} />
        </div>
      </td>

      {/* % PORTAFOLIO */}
      <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'Roboto Mono, monospace' }}>
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }} title={`Participación exacta: ${portfolioPercentage.toFixed(2)}%`}>
          {/* Background progress bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${Math.min(portfolioPercentage, 100)}%`,
            backgroundColor: portfolioPercentage > 20 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.1)', // Red tint if high concentration
            borderRadius: '2px',
            zIndex: 0
          }} />
          {/* Percentage text */}
          <span style={{ position: 'relative', zIndex: 1, color: portfolioPercentage > 20 ? '#b91c1c' : 'inherit', fontWeight: portfolioPercentage > 20 ? '700' : 'normal' }}>
            {portfolioPercentage > 20 && <span style={{ marginRight: '4px' }}>⚠️</span>}
            {portfolioPercentage.toFixed(1)}%
          </span>
        </div>
      </td>

      {/* ACCIÓN (Context Menu) */}
      <td style={{ ...cellStyle, textAlign: 'center', position: 'relative' }}>
        <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={() => setShowContextMenu(!showContextMenu)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: '1',
              color: 'var(--fg-primary)',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'var(--bg-hover)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
            title="Opciones"
          >
            ⋮
          </button>

          {showContextMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              background: 'var(--bg-primary, white)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: '160px',
              overflow: 'hidden'
            }}>
              <button
                onClick={() => { onInvest?.(ticker); setShowContextMenu(false) }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.15s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = 'var(--bg-hover, #f3f4f6)'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <span>➕</span> Nueva Inversión
              </button>
              <button
                onClick={() => { onDesinvest?.(ticker); setShowContextMenu(false) }}
                disabled={!ticker.cantidad_total || ticker.cantidad_total <= 0}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: ticker.cantidad_total > 0 ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: ticker.cantidad_total > 0 ? 1 : 0.5,
                  transition: 'background-color 0.15s'
                }}
                onMouseOver={(e) => { if (ticker.cantidad_total > 0) e.target.style.backgroundColor = 'var(--bg-hover, #f3f4f6)' }}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                title={ticker.cantidad_total > 0 ? "Registrar desinversión" : "Sin stock disponible"}
              >
                <span>➖</span> Desinversión
              </button>
              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
              <button
                onClick={() => { onShowEvolucion?.(ticker); setShowContextMenu(false) }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.15s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = 'var(--bg-hover, #f3f4f6)'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <span>📊</span> Ver Evolución
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
