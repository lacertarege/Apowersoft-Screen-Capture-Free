import React from 'react'

export default function TWRMonthlyTable({ data, currency, onCurrencyChange }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', gap: '8px' }}>
          <button
            onClick={() => onCurrencyChange('USD')}
            className={`btn btn-sm ${currency === 'USD' ? 'btn-primary' : 'btn-outline-primary'}`}
            style={{ minWidth: '80px' }}
          >
            DÓLARES
          </button>
          <button
            onClick={() => onCurrencyChange('PEN')}
            className={`btn btn-sm ${currency === 'PEN' ? 'btn-primary' : 'btn-outline-primary'}`}
            style={{ minWidth: '80px' }}
          >
            SOLES
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '40px', color: '#999', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          Sin datos de evolución mensual para esta moneda
        </div>
      </div>
    )
  }

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '-'
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-PE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val)
  }

  const formatPercentage = (val) => {
    if (val === null || val === undefined) return '-'
    const sign = val >= 0 ? '+' : ''
    return `${sign}${val.toFixed(2)}%`
  }

  const getColorForValue = (val) => {
    if (val === null || val === undefined || val === 0) return '#6b7280'
    return val >= 0 ? '#10b981' : '#ef4444'
  }

  const formatMes = (mesStr) => {
    if (!mesStr) return '---'
    const [year, month] = mesStr.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    const mesNombre = date.toLocaleDateString('es-PE', { month: 'short' })
    return `${year}-${String(month).padStart(2, '0')} (${mesNombre})`
  }

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Selector de Moneda (Pestañas) */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '20px',
        gap: '2px',
        backgroundColor: '#f1f5f9',
        padding: '4px',
        borderRadius: '8px',
        width: 'fit-content',
        margin: '0 auto 20px auto'
      }}>
        <button
          onClick={() => onCurrencyChange('USD')}
          style={{
            padding: '8px 24px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: currency === 'USD' ? '#ffffff' : 'transparent',
            color: currency === 'USD' ? '#0ea5e9' : '#64748b',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: currency === 'USD' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          DÓLARES (USD)
        </button>
        <button
          onClick={() => onCurrencyChange('PEN')}
          style={{
            padding: '8px 24px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: currency === 'PEN' ? '#ffffff' : 'transparent',
            color: currency === 'PEN' ? '#0ea5e9' : '#64748b',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: currency === 'PEN' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          SOLES (PEN)
        </button>
      </div>

      <div style={{
        overflowX: 'auto',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        backgroundColor: '#ffffff'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={headerStyle}>AÑO-MES</th>
              <th style={headerRightStyle}>VALOR INICIAL (Vi)</th>
              <th style={headerRightStyle}>APORTES (F)</th>
              <th style={headerRightStyle}>VALOR FINAL (Vf)</th>
              <th style={headerRightStyle}>REND. (Rm)</th>
              <th style={headerRightStyle}>% RENT. (Rn)</th>
              <th style={{ ...headerRightStyle, color: '#0ea5e9' }}>RENT. ACUM (Rna)</th>
            </tr>
          </thead>
          <tbody>
            {data.slice().reverse().map((item, index) => {
              const isJanuary = item.mes.endsWith('-01')

              return (
                <tr
                  key={item.mes}
                  style={{
                    borderBottom: isJanuary ? '2px solid #e2e8f0' : '1px solid #f1f5f9',
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#fcfdfe'
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b' }}>
                    {item.mes}
                  </td>
                  <td style={cellRightStyle}>
                    {formatCurrency(item.valorInicial)}
                  </td>
                  <td style={{ ...cellRightStyle, color: item.aportes > 0 ? '#0ea5e9' : '#64748b' }}>
                    {formatCurrency(item.aportes)}
                  </td>
                  <td style={{ ...cellRightStyle, fontWeight: '600', color: '#1e293b' }}>
                    {formatCurrency(item.valorFinal)}
                  </td>
                  <td style={{ ...cellRightStyle, color: getColorForValue(item.rendimiento), fontWeight: '600' }}>
                    {formatCurrency(item.rendimiento)}
                  </td>
                  <td style={{ ...cellRightStyle, color: getColorForValue(item.rentabilidad), fontWeight: '600' }}>
                    {formatPercentage(item.rentabilidad)}
                  </td>
                  <td style={{
                    ...cellRightStyle,
                    color: getColorForValue(item.rentabilidadAcumulada),
                    fontWeight: '700',
                    backgroundColor: index % 2 === 0 ? 'rgba(14, 165, 233, 0.02)' : 'rgba(14, 165, 233, 0.04)'
                  }}>
                    {formatPercentage(item.rentabilidadAcumulada)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const headerStyle = {
  padding: '14px 16px',
  textAlign: 'left',
  fontWeight: '700',
  color: '#475569',
  whiteSpace: 'nowrap',
  textTransform: 'uppercase',
  fontSize: '11px',
  letterSpacing: '0.5px'
}

const headerRightStyle = {
  ...headerStyle,
  textAlign: 'right'
}

const cellRightStyle = {
  padding: '12px 16px',
  textAlign: 'right',
  color: '#475569'
}

