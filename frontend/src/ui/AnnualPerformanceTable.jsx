import React from 'react'

export default function AnnualPerformanceTable({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{textAlign:'center', padding:'40px', color:'#999'}}>
        Sin datos de performance anual
      </div>
    )
  }

  const formatPercentage = (val) => {
    if (val === null || val === undefined) return '-'
    const sign = val >= 0 ? '+' : ''
    return `${sign}${val.toFixed(2)}%`
  }

  const formatDiferencia = (val) => {
    if (val === null || val === undefined) return '-'
    const sign = val >= 0 ? '+' : ''
    return `${sign}${val.toFixed(2)}%`
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        fontSize: '14px'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ 
              padding: '12px 16px', 
              textAlign: 'left', 
              fontWeight: '600',
              color: '#374151'
            }}>
              Año
            </th>
            <th style={{ 
              padding: '12px 16px', 
              textAlign: 'right', 
              fontWeight: '600',
              color: '#374151'
            }}>
              Mi Performance
            </th>
            <th style={{ 
              padding: '12px 16px', 
              textAlign: 'right', 
              fontWeight: '600',
              color: '#374151'
            }}>
              S&P 500
            </th>
            <th style={{ 
              padding: '12px 16px', 
              textAlign: 'right', 
              fontWeight: '600',
              color: '#374151'
            }}>
              Diferencia
            </th>
            <th style={{ 
              padding: '12px 16px', 
              textAlign: 'center', 
              fontWeight: '600',
              color: '#374151'
            }}>
              Resultado
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const isPositive = item.performancePortfolio >= 0
            const batiendo = item.batiendoSP500 === true
            const perdiendo = item.batiendoSP500 === false
            
            return (
              <tr 
                key={item.anio}
                style={{ 
                  backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                  borderBottom: index < data.length - 1 ? '1px solid #f3f4f6' : 'none'
                }}
              >
                <td style={{ 
                  padding: '12px 16px', 
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  {item.anio}
                </td>
                <td style={{ 
                  padding: '12px 16px', 
                  textAlign: 'right',
                  color: isPositive ? '#10b981' : '#ef4444',
                  fontWeight: '600'
                }}>
                  {formatPercentage(item.performancePortfolio)}
                </td>
                <td style={{ 
                  padding: '12px 16px', 
                  textAlign: 'right',
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  {item.performanceSP500 !== null ? formatPercentage(item.performanceSP500) : '-'}
                </td>
                <td style={{ 
                  padding: '12px 16px', 
                  textAlign: 'right',
                  color: item.diferencia !== null 
                    ? (item.diferencia >= 0 ? '#10b981' : '#ef4444')
                    : '#6b7280',
                  fontWeight: '600'
                }}>
                  {formatDiferencia(item.diferencia)}
                </td>
                <td style={{ 
                  padding: '12px 16px', 
                  textAlign: 'center'
                }}>
                  {item.batiendoSP500 !== null ? (
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: batiendo ? '#d1fae5' : '#fee2e2',
                      color: batiendo ? '#065f46' : '#991b1b'
                    }}>
                      {batiendo ? '✓ Batió' : '✗ No batió'}
                    </span>
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>-</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

