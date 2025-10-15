import React, { useMemo, useEffect, useState, useRef } from 'react'
import { fmtDateLima, fmtCurr } from './utils'
import { API } from './config'

export default function InvestmentChart({ inversiones, ticker, currentPrice, onPreviousTicker, onNextTicker, canNavigatePrevious, canNavigateNext, onBack }) {
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

  // Función para verificar y llenar huecos de precios
  const checkAndFillPriceGaps = async () => {
    if (!ticker?.id || !inversiones.length) return
    
    setCheckingGaps(true)
    setGapStatus('🔍 Verificando fechas faltantes...')
    
    try {
      // Encontrar la fecha de la primera inversión
      const primeraInversion = inversiones.reduce((min, inv) => {
        const fechaInv = new Date(inv.fecha)
        return fechaInv < min ? fechaInv : min
      }, new Date(inversiones[0].fecha))
      
      // Verificar precios desde la primera inversión
      const fromDate = primeraInversion.toISOString().split('T')[0]
      
      setGapStatus(`📅 Verificando desde ${fromDate}...`)
      
      // Llamar al endpoint de refresh con from_date
      const response = await fetch(`${API}/tickers/${ticker.id}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_date: fromDate })
      })
      
      if (response.ok) {
        const result = await response.json()
        setGapStatus(`✅ ${result.message || 'Precios verificados y actualizados'}`)
        
        // Recargar históricos
        const newResponse = await fetch(`${API}/historicos/${ticker.id}?from=1970-01-01`)
        if (newResponse.ok) {
          const data = await newResponse.json()
          const items = data.items || []
          items.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
          setHistoricos(items)
        }
      } else {
        setGapStatus('❌ Error al verificar precios')
      }
    } catch (error) {
      console.error('Error al verificar huecos:', error)
      setGapStatus('❌ Error al verificar precios')
    } finally {
      setCheckingGaps(false)
      // Limpiar el estado después de 5 segundos
      setTimeout(() => setGapStatus(null), 5000)
    }
  }

  // Procesar datos para el gráfico
  const chartData = useMemo(() => {
    if (!inversiones.length || !historicos.length) return []

    // Ordenar inversiones por fecha
    const sortedInversiones = [...inversiones].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    
    // Encontrar la primera inversión
    const primeraInversion = new Date(sortedInversiones[0].fecha)
    
    // Filtrar históricos desde la primera inversión
    const historicosRelevantes = historicos.filter(h => new Date(h.fecha) >= primeraInversion)
    
    // Crear puntos de datos
    const dataPoints = []
    
    // Procesar cada fecha histórica
    historicosRelevantes.forEach(historico => {
      const fechaHistorico = new Date(historico.fecha)
      
      
      // Calcular cantidad e importe acumulado hasta esta fecha
      let cantidadHastaFecha = 0
      let importeHastaFecha = 0
      
      sortedInversiones.forEach(inv => {
        if (new Date(inv.fecha) <= fechaHistorico) {
          cantidadHastaFecha += inv.cantidad
          importeHastaFecha += inv.importe
        }
      })
      
      
      // Solo agregar si hay inversiones hasta esta fecha
      if (cantidadHastaFecha > 0) {
        const valor = historico.precio * cantidadHastaFecha
        const rendimiento = valor - importeHastaFecha
        
        
        dataPoints.push({
          fecha: fechaHistorico,
          importe: importeHastaFecha,
          valor: valor,
          rendimiento: rendimiento,
          cantidadAcumulada: cantidadHastaFecha,
          esHistorico: true,
          esInversion: false,
          esActual: false
        })
      }
    })
    
    // Agregar punto actual (último precio disponible)
    const ultimoHistorico = historicosRelevantes[historicosRelevantes.length - 1]
    if (ultimoHistorico && sortedInversiones.length > 0) {
      const totalCantidad = sortedInversiones.reduce((sum, inv) => sum + inv.cantidad, 0)
      const totalImporte = sortedInversiones.reduce((sum, inv) => sum + inv.importe, 0)
      const valorActual = ultimoHistorico.precio * totalCantidad
      const rendimientoActual = valorActual - totalImporte
      
      dataPoints.push({
        fecha: new Date(ultimoHistorico.fecha),
        importe: totalImporte,
        valor: valorActual,
        rendimiento: rendimientoActual,
        cantidadAcumulada: totalCantidad,
        esHistorico: false,
        esInversion: false,
        esActual: true
      })
    }
    
    return dataPoints.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
  }, [inversiones, historicos])

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

  // Generar líneas
  const importeLine = chartData.map(d => `${getX(d.fecha)},${getY(d.importe)}`).join(' ')
  const valorLine = chartData.map(d => `${getX(d.fecha)},${getY(d.valor)}`).join(' ')

  // Formatear valores para tooltip
  const formatFullValue = (val) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: ticker?.moneda || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val)
  }

  // Formatear valores para eje Y
  const formatYValue = (val) => {
    if (Math.abs(val) >= 1000000) {
      return `${(val/1000000).toFixed(1)}M`
    } else if (Math.abs(val) >= 1000) {
      return `${(val/1000).toFixed(1)}K`
    }
    return val.toFixed(0)
  }

  // Manejar movimiento del mouse
  const handleMouseMove = (e) => {
    if (!svgRef.current || chartData.length === 0) return
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const scaleX = width / rect.width
    const x = (e.clientX - rect.left) * scaleX
    
    // Encontrar el punto más cercano
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
    
    if (closestIdx >= 0) {
      setHoverPoint(closestIdx)
    } else {
      setHoverPoint(null)
    }
  }
  
  const handleMouseLeave = () => {
    setHoverPoint(null)
  }

  if (loadingHistoricos) {
    return (
      <div style={{ margin: '20px 0', textAlign: 'center', padding: '40px' }}>
        <div style={{ 
          display: 'inline-block',
          width: '40px',
          height: '40px',
          border: '4px solid #f3f4f6',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '16px', color: '#6b7280' }}>Cargando datos históricos...</p>
      </div>
    )
  }

  // Debug: Log de datos para verificar que se están cargando
  console.log('InvestmentChart Debug:', {
    chartData: chartData.length,
    inversiones: inversiones.length,
    historicos: historicos.length,
    minFecha,
    maxFecha,
    minValor,
    maxValor,
    rangeFecha,
    rangeValor
  })

  // Si no hay datos para mostrar, mostrar mensaje
  if (chartData.length === 0) {
    return (
      <div style={{ margin: '20px 0', textAlign: 'center', padding: '40px' }}>
        <p style={{ color: '#6b7280' }}>No hay datos suficientes para mostrar el gráfico</p>
        <p style={{ color: '#9ca3af', fontSize: '14px' }}>
          Inversiones: {inversiones.length}, Históricos: {historicos.length}
        </p>
      </div>
    )
  }

  return (
    <div style={{ margin: '20px 0' }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      {/* Estado de verificación de huecos */}
      {gapStatus && (
        <div style={{
          marginBottom: '12px',
          padding: '8px 12px',
          backgroundColor: gapStatus.includes('✅') ? '#f0f9ff' : 
                          gapStatus.includes('❌') ? '#fef2f2' : '#fef3c7',
          border: `1px solid ${gapStatus.includes('✅') ? '#0ea5e9' : 
                                gapStatus.includes('❌') ? '#ef4444' : '#f59e0b'}`,
          borderRadius: '6px',
          fontSize: '13px',
          color: gapStatus.includes('✅') ? '#0c4a6e' : 
                 gapStatus.includes('❌') ? '#991b1b' : '#92400e'
        }}>
          {gapStatus}
        </div>
      )}
      
      {/* Layout de dos columnas: Gráfico + Resumen Financiero */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '16px' }}>
        {/* Gráfico (columna izquierda) */}
        <div style={{ flex: 2 }}>
          <div style={{ 
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <svg 
              ref={svgRef}
              width={width} 
              height={height} 
              style={{ display: 'block', margin: '0 auto', cursor: 'crosshair' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {/* Fondo del gráfico */}
              <rect
                x={margin.left}
                y={margin.top}
                width={chartWidth}
                height={chartHeight}
                fill="white"
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              
              {/* Etiquetas del eje Y con grid horizontal */}
              {[...Array(5)].map((_, i) => {
                const y = margin.top + (chartHeight / 4) * i
                const value = maxValor - (maxValor - minValor) * (i / 4)
                return (
                  <g key={`y-${i}`}>
                    <line
                      x1={margin.left}
                      y1={y}
                      x2={margin.left + chartWidth}
                      y2={y}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                    <text
                      x={margin.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#64748b"
                    >
                      {formatYValue(value)}
                    </text>
                  </g>
                )
              })}
              
              {/* Etiquetas del eje X */}
              {chartData.filter((_, i) => i % Math.ceil(chartData.length / 4) === 0 || i === chartData.length - 1).map((d, index) => (
                <text
                  key={`x-label-${index}`}
                  x={getX(d.fecha)}
                  y={margin.top + chartHeight + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                >
                  {fmtDateLima(d.fecha)}
                </text>
              ))}
              
              {/* Línea de inversión (importe acumulado) */}
              <polyline
                points={importeLine}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={3}
                strokeDasharray="5,5"
              />
              
              {/* Línea de valor actual (verde) */}
              <polyline
                points={valorLine}
                fill="none"
                stroke="#10b981"
                strokeWidth={3}
              />
              
              {/* Puntos de inversión (azules) */}
              {chartData.filter(d => d.esInversion).map((d, index) => (
                <circle
                  key={`inv-${index}`}
                  cx={getX(d.fecha)}
                  cy={getY(d.valor)}
                  r={5}
                  fill="#3b82f6"
                  stroke="white"
                  strokeWidth={2}
                />
              ))}
              
              {/* Puntos históricos intermedios (grises pequeños) */}
              {chartData.filter(d => d.esHistorico).map((d, index) => (
                <circle
                  key={`hist-${index}`}
                  cx={getX(d.fecha)}
                  cy={getY(d.valor)}
                  r={2}
                  fill="#6b7280"
                  stroke="white"
                  strokeWidth={1}
                />
              ))}
              
              {/* Punto actual */}
              {chartData.filter(d => d.esActual).map((d, index) => (
                <circle
                  key={`current-${index}`}
                  cx={getX(d.fecha)}
                  cy={getY(d.valor)}
                  r={6}
                  fill="#10b981"
                  stroke="white"
                  strokeWidth={3}
                />
              ))}

              {/* Tooltip interactivo */}
              {hoverPoint !== null && chartData[hoverPoint] && (
                <>
                  {/* Línea vertical */}
                  <line 
                    x1={getX(chartData[hoverPoint].fecha)} 
                    y1={margin.top} 
                    x2={getX(chartData[hoverPoint].fecha)} 
                    y2={margin.top + chartHeight}
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="5,5"
                  />
                  
                  {/* Punto destacado en línea de inversión */}
                  <circle 
                    cx={getX(chartData[hoverPoint].fecha)} 
                    cy={getY(chartData[hoverPoint].importe)} 
                    r="5" 
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth="2"
                  />
                  
                  {/* Punto destacado en línea de valor */}
                  <circle 
                    cx={getX(chartData[hoverPoint].fecha)} 
                    cy={getY(chartData[hoverPoint].valor)} 
                    r="5" 
                    fill="#10b981"
                    stroke="white"
                    strokeWidth="2"
                  />
                  
                  {/* Tooltip card */}
                  {(() => {
                    const tooltipX = getX(chartData[hoverPoint].fecha)
                    const tooltipWidth = 200
                    const tooltipHeight = 180
                    let finalX = tooltipX + 10
                    
                    // Si está muy a la derecha, mostrarlo a la izquierda
                    if (finalX + tooltipWidth > width - margin.right) {
                      finalX = tooltipX - tooltipWidth - 10
                    }
                    
                    const finalY = margin.top + 20
                    const point = chartData[hoverPoint]
                    const date = new Date(point.fecha)
                    const dateLabel = date.toLocaleDateString('es-PE', { 
                      day: '2-digit', 
                      month: 'short',
                      year: 'numeric'
                    })
                    
                    return (
                      <g>
                        {/* Sombra del tooltip */}
                        <rect 
                          x={finalX + 2} 
                          y={finalY + 2} 
                          width={tooltipWidth} 
                          height={tooltipHeight}
                          fill="rgba(0,0,0,0.15)"
                          rx="6"
                        />
                        
                        {/* Fondo del tooltip */}
                        <rect 
                          x={finalX} 
                          y={finalY} 
                          width={tooltipWidth} 
                          height={tooltipHeight}
                          fill="white"
                          stroke="#e5e7eb"
                          strokeWidth="1.5"
                          rx="6"
                        />
                        
                        {/* Fecha */}
                        <text 
                          x={finalX + 12} 
                          y={finalY + 18} 
                          fontSize="11" 
                          fill="#6b7280"
                          fontWeight="600"
                        >
                          {dateLabel}
                        </text>
                        
                        {/* Inversión Acumulada */}
                        <circle
                          cx={finalX + 12}
                          cy={finalY + 38}
                          r="3"
                          fill="#3b82f6"
                        />
                        <text 
                          x={finalX + 20} 
                          y={finalY + 42} 
                          fontSize="10" 
                          fill="#374151"
                        >
                          Inversión:
                        </text>
                        <text 
                          x={finalX + tooltipWidth - 12} 
                          y={finalY + 42} 
                          fontSize="10" 
                          fill="#111827"
                          fontWeight="600"
                          textAnchor="end"
                        >
                          {formatFullValue(point.importe)}
                        </text>
                        
                        {/* Valor Actual */}
                        <circle
                          cx={finalX + 12}
                          cy={finalY + 60}
                          r="3"
                          fill="#10b981"
                        />
                        <text 
                          x={finalX + 20} 
                          y={finalY + 64} 
                          fontSize="10" 
                          fill="#374151"
                        >
                          Valor:
                        </text>
                        <text 
                          x={finalX + tooltipWidth - 12} 
                          y={finalY + 64} 
                          fontSize="10" 
                          fill="#111827"
                          fontWeight="600"
                          textAnchor="end"
                        >
                          {formatFullValue(point.valor)}
                        </text>
                        
                        {/* Precio del valor en esa fecha */}
                        <text 
                          x={finalX + 12} 
                          y={finalY + 84} 
                          fontSize="10" 
                          fill="#374151"
                        >
                          Precio:
                        </text>
                        <text 
                          x={finalX + tooltipWidth - 12} 
                          y={finalY + 84} 
                          fontSize="10" 
                          fill="#111827"
                          fontWeight="600"
                          textAnchor="end"
                        >
                          {formatFullValue(point.valor / point.cantidadAcumulada || 0)}
                        </text>
                        
                        {/* Cantidad acumulada */}
                        <text 
                          x={finalX + 12} 
                          y={finalY + 106} 
                          fontSize="10" 
                          fill="#374151"
                        >
                          Cantidad:
                        </text>
                        <text 
                          x={finalX + tooltipWidth - 12} 
                          y={finalY + 106} 
                          fontSize="10" 
                          fill="#111827"
                          fontWeight="600"
                          textAnchor="end"
                        >
                          {(point.cantidadAcumulada || 0).toFixed(2)}
                        </text>
                        
                        {/* Rendimiento */}
                        <text 
                          x={finalX + 12} 
                          y={finalY + 128} 
                          fontSize="10" 
                          fill="#374151"
                        >
                          Rendimiento:
                        </text>
                        <text 
                          x={finalX + tooltipWidth - 12} 
                          y={finalY + 128} 
                          fontSize="10" 
                          fill={point.rendimiento >= 0 ? '#10b981' : '#ef4444'}
                          fontWeight="600"
                          textAnchor="end"
                        >
                          {formatFullValue(point.rendimiento)}
                        </text>
                        
                        {/* Rentabilidad */}
                        <text 
                          x={finalX + 12} 
                          y={finalY + 150} 
                          fontSize="10" 
                          fill="#374151"
                        >
                          Rentabilidad:
                        </text>
                        <text 
                          x={finalX + tooltipWidth - 12} 
                          y={finalY + 150} 
                          fontSize="10" 
                          fill={point.rendimiento >= 0 ? '#10b981' : '#ef4444'}
                          fontWeight="600"
                          textAnchor="end"
                        >
                          {((point.rendimiento / point.importe) * 100).toFixed(2)}%
                        </text>
                      </g>
                    )
                  })()}
                </>
              )}
            </svg>
            
            {/* Leyenda */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '20px', 
              marginTop: '16px',
              fontSize: '13px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ 
                  width: '16px', 
                  height: '3px', 
                  backgroundColor: '#3b82f6',
                  borderStyle: 'dashed'
                }}></div>
                <span>Inversión Acumulada</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ 
                  width: '16px', 
                  height: '3px', 
                  backgroundColor: '#10b981'
                }}></div>
                <span>Valor Actual</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  backgroundColor: '#3b82f6',
                  borderRadius: '50%'
                }}></div>
                <span>Inversiones</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ 
                  width: '6px', 
                  height: '6px', 
                  backgroundColor: '#6b7280',
                  borderRadius: '50%'
                }}></div>
                <span>Precios Históricos</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Resumen Financiero (columna derecha) */}
        <div style={{ 
          flex: 1, 
          minWidth: '250px',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <h4 style={{ 
            margin: '0 0 16px 0', 
            color: '#1e293b',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            📊 Resumen Financiero
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ 
                fontSize: '13px', 
                color: '#64748b', 
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                Monto Total Invertido
              </div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#1e293b'
              }}>
                {fmtCurr(chartData[chartData.length - 1]?.importe || 0, ticker?.moneda)}
              </div>
            </div>
            
            <div>
              <div style={{ 
                fontSize: '13px', 
                color: '#64748b', 
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                Monto Actual
              </div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#1e293b'
              }}>
                {fmtCurr(chartData[chartData.length - 1]?.valor || 0, ticker?.moneda)}
              </div>
            </div>
            
            <div>
              <div style={{ 
                fontSize: '13px', 
                color: '#64748b', 
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                Rendimiento
              </div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: '600',
                color: (chartData[chartData.length - 1]?.rendimiento || 0) >= 0 ? '#10b981' : '#ef4444'
              }}>
                {fmtCurr(chartData[chartData.length - 1]?.rendimiento || 0, ticker?.moneda)}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: (chartData[chartData.length - 1]?.rendimiento || 0) >= 0 ? '#10b981' : '#ef4444',
                marginTop: '2px'
              }}>
                ({((chartData[chartData.length - 1]?.rendimiento || 0) / (chartData[chartData.length - 1]?.importe || 1) * 100).toFixed(2)}%)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}