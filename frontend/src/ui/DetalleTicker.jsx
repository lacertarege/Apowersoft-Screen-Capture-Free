
import React, { useEffect, useState, useMemo } from 'react'
import { API } from './config'
import NumberCell from './NumberCell.jsx'
import { fmtDateLima } from './utils'
import NuevaInversionModal from './NuevaInversionModal.jsx'
import NuevaDesinversionModal from './NuevaDesinversionModal.jsx'
import EditarInversionModal from './EditarInversionModal.jsx'
import { useInvestments } from '../hooks/useInvestments.js'
import InvestmentChart from './InvestmentChart.jsx'

export default function DetalleTicker({ tickerId, onBack, onChanged, tickersList = [], currentIndex = -1, onNavigateToTicker, onEdit }) {
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
  const [showNuevaDesinversion, setShowNuevaDesinversion] = useState(false)
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

  // Cálculos de posición actual
  const posicionActual = useMemo(() => {
    // Ordenar cronológicamente (ASC) para cálculo iterativo
    // Nota: 'inversiones' viene normalmente en DESC (más reciente primero)
    // Usamos ID como desempate para transacciones en el mismo día
    const sortedInv = [...inversiones].sort((a, b) => {
      const da = new Date(a.fecha)
      const db = new Date(b.fecha)
      if (da.getTime() !== db.getTime()) return da - db
      // Mismo día: ordenar por ID (menor ID = más antigua)
      return (a.id || 0) - (b.id || 0)
    })

    let currentQty = 0
    let currentCpp = 0

    // Iterar aplicando Reglas de Oro
    let totalRealizedGain = 0
    const realizedGainsMap = {}

    for (const inv of sortedInv) {
      if (inv.is_dividend) continue // Dividendos no afectan qty ni cpp

      const qty = Number(inv.cantidad || 0)
      const amount = Number(inv.importe || 0)

      // Tipo Inversión (Compra)
      if (inv.tipo_operacion === 'INVERSION' || (!inv.tipo_operacion && !inv.is_dividend)) {
        const prevCost = currentQty * currentCpp
        const newCost = amount
        currentQty += qty

        // Regla 1: CPP se actualiza solo en COMPRA
        // Regla 3: Si se viene de 0, CPP es precio de compra simple
        if (currentQty > 0.000001) {
          currentCpp = (prevCost + newCost) / currentQty
        } else {
          currentCpp = 0
        }
      }
      // Tipo Desinversión (Venta)
      else if (inv.tipo_operacion === 'DESINVERSION') {
        const soldQty = qty // En la API viene positiva

        // Regla B: Ganancia Realizada = (Precio Venta - CPP) * Cantidad
        // Precio Venta Implícito = Importe Recibido / Cantidad Vendida
        // Ganancia = Importe Recibido - (CPP * Cantidad Vendida)
        const costBasis = soldQty * currentCpp
        const proceeds = amount
        const realized = proceeds - costBasis
        totalRealizedGain += realized
        realizedGainsMap[inv.id] = realized

        currentQty -= soldQty

        // Regla 2: CPP NO cambia al vender

        // Regla 3: Reset total si llega a 0
        if (currentQty <= 0.000001) {
          currentQty = 0
          currentCpp = 0
        }
      }
    }

    // Valores Finales
    // Corregir errores de precisión de punto flotante: si qty < 0.01, considerar como 0
    const cantidadActual = Math.abs(currentQty) < 0.01 ? 0 : currentQty
    const cpp = cantidadActual === 0 ? 0 : currentCpp

    // Capital Total Invertido = Cantidad Restante * CPP Actual
    const capitalInvertido = cantidadActual * cpp

    // Valor de Mercado
    const precioActual = tickerSummary?.precio?.precio || 0
    const valorMercado = cantidadActual * precioActual

    // Ganancia No Realizada
    const gananciaNoRealizada = valorMercado - capitalInvertido

    // Rentabilidad No Realizada %
    const rentabilidadNoRealizada = capitalInvertido > 0
      ? (gananciaNoRealizada / capitalInvertido)
      : 0

    return {
      cantidadActual,
      cpp,
      precioActual,
      valorMercado,
      gananciaNoRealizada,
      rentabilidadNoRealizada,
      capitalInvertido,
      capitalInvertido,
      totalRealizedGain,
      realizedGainsMap
    }
  }, [inversiones, tickerSummary?.precio?.precio])

  // Totales del historial de transacciones
  const totalesHistorial = useMemo(() => {
    const inversionesTotales = inversiones
      .filter(inv => (inv.tipo_operacion === 'INVERSION' || !inv.tipo_operacion) && !inv.is_dividend)
      .reduce((sum, inv) => sum + Number(inv.importe || 0), 0)

    const retirosTotales = inversiones
      .filter(inv => inv.tipo_operacion === 'DESINVERSION')
      .reduce((sum, inv) => sum + Number(inv.importe || 0), 0)

    // Dividendos Totales
    const dividendosTotales = inversiones
      .filter(inv => inv.tipo_operacion === 'DIVIDENDO')
      .reduce((sum, inv) => sum + Number(inv.importe || 0), 0)

    const capitalNeto = inversionesTotales - retirosTotales

    const gananciasVentas = posicionActual.totalRealizedGain || 0

    // Ganancia Realizada Total = Beneficio Ventas + Dividendos
    const gananciasRealizadas = gananciasVentas + dividendosTotales

    return {
      capitalInvertido: inversionesTotales,
      capitalRetirado: retirosTotales,
      capitalNeto,
      gananciasRealizadas,
      dividendosTotales,
      saldoFinal: posicionActual.cantidadActual
    }
  }, [inversiones, posicionActual.cantidadActual])

  // Inversiones con saldo acumulativo (desde la más antigua a la más reciente)
  const inversionesConSaldo = useMemo(() => {
    // Ordenar cronológicamente ASC (más antigua primero) con ID como desempate
    const inversionesOrdenadas = [...inversiones].sort((a, b) => {
      const da = new Date(a.fecha)
      const db = new Date(b.fecha)
      if (da.getTime() !== db.getTime()) return da - db
      return (a.id || 0) - (b.id || 0)
    })

    let saldoAcum = 0

    const conSaldo = inversionesOrdenadas.map(inv => {
      // Si es dividendo, delta es 0
      let delta = 0
      if (inv.tipo_operacion === 'INVERSION' || (!inv.tipo_operacion && !inv.is_dividend)) {
        delta = Number(inv.cantidad || 0)
      } else if (inv.tipo_operacion === 'DESINVERSION') {
        delta = -Number(inv.cantidad || 0)
      } else if (inv.tipo_operacion === 'DIVIDENDO') {
        delta = 0
      }

      saldoAcum += delta

      return {
        ...inv,
        delta,
        saldo: saldoAcum
      }
    })

    // Revertir de nuevo para mostrar más reciente primero en la UI
    return conSaldo.reverse()
  }, [inversiones])

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

  // Función para crear nueva desinversión
  const handleCrearDesinversion = async (desinversionData) => {
    const result = await createInvestment(tickerId, desinversionData)

    if (result.success) {
      // Mostrar mensaje con rendimiento realizado si está disponible
      if (result.data?.realized_return !== undefined) {
        const msg = `Desinversión registrada exitosamente.\n\nRendimiento Realizado: ${new Intl.NumberFormat('es-PE', {
          style: 'currency',
          currency: ticker.moneda || 'USD'
        }).format(result.data.realized_return)} (${result.data.realized_return_rate >= 0 ? '+' : ''}${result.data.realized_return_rate.toFixed(2)}%)`
        alert(msg)
      }

      await loadInversiones()
      setShowNuevaDesinversion(false)
      if (onChanged) onChanged()
    } else {
      alert(`Error al crear la desinversión: ${result.error}`)
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
            borderBottom: '1px solid #e5e7eb',
            position: 'sticky',
            top: '56px', // Altura del Navbar para evitar solapamiento
            backgroundColor: '#ffffff',
            zIndex: 90, // Menor que el navbar (1000) pero mayor que el contenido
            paddingTop: '16px', // Add padding top to account for sticky
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', // Add shadow when sticky (it will always have it here, which is fine)
            margin: '-16px -20px 20px -20px', // Negative margin to stretch full width if container has padding
            paddingLeft: '20px',
            paddingRight: '20px'
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
              <div style={{ color: '#6b7280', fontSize: '14px', display: 'flex', gap: '16px' }}>
                <span>Moneda: {ticker.moneda}</span>
                {ticker.tipo_inversion_nombre && (
                  <span>Tipo: {ticker.tipo_inversion_nombre}</span>
                )}
                {ticker.pais && (
                  <span>País: {ticker.pais}</span>
                )}
                {/* Priorizar sector local, luego BVL */}
                {(ticker.sector_nombre || bvlData?.sector) && (
                  <span>Sector: {ticker.sector_nombre || bvlData?.sector}</span>
                )}
              </div>
            </div>

            {/* Botones de navegación (derecha) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => onEdit && onEdit(ticker)}
                className="btn"
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  borderRadius: '4px',
                  marginRight: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ✎ Editar Ticker
              </button>
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

          {/* Secciones BVL */}
          {ticker.rpj_code && (
            <>
              {/* Perfil BVL - Oculto (Sector movido al header) */}

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
              // Data for Right Panel (Resumen Financiero)
              totalesHistorial={totalesHistorial}
              posicionActual={posicionActual}
            />
          )}

          {/* Card de Posición Actual */}
          {inversiones.length > 0 && (
            <div className="card" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)', border: '2px solid #e5e7eb' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📊 Posición Actual
                {posicionActual.cantidadActual === 0 && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    padding: '4px 10px',
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    border: '1px solid #fca5a5',
                    borderRadius: '12px',
                    marginLeft: '8px',
                    letterSpacing: '0.5px'
                  }}>
                    POSICIÓN CERRADA
                  </span>
                )}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>Cantidad Actual</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                    {posicionActual.cantidadActual.toFixed(4)} {ticker.tipo_inversion_id === 1 ? 'cuotas' : 'acciones'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>Costo Promedio (CPP)</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                    <NumberCell value={posicionActual.cpp} currency={ticker.moneda} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>Precio Actual</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                    <NumberCell value={posicionActual.precioActual} currency={ticker.moneda} />
                  </div>
                  {tickerSummary?.precio?.fecha && (
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      al {new Date(tickerSummary.precio.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>Valor de Mercado</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                    <NumberCell value={posicionActual.valorMercado} currency={ticker.moneda} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>Ganancia No Realizada</div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: posicionActual.gananciaNoRealizada >= 0 ? '#059669' : '#dc2626'
                  }}>
                    <NumberCell value={posicionActual.gananciaNoRealizada} currency={ticker.moneda} />
                    <span style={{ fontSize: '14px', marginLeft: '8px' }}>
                      ({posicionActual.rentabilidadNoRealizada >= 0 ? '+' : ''}{(posicionActual.rentabilidadNoRealizada * 100).toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>💰 Capital Total Invertido</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                    <NumberCell value={posicionActual.capitalInvertido} currency={ticker.moneda} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>🎯 Ganancia Realizada Total</div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: totalesHistorial.gananciasRealizadas >= 0 ? '#059669' : '#dc2626'
                  }}>
                    <NumberCell value={totalesHistorial.gananciasRealizadas} currency={ticker.moneda} />
                    {posicionActual.capitalInvertido > 0 && (
                      <span style={{ fontSize: '14px', marginLeft: '8px', color: totalesHistorial.gananciasRealizadas >= 0 ? '#059669' : '#dc2626' }}>
                        (ROI: {((totalesHistorial.gananciasRealizadas / posicionActual.capitalInvertido) * 100).toFixed(2)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones Nueva Inversión y Desinversión */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => setShowNuevaDesinversion(true)}
              disabled={!posicionActual.cantidadActual || posicionActual.cantidadActual <= 0}
              style={{
                padding: '10px 16px',
                fontSize: '14px',
                background: posicionActual.cantidadActual > 0 ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : '#e5e7eb',
                color: posicionActual.cantidadActual > 0 ? 'white' : '#9ca3af',
                border: posicionActual.cantidadActual > 0 ? '1px solid #ea580c' : '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: posicionActual.cantidadActual > 0 ? 'pointer' : 'not-allowed',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              title={posicionActual.cantidadActual > 0 ? "Registrar desinversión" : "Sin stock disponible"}
            >
              ↓ Desinversión
            </button>
            <button
              onClick={() => setShowNuevaInversion(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Nueva Inversión
            </button>
          </div>

          <div className="card">
            <h3 className="card-title">📝 Historial de Transacciones</h3>
            {inversiones.length === 0 ? (
              <div className="text-muted">Sin inversiones</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: 'nowrap' }}>Operación</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Fecha</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Plataforma</th>
                      <th style={{ whiteSpace: 'nowrap' }}>Exchange</th>

                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Flujo de Caja</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Cantidad (Δ)</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Valor Cuota</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Ganancia Realizada</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Saldo (Unidades)</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inversionesConSaldo.map(inv => {
                      const importe = Number(inv.importe || 0)
                      const cantidad = Number(inv.cantidad || 0)
                      const tipoOperacion = inv.tipo_operacion || 'INVERSION'
                      const esDesinversion = tipoOperacion === 'DESINVERSION'
                      const esDividendo = tipoOperacion === 'DIVIDENDO'

                      // Flujo de caja con signo
                      let flujoCaja = 0
                      if (esDesinversion || esDividendo) {
                        flujoCaja = importe // Money IN
                      } else {
                        flujoCaja = -importe // Money OUT
                      }

                      return (
                        <tr key={inv.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              background: esDividendo
                                ? 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)' // Purple for Dividend
                                : (esDesinversion
                                  ? (inv.realized_return >= 0
                                    ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                                    : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)')
                                  : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'),
                              color: esDividendo
                                ? '#7e22ce' // Purple text
                                : (esDesinversion
                                  ? (inv.realized_return >= 0 ? '#166534' : '#991b1b')
                                  : '#1e40af'),
                              border: esDividendo
                                ? '1px solid #d8b4fe'
                                : (esDesinversion
                                  ? (inv.realized_return >= 0 ? '1px solid #86efac' : '1px solid #fca5a5')
                                  : '1px solid #93c5fd'),
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {esDividendo ? '💰 Dividendo' : (esDesinversion ? (inv.realized_return >= 0 ? '✅ Desinversión' : '⚠️ Desinversión') : '📈 Inversión')}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtDateLima(inv.fecha)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{inv.plataforma || '-'}</td>
                          <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{inv.exchange_nombre || ticker.exchange || '-'}</td>

                          <td style={{
                            textAlign: 'right',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            color: (esDesinversion || esDividendo) ? '#059669' : '#dc2626'
                          }}>
                            {(esDesinversion || esDividendo) ? '+ ' : '- '}
                            <NumberCell value={Math.abs(flujoCaja)} currency={ticker.moneda} />
                          </td>
                          <td style={{
                            textAlign: 'right',
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            color: esDividendo ? '#6b7280' : (esDesinversion ? '#dc2626' : '#059669')
                          }}>
                            {esDividendo ? '-' : ((esDesinversion ? '- ' : '+ ') + cantidad.toFixed(4))}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {esDividendo ? '-' : <NumberCell value={Number(inv.apertura_guardada || 0)} currency={ticker.moneda} />}
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {(esDesinversion || esDividendo) && inv.realized_return !== undefined ? (
                              <span style={{
                                fontWeight: '600',
                                color: (esDesinversion ? (posicionActual.realizedGainsMap[inv.id] || 0) : inv.realized_return) >= 0 ? '#059669' : '#dc2626'
                              }}>
                                <NumberCell value={esDesinversion ? (posicionActual.realizedGainsMap[inv.id] || 0) : inv.realized_return} currency={ticker.moneda} />
                              </span>
                            ) : (
                              <span style={{ color: '#9ca3af' }}>--</span>
                            )}
                          </td>
                          <td style={{
                            textAlign: 'right',
                            fontWeight: '600',
                            fontSize: '14px',
                            whiteSpace: 'nowrap',
                            color: '#1e293b'
                          }}>
                            {inv.saldo.toFixed(4)}
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {!esDividendo && (
                              <>
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
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #1e293b', background: '#f9fafb' }}>
                      <th colSpan="3" style={{ textAlign: 'left', padding: '12px 8px' }}>
                        <strong>TOTALES</strong>
                      </th>
                      <th colSpan="6"></th>
                    </tr>
                    <tr>
                      <td colSpan="3" style={{ paddingLeft: '24px', fontWeight: '500' }}>Capital Invertido</td>
                      <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: '600' }}>
                        <NumberCell value={totalesHistorial.capitalInvertido} currency={ticker.moneda} />
                      </td>
                      <td colSpan="5"></td>
                    </tr>
                    <tr>
                      <td colSpan="3" style={{ paddingLeft: '24px', fontWeight: '500' }}>Capital Retirado</td>
                      <td style={{ textAlign: 'right', color: '#059669', fontWeight: '600' }}>
                        <NumberCell value={totalesHistorial.capitalRetirado} currency={ticker.moneda} />
                      </td>
                      <td colSpan="5"></td>
                    </tr>
                    <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td colSpan="3" style={{ paddingLeft: '24px', fontWeight: '600' }}>Capital Neto</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '15px' }}>
                        <span style={{ color: totalesHistorial.capitalNeto < 0 ? '#dc2626' : '#059669' }}>
                          {totalesHistorial.capitalNeto < 0 ? '- ' : '+ '}
                          <NumberCell value={Math.abs(totalesHistorial.capitalNeto)} currency={ticker.moneda} />
                        </span>
                      </td>
                      <td colSpan="5"></td>
                    </tr>
                    <tr>
                      <td colSpan="3" style={{ paddingLeft: '24px', fontWeight: '500' }}>Ganancias Realizadas</td>
                      <td colSpan="3"></td>
                      <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '15px' }}>
                        <span style={{ color: totalesHistorial.gananciasRealizadas >= 0 ? '#059669' : '#dc2626' }}>
                          <NumberCell value={totalesHistorial.gananciasRealizadas} currency={ticker.moneda} />
                        </span>
                      </td>
                      <td colSpan="2"></td>
                    </tr>
                    <tr style={{ background: '#f3f4f6', borderTop: '2px solid #1e293b' }}>
                      <td colSpan="3" style={{ paddingLeft: '24px', fontWeight: '700', fontSize: '15px' }}>Saldo Final</td>
                      <td colSpan="4"></td>
                      <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '16px', color: '#1e293b' }}>
                        {totalesHistorial.saldoFinal.toFixed(4)} {ticker.tipo_inversion_id === 1 ? 'cuotas' : 'acciones'}
                      </td>
                      <td></td>
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
      <NuevaDesinversionModal
        open={showNuevaDesinversion}
        onClose={() => setShowNuevaDesinversion(false)}
        onSave={handleCrearDesinversion}
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