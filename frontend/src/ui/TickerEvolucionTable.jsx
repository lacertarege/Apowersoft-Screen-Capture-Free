import React, { useState, useEffect } from 'react'
import { API } from './config'
import { fmtDateLima } from './utils'

export default function TickerEvolucionTable({ tickerId, isModal = false }) {
  const [data, setData] = useState([])
  const [moneda, setMoneda] = useState('USD') // Default to USD
  const [loading, setLoading] = useState(false)
  const [tickerInfo, setTickerInfo] = useState(null)

  useEffect(() => {
    if (!tickerId) return

    const cargarEvolucion = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API}/tickers/${tickerId}/evolucion`)
        const result = await response.json()

        // Assuming the API returns data in chronological order (oldest first)
        // Reverse to show newest first, as per instruction.
        setData((result.items || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)))

        if (result.ticker) {
          setMoneda(result.ticker.moneda)
          setTickerInfo(result.ticker)
        }
      } catch (error) {
        console.error('Error cargando evolución:', error)
      } finally {
        setLoading(false)
      }
    }

    cargarEvolucion()
  }, [tickerId])

  if (!tickerId) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-muted" style={{ padding: '20px', textAlign: 'center' }}>
          Selecciona un ticker para ver su evolución
        </div>
      </div>
    )
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: moneda === 'PEN' ? 'PEN' : 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val)
  }

  const formatPercentage = (val) => {
    const sign = val >= 0 ? '+' : ''
    return `${sign}${val.toFixed(2)}%`
  }

  const formatDateStr = (dateStr) => {
    if (!dateStr) return '---'
    const [year, month, day] = dateStr.split('-')
    return `${day}.${month}.${year.slice(-2)}`
  }

  const getColorForValue = (val) => {
    if (val === 0) return '#6b7280'
    return val > 0 ? '#10b981' : '#ef4444'
  }

  return (
    <div className={isModal ? "" : "card"} style={{
      marginTop: isModal ? 0 : 12,
      display: 'flex',
      flexDirection: 'column',
      height: isModal ? '100%' : 'auto',
      maxHeight: isModal ? 'none' : '85vh',
      boxShadow: isModal ? 'none' : undefined,
      border: isModal ? 'none' : undefined,
      padding: isModal ? '10px 0' : 'var(--space-xl)',
      overflow: 'hidden'
    }}>
      {isModal && tickerInfo && (
        <div style={{
          padding: '5px 10px 15px 10px',
          borderBottom: '1px solid #f1f5f9',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'baseline',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#1e293b', fontWeight: '800' }}>
            {tickerInfo.nombre || tickerInfo.ticker}
          </h2>
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#0ea5e9',
            backgroundColor: '#f0f9ff',
            padding: '2px 8px',
            borderRadius: '6px',
            textTransform: 'uppercase'
          }}>
            {tickerInfo.ticker}
          </span>
          <span style={{
            fontSize: '13px',
            color: '#64748b',
            backgroundColor: '#f8fafc',
            padding: '2px 10px',
            borderRadius: '20px',
            border: '1px solid #e2e8f0'
          }}>
            {tickerInfo.tipo || 'Activo'}
          </span>
        </div>
      )}

      <div className="flex-between" style={{ marginBottom: 15, padding: isModal ? '0 5px' : 0 }}>
        <h3 className="card-title" style={{ margin: 0, fontSize: isModal ? '14px' : '18px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Histórico de Evolución ({moneda})
        </h3>
        {loading && <span style={{ fontSize: '12px', color: '#0ea5e9' }}>Cargando datos...</span>}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="loading" style={{ margin: '0 auto 10px' }}></div>
          <div>Cargando evolución...</div>
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Sin datos de evolución para este período
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflowX: 'auto', // Handle horizontal scroll here
          overflowY: 'hidden',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          position: 'relative',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
        }}>
          {/* Header Fijo */}
          <div style={{
            zIndex: 10,
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            width: '1050px' // Match body width
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              fontSize: '12px',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
            }}>
              <thead>
                <tr>
                  <th style={{ width: '115px', padding: '16px 8px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>
                    FECHA
                  </th>
                  <th style={{ width: '100px', padding: '16px 8px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>
                    VALOR INICIAL (Vi)
                  </th>
                  <th style={{ width: '90px', padding: '16px 8px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>
                    APORTES (F)
                  </th>
                  <th style={{ width: '80px', padding: '16px 8px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>
                    CANT. (C)
                  </th>
                  <th style={{ width: '90px', padding: '16px 8px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>
                    CANT. ACUM (Ca)
                  </th>
                  <th style={{ width: '85px', padding: '16px 8px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>
                    PRECIO (P)
                  </th>
                  <th style={{ width: '105px', padding: '16px 8px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>
                    VALOR FINAL (Vf)
                  </th>
                  <th style={{ width: '95px', padding: '16px 8px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>
                    REND. (Rm)
                  </th>
                  <th style={{ width: '80px', padding: '16px 8px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>
                    % RENT.
                  </th>
                  <th style={{
                    width: '90px',
                    padding: '16px 8px',
                    textAlign: 'right',
                    fontWeight: '800',
                    backgroundColor: '#ffffff',
                    color: '#0ea5e9',
                    borderLeft: '1px solid #f1f5f9'
                  }}>
                    RENT. ACUM.
                  </th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Body Scrollable */}
          <div style={{
            zIndex: 1,
            overflowY: 'auto',
            overflowX: 'hidden', // Parent handles horizontal scroll
            flex: 1,
            minHeight: 0,
            position: 'relative',
            backgroundColor: '#ffffff'
          }}>
            <table style={{
              width: '1050px', // Total Fixed Width to ensure columns align
              borderCollapse: 'separate',
              tableLayout: 'fixed',
              fontSize: '13px',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
            }}>
              <tbody>
                {data.map((item, index) => {
                  const Vi = item.valorInicial ?? 0
                  const F = item.aportes ?? 0
                  const C = item.cantidad ?? 0
                  const Ca = item.cantidadAcumulada ?? 0
                  const P = item.precio ?? 0
                  const Vf = item.valorFinal ?? 0
                  const Rm = item.rendimiento ?? 0
                  const Rn = item.rentabilidad ?? 0
                  const Rna = item.rentabilidadAcumulada ?? 0

                  return (
                    <tr
                      key={item.fecha}
                      className="evolucion-row"
                      style={{
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#fcfdfe',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <td style={{ width: '115px', padding: '12px 8px', fontWeight: '600', color: '#334155', borderBottom: '1px solid #f1f5f9' }}>
                        {formatDateStr(item.fecha)}
                      </td>
                      <td style={{ width: '100px', padding: '12px 8px', textAlign: 'right', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>
                        {formatCurrency(Vi)}
                      </td>
                      <td style={{ width: '90px', padding: '12px 8px', textAlign: 'right', color: F > 0 ? '#0ea5e9' : '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>
                        {formatCurrency(F)}
                      </td>
                      <td style={{ width: '80px', padding: '12px 8px', textAlign: 'right', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                        {C.toFixed(2)}
                      </td>
                      <td style={{ width: '90px', padding: '12px 8px', textAlign: 'right', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                        {Ca.toFixed(2)}
                      </td>
                      <td style={{ width: '85px', padding: '12px 8px', textAlign: 'right', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                        {P.toFixed(2)}
                      </td>
                      <td style={{ width: '105px', padding: '12px 8px', textAlign: 'right', color: '#1e293b', fontWeight: '600', borderBottom: '1px solid #f1f5f9' }}>
                        {formatCurrency(Vf)}
                      </td>
                      <td style={{
                        width: '95px',
                        padding: '12px 8px',
                        textAlign: 'right',
                        color: getColorForValue(Rm),
                        fontWeight: '600',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        {formatCurrency(Rm)}
                      </td>
                      <td style={{
                        width: '80px',
                        padding: '12px 8px',
                        textAlign: 'right',
                        color: getColorForValue(Rn),
                        fontWeight: '600',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        {formatPercentage(Rn)}
                      </td>
                      <td style={{
                        width: '90px',
                        padding: '12px 8px',
                        textAlign: 'right',
                        color: getColorForValue(Rna),
                        fontWeight: '700',
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                        borderBottom: '1px solid #f1f5f9',
                        borderLeft: '1px solid #f1f5f9'
                      }}>
                        {formatPercentage(Rna)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

