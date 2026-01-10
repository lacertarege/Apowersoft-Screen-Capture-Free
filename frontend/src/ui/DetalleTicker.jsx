import React, { useEffect, useState, useMemo } from 'react'
import { API } from './config'
import NumberCell from './NumberCell.jsx'
import { fmtDateLima } from './utils'
import NuevaInversionModal from './NuevaInversionModal.jsx'
import EditarInversionModal from './EditarInversionModal.jsx'
import { useInvestments } from '../hooks/useInvestments.js'
import InvestmentChart from './InvestmentChart.jsx'

export default function DetalleTicker({ tickerId, onBack, onChanged, tickersList = [], currentIndex = -1, onNavigateToTicker }) {
  const [ticker, setTicker] = useState(null)
  const [tickerSummary, setTickerSummary] = useState(null)
  const [inversiones, setInversiones] = useState([])
  const [loading, setLoading] = useState(true)

  // Estados para datos BVL
  const [bvlData, setBvlData] = useState(null)
  const [bvlEvents, setBvlEvents] = useState([])
  const [bvlBenefits, setBvlBenefits] = useState([])
  const [loadingBvl, setLoadingBvl] = useState(false)

  // Usar el hook para manejar las inversiones
  const { getInvestments, createInvestment, deleteInvestment, updateInvestment } = useInvestments()

  // Funciones de navegación
  const handlePreviousTicker = () => {
    if (currentIndex > 0 && tickersList[currentIndex - 1]) {
      const previousTicker = tickersList[currentIndex - 1]
      onNavigateToTicker(previousTicker.id)
    }
  }

  const handleNextTicker = () => {
    if (currentIndex < tickersList.length - 1 && tickersList[currentIndex + 1]) {
      const nextTicker = tickersList[currentIndex + 1]
      onNavigateToTicker(nextTicker.id)
    }
  }

  const canNavigatePrevious = currentIndex > 0
  const canNavigateNext = currentIndex < tickersList.length - 1

  // Estados para los modales
  const [showNuevaInversion, setShowNuevaInversion] = useState(false)
  const [showEditarInversion, setShowEditarInversion] = useState(false)
  const [inversionEditando, setInversionEditando] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!tickerId) return
      setLoading(true)
      try {
        // Cargar datos del ticker y sus inversiones en paralelo
        const t = await fetch(`${API}/tickers/${tickerId}`).then(r => r.json())
        const inv = await getInvestments(tickerId)

        if (!cancelled) {
          setTicker(t)
          setTickerSummary(t)
          setInversiones(inv)

          // Si el ticker tiene rpj_code, cargar datos BVL
          if (t.rpj_code) {
            loadBvlData(t.rpj_code)
          }
        }
      } catch (error) {
        console.error("Error al cargar el detalle del ticker:", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tickerId])

  const totals = useMemo(() => {
    const imp = inversiones.reduce((a, x) => a + (Number(x.importe) || 0), 0)
    const cant = inversiones.reduce((a, x) => a + (Number(x.cantidad) || 0), 0)
    const avg = cant ? (imp / cant) : null

    // Calcular rendimiento y rentabilidad totales
    const precioActual = tickerSummary?.precio?.precio || 0
    const valorActual = cant * precioActual
    const rendimiento = valorActual - imp
    const rentabilidad = imp > 0 ? (rendimiento / imp) : 0

    return { imp, cant, avg, rendimiento, rentabilidad }
  }, [inversiones, tickerSummary?.precio?.precio])

  // Función separada para cargar inversiones
  const loadInversiones = async () => {
    if (!tickerId) return
    const inv = await getInvestments(tickerId)
    setInversiones(inv)
  }

  // Función para cargar datos BVL
  const loadBvlData = async (rpjCode) => {
    if (!rpjCode) return
    setLoadingBvl(true)
    try {
      // Cargar info de empresa, eventos y beneficios en paralelo
      const [companyRes, eventsRes, benefitsRes] = await Promise.all([
        fetch(`${API}/bvl/company/${rpjCode}`),
        fetch(`${API}/bvl/corporate-actions?rpjCode=${rpjCode}&page=1&size=5`),
        fetch(`${API}/bvl/benefits/${rpjCode}`)
      ])

      if (companyRes.ok) {
        const companyData = await companyRes.json()
        setBvlData(companyData)
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json()
        setBvlEvents(eventsData.events || [])
      }

      if (benefitsRes.ok) {
        const benefitsData = await benefitsRes.json()
        setBvlBenefits(benefitsData.benefits || [])
      }
    } catch (error) {
      console.error('Error cargando datos BVL:', error)
    } finally {
      setLoadingBvl(false)
    }
  }

  // Función para crear nueva inversión
  const handleCrearInversion = async (inversionData) => {
    const result = await createInvestment(tickerId, inversionData)

    if (result.success) {
      // ¡Éxito! Refrescar datos y notificar al padre
      await loadInversiones()
      setShowNuevaInversion(false)
      if (onChanged) onChanged()
    } else {
      // Mostrar error al usuario
      alert(`Error al crear la inversión: ${result.error}`)
    }
  }

  // Función para editar inversión
  const handleEditarInversion = async (inversionData) => {
    if (!inversionEditando) return
    const result = await updateInvestment(inversionEditando.id, inversionData)

    if (result.success) {
      await loadInversiones()
      setShowEditarInversion(false)
      setInversionEditando(null)
      if (onChanged) onChanged()
    } else {
      alert(`Error al editar la inversión: ${result.error}`)
    }
  }

  // Función para eliminar inversión
  const handleEliminarInversion = async (inversion) => {
    if (!confirm(`¿Eliminar la inversión del ${fmtDateLima(inversion.fecha)}?`)) return
    const result = await deleteInvestment(inversion.id)

    if (result.success) {
      await loadInversiones()
      if (onChanged) onChanged()
    } else {
      alert(`Error al eliminar la inversión: ${result.error}`)
    }
  }

  // Función para abrir modal de edición
  const abrirEditarInversion = (inversion) => {
    setInversionEditando(inversion)
    setShowEditarInversion(true)
  }

  return (
    <div className="container">
      <style jsx="true">{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}>Cargando...</div>
      ) : !ticker ? (
        <div className="text-muted">No se encontró el ticker.</div>
      ) : (
        <>
          {/* Header con información del ticker y botones de navegación */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
            paddingBottom: '12px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            {/* Información del ticker (izquierda) */}
            <div>
              <h3 style={{
                margin: '0 0 4px 0',
                fontSize: '18px',
                fontWeight: '600',
                color: '#1e293b'
              }}>
                {ticker.ticker} · {ticker.nombre}
                {tickerSummary?.precio?.precio && tickerSummary.precio.precio > 0 && (
                  <span style={{ fontSize: '0.8em', fontWeight: 'normal', marginLeft: '8px', color: '#666' }}>
                    (Precio actual: <NumberCell value={tickerSummary.precio.precio} currency={ticker.moneda} />)
                  </span>
                )}
              </h3>
              <div style={{ color: '#6b7280', fontSize: '14px' }}>Moneda: {ticker.moneda}</div>
            </div>

            {/* Botones de navegación (derecha) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={onBack}
                className="btn btn-outline-secondary"
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Volver a la lista"
              >
                ← Volver
              </button>
              <button
                onClick={handlePreviousTicker}
                disabled={!canNavigatePrevious}
                className="btn btn-outline-secondary"
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: canNavigatePrevious ? 1 : 0.5,
                  cursor: canNavigatePrevious ? 'pointer' : 'not-allowed'
                }}
                title="Ticker anterior"
              >
                ◀ Anterior
              </button>
              <button
                onClick={handleNextTicker}
                disabled={!canNavigateNext}
                className="btn btn-outline-secondary"
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: canNavigateNext ? 1 : 0.5,
                  cursor: canNavigateNext ? 'pointer' : 'not-allowed'
                }}
                title="Siguiente ticker"
              >
                Siguiente ▶
              </button>
              <button
                onClick={() => {/* Función para verificar precios */ }}
                className="btn btn-outline-primary"
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🔍 Verificar Precios
              </button>
            </div>
          </div>

          {/* Secciones BVL - Solo mostrar si el ticker tiene rpj_code */}
          {ticker.rpj_code && (
            <>
              {/* Perfil BVL */}
              {bvlData && (
                <div className="card" style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                    📊 Perfil BVL
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Nombre Oficial</div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{bvlData.name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Sector</div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>{bvlData.sector}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>RPJ Code</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'monospace' }}>{bvlData.rpjCode}</div>
                    </div>
                  </div>
                  {bvlData.indices && bvlData.indices.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Índices</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {bvlData.indices.map((index, i) => (
                          <span key={i} style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            backgroundColor: '#f3f4f6',
                            border: '1px solid #e5e7eb',
                            borderRadius: '4px',
                            color: '#374151'
                          }}>{index}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Eventos Corporativos */}
              {bvlEvents.length > 0 && (
                <div className="card" style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                    📰 Eventos Corporativos Recientes
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {bvlEvents.map((event, i) => (
                      <div key={i} style={{
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderLeft: '3px solid #0ea5e9',
                        borderRadius: '4px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                            {event.date}
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            {event.session}
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#4b5563', marginBottom: '8px' }}>
                          {event.types.map((type, j) => (
                            <div key={j} style={{ marginTop: j > 0 ? '4px' : 0 }}>
                              • {type.description}
                            </div>
                          ))}
                        </div>
                        {event.documents && event.documents.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            {event.documents.map((doc, j) => (
                              <a
                                key={j}
                                href={doc.path}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '11px',
                                  color: '#0ea5e9',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                📄 Ver Documento
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dividendos BVL */}
              {bvlBenefits.length > 0 && (
                <div className="card" style={{ marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                    💰 Dividendos y Beneficios
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Ticker</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tipo</th>
                          <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Monto</th>
                          <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Fecha Registro</th>
                          <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Fecha Pago</th>
                          <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Ex-Dividendo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bvlBenefits.map((benefit, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '12px' }}>{benefit.ticker}</td>
                            <td style={{ padding: '8px' }}>{benefit.type}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600', color: '#059669' }}>
                              {benefit.currency} {benefit.amount}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', fontSize: '12px' }}>{benefit.recordDate || '-'}</td>
                            <td style={{ padding: '8px', textAlign: 'center', fontSize: '12px' }}>{benefit.paymentDate || '-'}</td>
                            <td style={{ padding: '8px', textAlign: 'center', fontSize: '12px' }}>{benefit.exDate || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Loading state para BVL */}
              {loadingBvl && (
                <div className="card" style={{ marginBottom: '20px', textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                  Cargando información de BVL...
                </div>
              )}
            </>
          )}

          {/* Gráfico de evolución de inversión */}
          {inversiones.length > 0 && ticker && (
            <InvestmentChart
              inversiones={inversiones}
              ticker={ticker}
              currentPrice={tickerSummary?.precio?.precio || 0}
              onPreviousTicker={handlePreviousTicker}
              onNextTicker={handleNextTicker}
              canNavigatePrevious={canNavigatePrevious}
              canNavigateNext={canNavigateNext}
              onBack={onBack}
            />
          )}

          {/* Botón Nueva Inversión */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowNuevaInversion(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              + Nueva Inversión
            </button>
          </div>

          <div className="card">
            <h3 className="card-title">Inversiones</h3>
            {inversiones.length === 0 ? (
              <div className="text-muted">Sin inversiones</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th style={{ textAlign: 'right' }}>Importe</th>
                      <th style={{ textAlign: 'right' }}>Cantidad</th>
                      <th style={{ textAlign: 'right' }}>Apertura</th>
                      <th style={{ textAlign: 'right' }}>Rendimiento</th>
                      <th style={{ textAlign: 'right' }}>Rentabilidad</th>
                      <th>Plataforma</th>
                      <th style={{ textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inversiones.map(inv => {
                      // Calcular rendimiento y rentabilidad para cada inversión
                      const precioActual = tickerSummary?.precio?.precio || 0
                      const cantidad = Number(inv.cantidad || 0)
                      const importe = Number(inv.importe || 0)
                      const valorActual = cantidad * precioActual
                      const rendimiento = valorActual - importe
                      const rentabilidad = importe > 0 ? (rendimiento / importe) : 0

                      return (
                        <tr key={inv.id}>
                          <td>{fmtDateLima(inv.fecha)}</td>
                          <td style={{ textAlign: 'right' }}><NumberCell value={importe} currency={ticker.moneda} /></td>
                          <td style={{ textAlign: 'right' }}>{cantidad.toFixed(4)}</td>
                          <td style={{ textAlign: 'right' }}>{Number(inv.apertura_guardada || 0).toFixed(4)}</td>
                          <td style={{
                            textAlign: 'right',
                            color: rendimiento > 0 ? 'green' : rendimiento < 0 ? 'red' : 'inherit'
                          }}>
                            <NumberCell value={rendimiento} currency={ticker.moneda} />
                          </td>
                          <td style={{
                            textAlign: 'right',
                            color: rentabilidad > 0 ? 'green' : rentabilidad < 0 ? 'red' : 'inherit'
                          }}>
                            {new Intl.NumberFormat('es-PE', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rentabilidad)}
                          </td>
                          <td>{inv.plataforma || '-'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              onClick={() => abrirEditarInversion(inv)}
                              style={{
                                background: 'none',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                marginRight: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Editar inversión"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleEliminarInversion(inv)}
                              style={{
                                background: 'none',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                color: '#dc2626'
                              }}
                              title="Eliminar inversión"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Total</th>
                      <th style={{ textAlign: 'right' }}><NumberCell value={totals.imp} currency={ticker.moneda} /></th>
                      <th style={{ textAlign: 'right' }}>{totals.cant.toFixed(4)}</th>
                      <th style={{ textAlign: 'right' }}>{totals.avg != null ? totals.avg.toFixed(4) : '-'}</th>
                      <th style={{
                        textAlign: 'right',
                        color: totals.rendimiento > 0 ? 'green' : totals.rendimiento < 0 ? 'red' : 'inherit'
                      }}>
                        <NumberCell value={totals.rendimiento} currency={ticker.moneda} />
                      </th>
                      <th style={{
                        textAlign: 'right',
                        color: totals.rentabilidad > 0 ? 'green' : totals.rentabilidad < 0 ? 'red' : 'inherit'
                      }}>
                        {new Intl.NumberFormat('es-PE', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totals.rentabilidad)}
                      </th>
                      <th></th>
                      <th></th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modales */}
      <NuevaInversionModal
        open={showNuevaInversion}
        onClose={() => setShowNuevaInversion(false)}
        onSave={handleCrearInversion}
        empresa={ticker}
      />
      <EditarInversionModal
        open={showEditarInversion}
        onClose={() => {
          setShowEditarInversion(false)
          setInversionEditando(null)
        }}
        onSave={handleEditarInversion}
        inversion={inversionEditando}
        empresa={ticker}
      />
    </div>
  )
}