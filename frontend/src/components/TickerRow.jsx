import React from 'react'
import { fmtCurr, fmtPct } from '../ui/utils'

export function TickerRow({ 
  ticker, 
  onUpdate, 
  onDelete, 
  onInvest, 
  onEdit, 
  onDetail,
  onShowEvolucion,
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
      
      <td style={{ ...cellStyle, textAlign: 'left' }}>
        <button
          onClick={() => onEdit?.(ticker)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--fg-secondary)',
            padding: '4px 8px',
            cursor: 'pointer',
            borderRadius: '4px',
            fontSize: '12px',
            textAlign: 'left',
            width: '100%',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = 'var(--bg-hover)'}
          onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          title="Click para editar tipo"
        >
          {ticker.tipo_inversion_nombre || '-'}
        </button>
      </td>
      
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
      <td style={{ ...cellStyle, textAlign: 'center' }}>
        <button
          onClick={() => onShowEvolucion?.(ticker)}
          className="btn btn-sm"
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          title="Ver evolución diaria"
        >
          Evolución
        </button>
      </td>
    </tr>
  )
}
