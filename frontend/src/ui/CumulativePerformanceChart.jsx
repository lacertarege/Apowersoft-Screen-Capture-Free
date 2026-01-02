import React, { useState, useMemo, useRef } from 'react'

export default function CumulativePerformanceChart({ data, width = 800, height = 300, padding = 50 }) {
  const [hoverPoint, setHoverPoint] = useState(null)
  const svgRef = useRef(null)

  // Todos los cálculos y hooks deben estar aquí, antes de cualquier return condicional
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null
    
    const paddingLeft = 80
    const paddingBottom = 40
    const paddingTop = 20
    const paddingRight = 40

    const allValues = data.map(d => d.cumulative_rendimiento_usd)
    const minValue = Math.min(...allValues, 0)
    const maxValue = Math.max(...allValues, 1)
    const range = (maxValue - minValue) || 1

    const n = data.length

    const xFor = (i) => paddingLeft + (n > 1 ? (i * (width - paddingLeft - paddingRight) / (n - 1)) : 0)
    const yFor = (v) => height - paddingBottom - ((v - minValue) * (height - paddingTop - paddingBottom) / range)

    const formatValue = (val) => {
      if (Math.abs(val) >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`
      }
      if (Math.abs(val) >= 1000) {
        return `${(val / 1000).toFixed(1)}K`
      }
      return val.toFixed(0)
    }

    const formatFullValue = (val) => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
    }

    const xAxisLabels = (() => {
      const labels = []
      const step = Math.ceil(n / 8) // Max 8 labels
      for (let i = 0; i < n; i += step) {
        labels.push({
          x: xFor(i),
          date: new Date(data[i].fecha).toLocaleDateString('es-PE', { month: 'short', day: 'numeric', year: '2-digit' })
        })
      }
      return labels
    })()

    const yAxisLabels = (() => {
      const labels = []
      const numLabels = 5
      for (let i = 0; i <= numLabels; i++) {
        const value = minValue + (range / numLabels) * i
        labels.push({
          y: yFor(value),
          value: formatValue(value)
        })
      }
      return labels
    })()

    const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(d.cumulative_rendimiento_usd)}`).join(' ')

    return {
      paddingLeft,
      paddingBottom,
      paddingTop,
      paddingRight,
      n,
      xFor,
      yFor,
      formatValue,
      formatFullValue,
      xAxisLabels,
      yAxisLabels,
      path,
      data
    }
  }, [data, width, height])

  // Ahora el return condicional está después de todos los hooks
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Sin datos</div>
  }

  if (!chartData) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Cargando...</div>
  }

  const {
    paddingLeft,
    paddingBottom,
    paddingTop,
    paddingRight,
    n,
    xFor,
    yFor,
    formatValue,
    formatFullValue,
    xAxisLabels,
    yAxisLabels,
    path,
    data: chartDataArray
  } = chartData

  const handleMouseMove = (e) => {
    const svg = svgRef.current
    if (!svg) return

    const svgRect = svg.getBoundingClientRect()
    const mouseX = e.clientX - svgRect.left

    const closestPointIndex = chartDataArray.reduce((closestIndex, _, i) => {
      const pointX = xFor(i)
      const currentDiff = Math.abs(pointX - mouseX)
      const closestDiff = Math.abs(xFor(closestIndex) - mouseX)
      return currentDiff < closestDiff ? i : closestIndex
    }, 0)

    setHoverPoint(closestPointIndex)
  }

  const handleMouseLeave = () => {
    setHoverPoint(null)
  }

  const tooltipWidth = 200
  const tooltipHeight = 130

  return (
    <div style={{ position: 'relative', width: width, height: height + paddingBottom + 20 }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ overflow: 'visible' }}
      >
        {/* Grid lines */}
        {yAxisLabels.map((label, i) => (
          <line
            key={`grid-y-${i}`}
            x1={paddingLeft}
            y1={label.y}
            x2={width - paddingRight}
            y2={label.y}
            stroke="#e5e7eb"
            strokeDasharray="2 2"
            strokeWidth="0.5"
          />
        ))}

        {/* X-axis line */}
        <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="#d1d5db" />
        {/* Y-axis line */}
        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} stroke="#d1d5db" />

        {/* X-axis labels */}
        {xAxisLabels.map((label, i) => (
          <text key={`x-label-${i}`} x={label.x} y={height - paddingBottom + 20} fontSize="10" fill="#6b7280" textAnchor="middle">
            {label.date}
          </text>
        ))}

        {/* Y-axis labels */}
        {yAxisLabels.map((label, i) => (
          <text key={`y-label-${i}`} x={paddingLeft - 10} y={label.y + 4} fontSize="10" fill="#6b7280" textAnchor="end">
            ${label.value}
          </text>
        ))}

        {/* Line */}
        <path d={path} fill="none" stroke="#10b981" strokeWidth="2" />

        {/* Data points */}
        {chartDataArray.map((d, i) => (
          <circle
            key={`point-${i}`}
            cx={xFor(i)}
            cy={yFor(d.cumulative_rendimiento_usd)}
            r="3"
            fill="#10b981"
            stroke="white"
            strokeWidth="1"
          />
        ))}

        {/* Hover point indicator */}
        {hoverPoint !== null && (
          <g>
            <line
              x1={xFor(hoverPoint)}
              y1={paddingTop}
              x2={xFor(hoverPoint)}
              y2={height - paddingBottom}
              stroke="#9ca3af"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
            <circle cx={xFor(hoverPoint)} cy={yFor(chartDataArray[hoverPoint].cumulative_rendimiento_usd)} r="5" fill="#10b981" stroke="white" strokeWidth="2" />

            {/* Tooltip */}
            <rect
              x={xFor(hoverPoint) + 10}
              y={yFor(chartDataArray[hoverPoint].cumulative_rendimiento_usd) - tooltipHeight / 2}
              width={tooltipWidth}
              height={tooltipHeight}
              fill="rgba(0,0,0,0.8)"
              rx="4"
            />
            <text x={xFor(hoverPoint) + 20} y={yFor(chartDataArray[hoverPoint].cumulative_rendimiento_usd) - tooltipHeight / 2 + 20} fontSize="12" fill="white" fontWeight="600">
              {new Date(chartDataArray[hoverPoint].fecha).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })}
            </text>
            <text x={xFor(hoverPoint) + 20} y={yFor(chartDataArray[hoverPoint].cumulative_rendimiento_usd) - tooltipHeight / 2 + 40} fontSize="11" fill="white">
              Inversión Acumulada: {formatFullValue(chartDataArray[hoverPoint].cumulative_investment_usd)}
            </text>
            <text x={xFor(hoverPoint) + 20} y={yFor(chartDataArray[hoverPoint].cumulative_rendimiento_usd) - tooltipHeight / 2 + 60} fontSize="11" fill="white">
              Rendimiento Acumulado: {formatFullValue(chartDataArray[hoverPoint].cumulative_rendimiento_usd)}
            </text>
            <text x={xFor(hoverPoint) + 20} y={yFor(chartDataArray[hoverPoint].cumulative_rendimiento_usd) - tooltipHeight / 2 + 80} fontSize="11" fill={chartDataArray[hoverPoint].cumulative_rentabilidad_porcentaje >= 0 ? "#10b981" : "#ef4444"} fontWeight="600">
              Rentabilidad: {chartDataArray[hoverPoint].cumulative_rentabilidad_porcentaje.toFixed(2)}%
            </text>
            <text x={xFor(hoverPoint) + 20} y={yFor(chartDataArray[hoverPoint].cumulative_rendimiento_usd) - tooltipHeight / 2 + 100} fontSize="11" fill="white">
              Valor Total: {formatFullValue(chartDataArray[hoverPoint].cumulative_investment_usd + chartDataArray[hoverPoint].cumulative_rendimiento_usd)}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}