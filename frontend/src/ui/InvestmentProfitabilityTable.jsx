import React, { useState, useMemo } from 'react'

export default function InvestmentProfitabilityTable({ data, currency, onCurrencyChange }) {
  const [sortField, setSortField] = useState('fecha')
  const [sortDirection, setSortDirection] = useState('desc')
  const [page, setPage] = useState(1)
  const itemsPerPage = 15

  // Formatear fecha sin desplazamiento de zona horaria
  const formatDateStr = (dateStr) => {
    if (!dateStr) return '---'
    const [year, month, day] = dateStr.split('-')
    return `${day}.${month}.${year.slice(-2)}`
  }

  // Formatear valores según moneda
  const formatValue = (val) => {
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-PE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val)
  }

  const formatPercentage = (val) => {
    const num = Number(val)
    const sign = num > 0 ? '+' : ''
    return `${sign}${num.toFixed(2)}%`
  }

  const getColorForValue = (val) => {
    if (val > 0) return '#10b981'
    if (val < 0) return '#ef4444'
    return '#64748b'
  }

  // Ordenar datos
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return []

    return [...data].sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      if (sortField === 'fecha') {
        aVal = new Date(aVal)
        bVal = new Date(bVal)
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })
  }, [data, sortField, sortDirection])

  // Paginar datos
  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage
    return sortedData.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedData, page])

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    setPage(1)
  }

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕️'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

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
          Sin datos de evolución para esta moneda
        </div>
      </div>
    )
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
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        fontSize: '13px',
        color: '#64748b'
      }}>
        <div>
          Mostrando <strong>{((page - 1) * itemsPerPage) + 1} - {Math.min(page * itemsPerPage, sortedData.length)}</strong> de {sortedData.length} registros
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{
              padding: '4px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              background: 'white',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              opacity: page === 1 ? 0.5 : 1
            }}
          >
            Anterior
          </button>
          <span style={{ fontWeight: '500' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{
              padding: '4px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              background: 'white',
              cursor: page === totalPages ? 'not-allowed' : 'pointer',
              opacity: page === totalPages ? 0.5 : 1
            }}
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Tabla Principal */}
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
              <th onClick={() => handleSort('fecha')} style={headerStyle}>
                FECHA (D) {getSortIcon('fecha')}
              </th>
              <th onClick={() => handleSort('valorInicial')} style={headerRightStyle}>
                VALOR INICIAL (Vi) {getSortIcon('valorInicial')}
              </th>
              <th onClick={() => handleSort('aportes')} style={headerRightStyle}>
                APORTES (F) {getSortIcon('aportes')}
              </th>
              <th onClick={() => handleSort('valorFinal')} style={headerRightStyle}>
                VALOR FINAL (Vf) {getSortIcon('valorFinal')}
              </th>
              <th onClick={() => handleSort('rendimiento')} style={headerRightStyle}>
                REND. (Rm) {getSortIcon('rendimiento')}
              </th>
              <th onClick={() => handleSort('rentabilidad')} style={headerRightStyle}>
                % RENT. (Rn) {getSortIcon('rentabilidad')}
              </th>
              <th onClick={() => handleSort('rentabilidadAcumulada')} style={{ ...headerRightStyle, color: '#0ea5e9' }}>
                RENT. ACUM (Rna) {getSortIcon('rentabilidadAcumulada')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item, index) => {
              return (
                <tr
                  key={item.fecha}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#fcfdfe'
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b' }}>
                    {formatDateStr(item.fecha)}
                  </td>
                  <td style={cellRightStyle}>
                    {formatValue(item.valorInicial)}
                  </td>
                  <td style={{ ...cellRightStyle, color: item.aportes > 0 ? '#0ea5e9' : '#64748b' }}>
                    {formatValue(item.aportes)}
                  </td>
                  <td style={{ ...cellRightStyle, fontWeight: '600', color: '#1e293b' }}>
                    {formatValue(item.valorFinal)}
                  </td>
                  <td style={{ ...cellRightStyle, color: getColorForValue(item.rendimiento), fontWeight: '600' }}>
                    {formatValue(item.rendimiento)}
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
  cursor: 'pointer',
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
