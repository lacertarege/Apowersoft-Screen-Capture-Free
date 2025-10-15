import React from 'react'
import { fmtCurr, fmtPct } from '../ui/utils'

export function TickerRow({ 
  ticker, 
  onUpdate, 
  onDelete, 
  onInvest, 
  onEdit, 
  onDetail,
  refreshing = false 
}) {
  const cellStyle = { padding: '8px 6px', whiteSpace: 'nowrap' }
  
  return (
    <tr>
      <td style={{...cellStyle, textAlign: 'left'}}>
          <button 
            onClick={() => onDetail?.(ticker)} 
            style={{
              background: 'none',
              border: 'none',
              color: '#2563eb',
              padding: 0,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
            aria-label={`Ver detalles de ${ticker.ticker} - ${ticker.nombre}`}
            role="button"
          >
            <code style={{ color: 'inherit', fontSize: '12px', fontWeight: '600' }}>{ticker.ticker}</code>
          </button>
      </td>
      <td style={{...cellStyle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px'}} title={ticker.nombre}>{ticker.nombre}</td>
      
      <td style={{ ...cellStyle, textAlign: 'right' }}>
        {ticker.precio_reciente != null ? fmtCurr(ticker.precio_reciente, ticker.moneda) : '-'}
      </td>
      
      <td style={{ ...cellStyle, textAlign: 'right' }}>
        {fmtCurr(ticker.importe_total, ticker.moneda)}
      </td>
      
      <td style={{ ...cellStyle, textAlign: 'right' }}>
        {ticker.cantidad_total?.toFixed?.(2) ?? '-'}
      </td>
      
      <td style={{ ...cellStyle, textAlign: 'right' }}>
        {ticker.cantidad_total && ticker.importe_total 
          ? fmtCurr(ticker.importe_total / ticker.cantidad_total, ticker.moneda) 
          : '-'
        }
      </td>
      
      <td style={{ ...cellStyle, textAlign: 'right' }}>
        {fmtCurr(ticker.balance || 0, ticker.moneda)}
      </td>
      
      <td style={{ 
        ...cellStyle,
        textAlign: 'right', 
        color: (ticker.rendimiento || 0) > 0 ? 'green' : ((ticker.rendimiento || 0) < 0 ? 'red' : 'inherit')
      }}>
        {fmtCurr(ticker.rendimiento || 0, ticker.moneda)}
      </td>
      
      <td style={{ 
        ...cellStyle,
        textAlign: 'right', 
        color: (ticker.rentabilidad || 0) > 0 ? 'green' : ((ticker.rentabilidad || 0) < 0 ? 'red' : 'inherit')
      }}>
        {fmtPct(ticker.rentabilidad || 0)}
      </td>
    </tr>
  )
}
