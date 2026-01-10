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

  const createPath = (points) => {
    if (points.length < 2) return ''
    return points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  }

  const handleMouseMove = (e) => {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = e.clientX - rect.left

    // Find closest point
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
        <rect width={chartWidth} height={height} fill="white" />
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = yForInversion(minInversion + ratio * inversionRange)
          return <line key={`in-${ratio}`} x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="2,2" />
        })}
        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} stroke="#e5e7eb" strokeWidth="2" />
        <line x1={chartWidth - paddingRight} y1={paddingTop} x2={chartWidth - paddingRight} y2={height - paddingBottom} stroke="#e5e7eb" strokeWidth="2" />
        <line x1={paddingLeft} y1={height - paddingBottom} x2={chartWidth - paddingRight} y2={height - paddingBottom} stroke="#e5e7eb" strokeWidth="2" />
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const val = minInversion + ratio * inversionRange
          return <text key={`l-${ratio}`} x={paddingLeft - 10} y={yForInversion(val) + 4} fontSize="11" fill="#4b5563" textAnchor="end">{formatValue(val)}</text>
        })}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const val = minRendimiento + ratio * rendimientoRange
          return <text key={`r-${ratio}`} x={chartWidth - paddingRight + 10} y={yForRendimiento(val) + 4} fontSize="11" fill="#4b5563" textAnchor="start">{formatValue(val)}</text>
        })}
        {data.map((d, i) => {
          if (i % Math.ceil(data.length / 8) === 0) {
            const dateObj = new Date(d.fecha)
            const label = `${String(dateObj.getUTCDate()).padStart(2, '0')}.${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}.${String(dateObj.getUTCFullYear()).slice(-2)}`
            return <text key={i} x={xFor(i)} y={height - paddingBottom + 18} fontSize="10" fill="#6b7280" textAnchor="middle">{label}</text>
          }
          return null
        })}
        <path d={createPath(inversionPoints)} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
        <path d={createPath(rendimientoPoints)} fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="5,3" />
        {hoverPoint !== null && (
          <g>
            <rect x={Math.min(chartWidth - 190, Math.max(10, xFor(hoverPoint) - 90))} y={20} width={180} height={85} fill="rgba(0,0,0,0.85)" rx="6" />
            <text x={Math.max(100, Math.min(chartWidth - 90, xFor(hoverPoint)))} y={38} fontSize="12" fill="white" textAnchor="middle" fontWeight="700">
              {(() => {
                const dateObj = new Date(data[hoverPoint].fecha)
                return `${String(dateObj.getUTCDate()).padStart(2, '0')}.${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}.${String(dateObj.getUTCFullYear()).slice(-2)}`
              })()}
            </text>
            <text x={Math.max(100, Math.min(chartWidth - 90, xFor(hoverPoint)))} y={56} fontSize="11" fill="white" textAnchor="middle">Inv: {formatFullValue(data[hoverPoint].inversionUsd)}</text>
            <text x={Math.max(100, Math.min(chartWidth - 90, xFor(hoverPoint)))} y={71} fontSize="11" fill="white" textAnchor="middle">Val: {formatFullValue(data[hoverPoint].valorActualUsd)}</text>
            <text x={Math.max(100, Math.min(chartWidth - 90, xFor(hoverPoint)))} y={86} fontSize="11" fill={data[hoverPoint].rendimientoAcumulado >= 0 ? "#4ade80" : "#fb7185"} textAnchor="middle" fontWeight="600">Rend: {formatFullValue(data[hoverPoint].rendimientoAcumulado || 0)}</text>
          </g>
        )}
        <text x={15} y={height / 2} fontSize="12" fill="#374151" fontWeight="700" transform={`rotate(-90, 15, ${height / 2})`} textAnchor="middle">Inversión ({currency})</text>
        <text x={chartWidth - 15} y={height / 2} fontSize="12" fill="#374151" fontWeight="700" transform={`rotate(90, ${chartWidth - 15}, ${height / 2})`} textAnchor="middle">Rendimiento ({currency})</text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', fontSize: '12px', color: '#6b7280' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '16px', height: '3px', backgroundColor: '#3b82f6' }}></div><span>Inversión ({currency})</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '16px', height: '3px', backgroundColor: '#10b981', borderTop: '1px dashed #10b981' }}></div><span>Rendimiento ({currency})</span></div>
      </div>
    </div>
  )
}






