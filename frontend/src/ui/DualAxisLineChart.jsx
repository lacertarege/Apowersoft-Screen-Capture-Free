import React, { useState, useEffect, useRef } from 'react'

export default function DualAxisLineChart({ data, currency = 'USD', width = null, height = 400, padding = 50 }) {
  const [hoverPoint, setHoverPoint] = useState(null)
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(width || 800)

  // Calcular ancho del contenedor si no se proporciona
  useEffect(() => {
    if (width === null && containerRef.current) {
      const updateWidth = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          setContainerWidth(rect.width || 800)
        }
      }
      updateWidth()
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }
  }, [width])

  if (!data || data.length === 0) return <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Sin datos</div>

  const chartWidth = width !== null ? width : containerWidth
  const inversionValues = data.map(d => d.inversionUsd)
  const rendimientoValues = data.map(d => d.rendimientoAcumulado || 0)

  const minInversion = Math.min(...inversionValues, 0)
  const maxInversion = Math.max(...inversionValues)
  const minRendimiento = Math.min(...rendimientoValues, 0)
  const maxRendimiento = Math.max(...rendimientoValues)

  const inversionRange = maxInversion - minInversion || 1
  const rendimientoRange = maxRendimiento - minRendimiento || 1

  const paddingLeft = 80
  const paddingRight = 80
  const paddingTop = 20
  const paddingBottom = 40
  const n = data.length

  const xFor = (i) => paddingLeft + (n > 1 ? (i * (chartWidth - paddingLeft - paddingRight) / (n - 1)) : 0)
  const yForInversion = (value) => height - paddingBottom - ((value - minInversion) / inversionRange) * (height - paddingTop - paddingBottom)
  const yForRendimiento = (value) => height - paddingBottom - ((value - minRendimiento) / rendimientoRange) * (height - paddingTop - paddingBottom)

  const formatValue = (val) => {
    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}K`
    return val.toFixed(0)
  }

  const formatFullValue = (val) => {
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-PE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val)
  }

  const inversionPoints = data.map((d, i) => ({ x: xFor(i), y: yForInversion(d.inversionUsd) }))
  const rendimientoPoints = data.map((d, i) => ({ x: xFor(i), y: yForRendimiento(d.rendimientoAcumulado || 0) }))

  // Create STEP path for investment (escalonada - horizontal then vertical)
  const createStepPath = (points) => {
    if (points.length < 2) return ''
    let path = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      // Horizontal line to new X, then vertical to new Y (step-after style)
      path += ` H ${points[i].x} V ${points[i].y}`
    }
    return path
  }

  // Create smooth monotone path for returns (curva suave)
  const createSmoothPath = (points) => {
    if (points.length < 2) return ''
    return points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  }

  // Create area path for gradient fill under returns line
  const createAreaPath = (points) => {
    if (points.length < 2) return ''
    const linePath = createSmoothPath(points)
    const bottomY = height - paddingBottom
    return `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`
  }

  const handleMouseMove = (e) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left

    let closestIdx = 0
    let minDist = Infinity
    for (let i = 0; i < n; i++) {
      const pointX = xFor(i) * (rect.width / chartWidth)
      const dist = Math.abs(pointX - x)
      if (dist < minDist) {
        minDist = dist
        closestIdx = i
      }
    }
    setHoverPoint(closestIdx)
  }

  const handleMouseLeave = () => {
    setHoverPoint(null)
  }

  // Unique ID for gradients
  const gradientId = `returnGradient-${currency}`

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <svg
        width={chartWidth}
        height={height}
        viewBox={`0 0 ${chartWidth} ${height}`}
        style={{ display: 'block', width: '100%', height: 'auto', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Definitions for gradients */}
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <rect width={chartWidth} height={height} fill="white" />

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = yForInversion(minInversion + ratio * inversionRange)
          return <line key={`in-${ratio}`} x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#f3f4f6" strokeWidth="1" />
        })}

        {/* Axes */}
        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} stroke="#e5e7eb" strokeWidth="1" />
        <line x1={chartWidth - paddingRight} y1={paddingTop} x2={chartWidth - paddingRight} y2={height - paddingBottom} stroke="#e5e7eb" strokeWidth="1" />
        <line x1={paddingLeft} y1={height - paddingBottom} x2={chartWidth - paddingRight} y2={height - paddingBottom} stroke="#e5e7eb" strokeWidth="1" />

        {/* Left axis labels (Inversión) */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const val = minInversion + ratio * inversionRange
          return <text key={`l-${ratio}`} x={paddingLeft - 10} y={yForInversion(val) + 4} fontSize="10" fill="#374151" textAnchor="end">{formatValue(val)}</text>
        })}

        {/* Right axis labels (Rendimiento) */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const val = minRendimiento + ratio * rendimientoRange
          return <text key={`r-${ratio}`} x={chartWidth - paddingRight + 10} y={yForRendimiento(val) + 4} fontSize="10" fill="#10b981" fontWeight="600" textAnchor="start">{formatValue(val)}</text>
        })}

        {/* X axis date labels */}
        {data.map((d, i) => {
          if (i % Math.ceil(data.length / 8) === 0) {
            const dateObj = new Date(d.fecha)
            const label = `${String(dateObj.getUTCDate()).padStart(2, '0')}.${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}.${String(dateObj.getUTCFullYear()).slice(-2)}`
            return <text key={i} x={xFor(i)} y={height - paddingBottom + 18} fontSize="9" fill="#6b7280" textAnchor="middle">{label}</text>
          }
          return null
        })}

        {/* Area fill under returns line (gradient) */}
        <path d={createAreaPath(rendimientoPoints)} fill={`url(#${gradientId})`} />

        {/* Inversión Line: STEP (escalonada) + DASHED (punteada) - Black */}
        <path
          d={createStepPath(inversionPoints)}
          fill="none"
          stroke="#1e293b"
          strokeWidth="1.2"
          strokeDasharray="6,4"
          strokeLinecap="round"
        />

        {/* Rendimiento Line: SMOOTH + SOLID (continua) - Green */}
        <path
          d={createSmoothPath(rendimientoPoints)}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover tooltip */}
        {hoverPoint !== null && (
          <g>
            {/* Vertical guide line */}
            <line
              x1={xFor(hoverPoint)}
              y1={paddingTop}
              x2={xFor(hoverPoint)}
              y2={height - paddingBottom}
              stroke="#6b7280"
              strokeWidth="0.6"
              strokeDasharray="4,4"
              opacity="0.5"
            />
            {/* Tooltip box */}
            <rect
              x={Math.min(chartWidth - 180, Math.max(10, xFor(hoverPoint) - 85))}
              y={20}
              width={170}
              height={70}
              fill="rgba(15, 23, 42, 0.95)"
              rx="8"
            />
            <text x={Math.max(95, Math.min(chartWidth - 85, xFor(hoverPoint)))} y={40} fontSize="12" fill="white" textAnchor="middle" fontWeight="700">
              {(() => {
                const dateObj = new Date(data[hoverPoint].fecha)
                return `${String(dateObj.getUTCDate()).padStart(2, '0')}.${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}.${String(dateObj.getUTCFullYear()).slice(-2)}`
              })()}
            </text>
            <text x={Math.max(95, Math.min(chartWidth - 85, xFor(hoverPoint)))} y={58} fontSize="10" fill="#94a3b8" textAnchor="middle">
              Inversión: {formatFullValue(data[hoverPoint].inversionUsd)}
            </text>
            <text x={Math.max(95, Math.min(chartWidth - 85, xFor(hoverPoint)))} y={76} fontSize="11" fill={data[hoverPoint].rendimientoAcumulado >= 0 ? "#4ade80" : "#fb7185"} textAnchor="middle" fontWeight="600">
              Retorno Total: {formatFullValue(data[hoverPoint].rendimientoAcumulado || 0)}
            </text>
            {/* Hover dots on lines */}
            <circle cx={xFor(hoverPoint)} cy={inversionPoints[hoverPoint].y} r={2.4} fill="#1e293b" stroke="white" strokeWidth="1.2" />
            <circle cx={xFor(hoverPoint)} cy={rendimientoPoints[hoverPoint].y} r={2.4} fill="#10b981" stroke="white" strokeWidth="1.2" />
          </g>
        )}

        {/* Y Axis Labels (rotated) */}
        <text x={25} y={height / 2} fontSize="11" fill="#374151" fontWeight="700" transform={`rotate(-90, 25, ${height / 2})`} textAnchor="middle">Inversión ({currency})</text>
        <text x={chartWidth - 25} y={height / 2} fontSize="11" fill="#10b981" fontWeight="700" transform={`rotate(90, ${chartWidth - 25}, ${height / 2})`} textAnchor="middle">Retorno Total ({currency})</text>
      </svg>

      {/* Legend - Solo 2 series */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '12px', fontSize: '12px', color: '#374151' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="12">
            <line x1="0" y1="6" x2="24" y2="6" stroke="#1e293b" strokeWidth="1.2" strokeDasharray="6,4" />
          </svg>
          <span style={{ fontWeight: 500 }}>Inversión</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="12">
            <line x1="0" y1="6" x2="24" y2="6" stroke="#10b981" strokeWidth="1.5" />
          </svg>
          <span style={{ fontWeight: 500 }}>Retorno Total Combinado</span>
        </div>
      </div>
    </div>
  )
}
