
import React, { useMemo, useEffect, useState, useRef } from 'react'
import { fmtDateLima, fmtCurr } from './utils'
import { API } from './config'

export default function InvestmentChart({
  inversiones,
  ticker,
  currentPrice,
  // Navigation props
  onPreviousTicker,
  onNextTicker,
  canNavigatePrevious,
  canNavigateNext,
  onBack,
  // Data props from parent (Unified Source)
  totalesHistorial,
  posicionActual
}) {
  const [historicos, setHistoricos] = useState([])
  const [loadingHistoricos, setLoadingHistoricos] = useState(true)
  const [checkingGaps, setCheckingGaps] = useState(false)
  const [gapStatus, setGapStatus] = useState(null)
  const [hoverPoint, setHoverPoint] = useState(null)
  const svgRef = useRef(null)

  // Cargar precios históricos
  useEffect(() => {
    if (!ticker?.id) return

    const loadHistoricos = async () => {
      setLoadingHistoricos(true)
      try {
        const response = await fetch(`${API}/historicos/${ticker.id}?from=1970-01-01`)
        if (response.ok) {
          const data = await response.json()
          const items = data.items || []
          items.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
          setHistoricos(items)
        }
      } catch (error) {
        console.error('Error al cargar históricos:', error)
      } finally {
        setLoadingHistoricos(false)
      }
    }

    loadHistoricos()
  }, [ticker?.id])

  // Procesar datos completos (sin filtrar)
  const fullChartData = useMemo(() => {
    if (!inversiones.length || !historicos.length) return []

    // Helper to parse dates without timezone issues (treats as local noon)
    const parseDate = (dateStr) => {
      if (!dateStr) return new Date(0)
      const str = String(dateStr).slice(0, 10) // Get YYYY-MM-DD
      return new Date(str + 'T12:00:00') // Parse as local noon to avoid day shift
    }

    // Ordenar inversiones por fecha cronológica
    const sortedInversiones = [...inversiones].sort((a, b) => parseDate(a.fecha) - parseDate(b.fecha))

    // Encontrar la primera inversión
    const primeraInversion = parseDate(sortedInversiones[0].fecha)

    // Filtrar históricos desde la primera inversión
    const historicosRelevantes = historicos.filter(h => parseDate(h.fecha) >= primeraInversion)

    // --- HELPER PARA CALCULAR ESTADO EN UNA FECHA DETERMINADA ---
    // Implementa: Iterative CPP & Rule A (Reset on 0)
    const getPortfolioStateAt = (cutoffDate) => {
      let qty = 0
      let cpp = 0

      for (const inv of sortedInversiones) {
        if (parseDate(inv.fecha) > cutoffDate) break // Stop if transaction is in future

        const esDesinversion = inv.tipo_operacion === 'DESINVERSION'
        const esDividendo = inv.tipo_operacion === 'DIVIDENDO'
        const esReinversion = inv.origen_capital === 'REINVERSION'
        const amount = Number(inv.importe) || 0
        const opQty = Number(inv.cantidad) || 0

        if (esDividendo) continue // Dividend not affecting inventory cost directly here (unless reinversion, treated as Buy)

        if (esDesinversion) {
          // Venta: Reduce Qty, CPP mantiene constante
          qty -= opQty
          if (qty <= 0.000001) {
            qty = 0
            cpp = 0 // Reset Rule
          }
        } else {
          // Compra (Inversion o Reinversion)
          const oldCost = qty * cpp
          const newCost = amount // Costo de esta compra
          qty += opQty
          if (qty > 0) {
            cpp = (oldCost + newCost) / qty
          }
        }
      }
      return { qty, cpp, capitalInvertido: qty * cpp }
    }


    const dataPoints = []

    // 1. PUNTOS HISTÓRICOS (Diarios)
    historicosRelevantes.forEach(historico => {
      const fechaHistorico = parseDate(historico.fecha)
      const state = getPortfolioStateAt(fechaHistorico)

      const valor = historico.precio * state.qty

      dataPoints.push({
        fecha: fechaHistorico,
        importe: state.capitalInvertido, // Now tracking Inventory Cost
        valor: valor,
        rendimiento: valor - state.capitalInvertido,
        cantidadAcumulada: state.qty,
        esHistorico: true,
        esInversion: false, esDesinversion: false, esDividendo: false, esReinversion: false, esActual: false
      })
    })

    // 2. MARCADORES DE OPERACIÓN (Exact Date)
    sortedInversiones.forEach(inv => {
      const fechaInv = parseDate(inv.fecha)
      // Find historical price closest to this op
      const historicoMasCercano = historicosRelevantes.reduce((closest, h) => {
        const diffCurrent = Math.abs(parseDate(h.fecha) - fechaInv)
        const diffClosest = closest ? Math.abs(parseDate(closest.fecha) - fechaInv) : Infinity
        return diffCurrent < diffClosest ? h : closest
      }, null)

      if (historicoMasCercano) {
        // Calculate state INCLUDING this transaction
        const state = getPortfolioStateAt(fechaInv)
        const valor = historicoMasCercano.precio * state.qty

        dataPoints.push({
          fecha: fechaInv,
          importe: state.capitalInvertido,
          valor: valor,
          rendimiento: valor - state.capitalInvertido,
          cantidadAcumulada: state.qty,
          esHistorico: false,
          esInversion: inv.tipo_operacion === 'INVERSION' && inv.origen_capital !== 'REINVERSION',
          esDesinversion: inv.tipo_operacion === 'DESINVERSION',
          esDividendo: inv.tipo_operacion === 'DIVIDENDO',
          esReinversion: inv.origen_capital === 'REINVERSION',
          esActual: false,
          montoOperacion: Number(inv.importe) || 0
        })
      }
    })

    // 3. PUNTO ACTUAL (Last known price)
    const ultimoHistorico = historicosRelevantes[historicosRelevantes.length - 1]
    if (ultimoHistorico) {
      // Use props directly for the final point to ensure 100% match with "Posición Actual" card
      const finalQty = posicionActual?.cantidadActual || 0
      const finalCapital = posicionActual?.capitalInvertido || 0
      const finalValor = posicionActual?.valorMercado || (ultimoHistorico.precio * finalQty)

      dataPoints.push({
        fecha: parseDate(ultimoHistorico.fecha), // Parse with timezone safety
        importe: finalCapital,
        valor: finalValor,
        rendimiento: finalValor - finalCapital,
        cantidadAcumulada: finalQty,
        esHistorico: false, esInversion: false, esDesinversion: false, esDividendo: false, esReinversion: false,
        esActual: true
      })
    }

    return dataPoints.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
  }, [inversiones, historicos, posicionActual])

  // State para el rango de fechas
  const [timeRange, setTimeRange] = useState('YTD')

  // Filtrar datos según el rango seleccionado
  const chartData = useMemo(() => {
    if (!fullChartData.length) return []
    if (timeRange === 'ALL') return fullChartData

    const now = new Date()
    // Normalizar "now" a medianoche para comparaciones consistentes si fuera necesario,
    // pero para rangos simples basta con ajustar la fecha límite.
    let startDate = new Date(now)

    switch (timeRange) {
      case '1W': startDate.setDate(now.getDate() - 7); break;
      case '1M': startDate.setMonth(now.getMonth() - 1); break;
      case '3M': startDate.setMonth(now.getMonth() - 3); break;
      case '6M': startDate.setMonth(now.getMonth() - 6); break;
      case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
      case 'YTD':
        startDate = new Date(now.getFullYear(), 0, 1)
        break;
      default: return fullChartData
    }

    // Filtrar
    return fullChartData.filter(d => new Date(d.fecha) >= startDate)
  }, [fullChartData, timeRange])

  // Configuración del gráfico
  const margin = { top: 20, right: 20, bottom: 60, left: 80 }
  const width = 700
  const height = 400
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  // Calcular rangos
  const minFecha = chartData.length > 0 ? new Date(Math.min(...chartData.map(d => d.fecha))) : new Date()
  const maxFecha = chartData.length > 0 ? new Date(Math.max(...chartData.map(d => d.fecha))) : new Date()
  const rangeFecha = maxFecha - minFecha

  const minValor = chartData.length > 0 ? Math.min(...chartData.map(d => Math.min(d.importe, d.valor))) : 0
  const maxValor = chartData.length > 0 ? Math.max(...chartData.map(d => Math.max(d.importe, d.valor))) : 0
  const rangeValor = maxValor - minValor

  // Funciones de escalado
  const getX = (fecha) => margin.left + ((new Date(fecha) - minFecha) / rangeFecha) * chartWidth
  const getY = (valor) => margin.top + chartHeight - ((valor - minValor) / rangeValor) * chartHeight

  // Generar líneas y áreas
  const importeLine = chartData.map(d => `${getX(d.fecha)},${getY(d.importe)}`).join(' ')
  const valorLine = chartData.map(d => `${getX(d.fecha)},${getY(d.valor)}`).join(' ')

  // Generar área de sombra (Spread)
  const spreadPath = [
    ...chartData.map(d => `${getX(d.fecha)},${getY(d.valor)}`),
    ...chartData.slice().reverse().map(d => `${getX(d.fecha)},${getY(d.importe)}`)
  ].join(' ')

  // Formatear valores
  const formatFullValue = (val) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: ticker?.moneda || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  const formatYValue = (val) => {
    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}K`
    return val.toFixed(0)
  }

  // Mouse handling
  const handleMouseMove = (e) => {
    if (!svgRef.current || chartData.length === 0) return
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const scaleX = width / rect.width
    const x = (e.clientX - rect.left) * scaleX

    // Find closest point
    let closestIdx = -1
    let minDist = Infinity
    for (let i = 0; i < chartData.length; i++) {
      const pointX = getX(chartData[i].fecha)
      const dist = Math.abs(x - pointX)
      if (dist < minDist && dist < 30) {
        minDist = dist
        closestIdx = i
      }
    }
    setHoverPoint(closestIdx >= 0 ? closestIdx : null)
  }

  if (loadingHistoricos) return <div style={{ textAlign: 'center', padding: 40 }}>Cargando datos históricos...</div>
  if (loadingHistoricos) return <div style={{ textAlign: 'center', padding: 40 }}>Cargando datos históricos...</div>
  if (fullChartData.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Datos insuficientes para el gráfico</div>

  return (
    <div style={{ margin: '20px 0' }}>
      {/* Layout */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '16px' }}>
        <div style={{ flex: 2 }}>
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            {/* Controles de Rango de Fecha */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', justifyContent: 'flex-end' }}>
              {['1W', '1M', '3M', '6M', '1Y', 'YTD', 'ALL'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    borderRadius: '12px',
                    border: timeRange === range ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                    backgroundColor: timeRange === range ? '#3b82f6' : 'white',
                    color: timeRange === range ? 'white' : '#64748b',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                >
                  {range}
                </button>
              ))}
            </div>

            <svg ref={svgRef} width={width} height={height} style={{ display: 'block', margin: '0 auto', cursor: 'crosshair' }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverPoint(null)}>
              {/* Background */}
              <rect x={margin.left} y={margin.top} width={chartWidth} height={chartHeight} fill="white" stroke="#e2e8f0" strokeWidth={1} />

              {/* Grid Y */}
              {[...Array(5)].map((_, i) => {
                const y = margin.top + (chartHeight / 4) * i
                const value = maxValor - (maxValor - minValor) * (i / 4)
                return (
                  <g key={`y-${i}`}>
                    <line x1={margin.left} y1={y} x2={margin.left + chartWidth} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />
                    <text x={margin.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{formatYValue(value)}</text>
                  </g>
                )
              })}

              {/* X Labels */}
              {chartData.filter((_, i) => i % Math.max(1, Math.floor(chartData.length / 5)) === 0 || i === chartData.length - 1).map((d, index) => (
                <text key={`x-${index}`} x={getX(d.fecha)} y={margin.top + chartHeight + 20} textAnchor="middle" fontSize="11" fill="#64748b">
                  {fmtDateLima(d.fecha)}
                </text>
              ))}

              {/* Spread Area (Green path showing profit zone visually) */}
              <path d={`M ${spreadPath} Z`} fill="rgba(16, 185, 129, 0.1)" stroke="none" />

              {/* Lines */}
              {/* Línea de Inversión Acumulada (External Cap): Black Dotted */}
              <polyline points={importeLine} fill="none" stroke="#000000" strokeWidth={1} strokeDasharray="3,3" />
              {/* Línea de Valor Actual (Green) */}
              <polyline points={valorLine} fill="none" stroke="#10b981" strokeWidth={1} />

              {/* Markers */}
              {/* Inversión (Fresh Capital): Blue */}
              {chartData.filter(d => d.esInversion).map((d, i) => (
                <circle key={`inv-${i}`} cx={getX(d.fecha)} cy={getY(d.valor)} r={2} fill="#3b82f6" stroke="white" strokeWidth={1} />
              ))}
              {/* Reinversión: Cyan (Nuevo) */}
              {chartData.filter(d => d.esReinversion).map((d, i) => (
                <circle key={`reinv-${i}`} cx={getX(d.fecha)} cy={getY(d.valor)} r={2} fill="#0ea5e9" stroke="white" strokeWidth={1} />
              ))}
              {/* Desinversión: Orange */}
              {chartData.filter(d => d.esDesinversion).map((d, i) => (
                <circle key={`des-${i}`} cx={getX(d.fecha)} cy={getY(d.valor)} r={2} fill="#f97316" stroke="white" strokeWidth={1} />
              ))}
              {/* Dividendo: Purple */}
              {chartData.filter(d => d.esDividendo).map((d, i) => (
                <circle key={`div-${i}`} cx={getX(d.fecha)} cy={getY(d.valor)} r={2} fill="#a855f7" stroke="white" strokeWidth={1} />
              ))}

              {/* Tooltip */}
              {hoverPoint !== null && chartData[hoverPoint] && (() => {
                const pt = chartData[hoverPoint]
                const tx = getX(pt.fecha)
                // Adjust tooltip position
                const boxW = 200, boxH = pt.esDividendo ? 120 : (pt.esReinversion ? 120 : 160)
                let bx = tx + 10
                if (bx + boxW > width - margin.right) bx = tx - boxW - 10
                const by = margin.top + 20

                return (
                  <g>
                    <line x1={tx} y1={margin.top} x2={tx} y2={margin.top + chartHeight} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,4" />
                    <circle cx={tx} cy={getY(pt.valor)} r={2.5} fill={pt.esDividendo ? "#a855f7" : (pt.esDesinversion ? "#f97316" : (pt.esReinversion ? "#0ea5e9" : "#3b82f6"))} stroke="white" strokeWidth={2} />

                    <rect x={bx} y={by} width={boxW} height={boxH} fill="white" stroke="#e2e8f0" rx={6} filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))" />

                    <text x={bx + 12} y={by + 20} fontSize="12" fontWeight="600" fill="#374151">{fmtDateLima(pt.fecha)}</text>

                    {pt.esDividendo ? (
                      <>
                        <text x={bx + 12} y={by + 45} fontSize="11" fill="#a855f7" fontWeight="600">💰 Dividendo Recibido</text>
                        <text x={bx + 12} y={by + 65} fontSize="18" fill="#1e293b" fontWeight="700">{formatFullValue(pt.montoOperacion)}</text>
                      </>
                    ) : pt.esReinversion ? (
                      <>
                        <text x={bx + 12} y={by + 45} fontSize="11" fill="#0ea5e9" fontWeight="600">🔄 Reinversión Auto</text>
                        <text x={bx + 12} y={by + 65} fontSize="18" fill="#1e293b" fontWeight="700">{formatFullValue(pt.montoOperacion)}</text>
                        <text x={bx + 12} y={by + 85} fontSize="10" fill="#64748b">(Capital Externo Neutro)</text>
                      </>
                    ) : (
                      <>
                        {/* Valor Tooltips */}
                        <text x={bx + 12} y={by + 45} fontSize="11" fill="#64748b">Valor:</text>
                        <text x={bx + boxW - 12} y={by + 45} fontSize="11" fill="#1e293b" fontWeight="600" textAnchor="end">{formatFullValue(pt.valor)}</text>

                        <text x={bx + 12} y={by + 65} fontSize="11" fill="#64748b">Cap. Externo:</text>
                        <text x={bx + boxW - 12} y={by + 65} fontSize="11" fill="#1e293b" fontWeight="600" textAnchor="end">{formatFullValue(pt.importe)}</text>

                        <text x={bx + 12} y={by + 85} fontSize="11" fill="#64748b">Rendimiento:</text>
                        <text x={bx + boxW - 12} y={by + 85} fontSize="11" fill={pt.rendimiento >= 0 ? "#10b981" : "#ef4444"} fontWeight="600" textAnchor="end">{formatFullValue(pt.rendimiento)}</text>

                        {pt.montoOperacion > 0 && (
                          <text x={bx + 12} y={by + 115} fontSize="10" fill={pt.esDesinversion ? "#f97316" : "#3b82f6"} fontWeight="500">
                            {pt.esDesinversion ? "Retiro: " : "Aporte: "}{formatFullValue(pt.montoOperacion)}
                          </text>
                        )}
                      </>
                    )}
                  </g>
                )
              })()}
            </svg>

            {/* Legend */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', fontSize: '12px', color: '#475569', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 1, background: '#000000', borderTop: '1px dashed #000000' }}></div> Inversión Acumulada</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 12, height: 1, background: '#10b981' }}></div> Valor Actual</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 3, height: 3, borderRadius: '50%', background: '#3b82f6' }}></div> Aporte</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 3, height: 3, borderRadius: '50%', background: '#0ea5e9' }}></div> Reinversión</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 3, height: 3, borderRadius: '50%', background: '#f97316' }}></div> Retiro</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 3, height: 3, borderRadius: '50%', background: '#a855f7' }}></div> Dividendo</div>
            </div>
          </div>
        </div>

        {/* Resumen Financiero Panel (Right) */}
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>📊 Resumen Financiero</h4>

            {/* 1. Capital Total Invertido */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', marginBottom: '4px' }}>Capital Total Invertido</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                {fmtCurr(posicionActual?.capitalInvertido || 0, ticker?.moneda)}
              </div>
            </div>

            {/* 2. Monto Actual */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', marginBottom: '4px' }}>Monto Actual</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                {fmtCurr(posicionActual?.valorMercado || 0, ticker?.moneda)}
              </div>
            </div>

            {/* 3. Ganancia Realizada (Cash) */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', marginBottom: '4px' }}>Ganancia Realizada (Cash)</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: (totalesHistorial?.gananciasRealizadas || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                {fmtCurr(totalesHistorial?.gananciasRealizadas || 0, ticker?.moneda)}
              </div>
            </div>

            {/* 4. Ganancia No Realizada (Papel) */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', marginBottom: '4px' }}>Ganancia No Realizada (Papel)</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: (posicionActual?.gananciaNoRealizada || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                {fmtCurr(posicionActual?.gananciaNoRealizada || 0, ticker?.moneda)}
              </div>
            </div>

            {/* 5. Retorno Total Combinado */}
            {(() => {
              const totalReturn = (Number(totalesHistorial?.gananciasRealizadas) || 0) + (Number(posicionActual?.gananciaNoRealizada) || 0)
              const investedCapital = Number(posicionActual?.capitalInvertido) || 0
              const totalRoi = investedCapital > 0 ? (totalReturn / investedCapital) * 100 : 0

              return (
                <div>
                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', marginBottom: '4px' }}>Retorno Total Combinado</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: totalReturn >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmtCurr(totalReturn, ticker?.moneda)}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: totalReturn >= 0 ? '#10b981' : '#ef4444' }}>
                    ({totalReturn >= 0 ? '+' : ''}{totalRoi.toFixed(2)}%)
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}