import React, { useState } from 'react'

export default function BarChart({ data, currency = 'USD', width = 800, height = 300, padding = 50 }) {
  const [hoverBar, setHoverBar] = useState(null)

  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Sin datos</div>
  }

  const maxValue = Math.max(...data.map(d => Math.max(d.inversion_usd, d.valor_actual_usd)))
  const minValue = Math.min(...data.map(d => Math.min(d.inversion_usd, d.valor_actual_usd)))
  const range = maxValue - minValue || 1

  const paddingLeft = 100
  const paddingRight = 20
  const paddingTop = 20
  const paddingBottom = 60

  const barWidth = (width - paddingLeft - paddingRight) / data.length * 0.8
  const barSpacing = (width - paddingLeft - paddingRight) / data.length * 0.2

  const yFor = (value) => height - paddingBottom - ((value - minValue) / range) * (height - paddingTop - paddingBottom)
  const xFor = (index) => paddingLeft + index * (width - paddingLeft - paddingRight) / data.length + barSpacing / 2

  // Formatear valores
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

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1']

  return (
    <div style={{ position: 'relative' }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} stroke="#e5e7eb" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const value = minValue + ratio * range
          const y = yFor(value)
          return (
            <g key={ratio}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={paddingLeft - 10} y={y + 4} fontSize="12" fill="#6b7280" textAnchor="end">{formatValue(value)}</text>
            </g>
          )
        })}
        <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="#e5e7eb" strokeWidth="1" />
        {data.map((item, index) => {
          const x = xFor(index)
          const yInversion = yFor(item.inversion_usd)
          const yValor = yFor(item.valor_actual_usd)
          const barHeightInversion = height - paddingBottom - yInversion
          const barHeightValor = height - paddingBottom - yValor
          const color = colors[index % colors.length]
          return (
            <g key={index}>
              <rect x={x} y={yInversion} width={barWidth} height={barHeightInversion} fill={color} fillOpacity={0.7} onMouseEnter={() => setHoverBar({ index, type: 'inversion', item })} onMouseLeave={() => setHoverBar(null)} style={{ cursor: 'pointer' }} />
              <rect x={x + barWidth * 0.1} y={yValor} width={barWidth * 0.8} height={barHeightValor} fill={color} fillOpacity={1} onMouseEnter={() => setHoverBar({ index, type: 'valor', item })} onMouseLeave={() => setHoverBar(null)} style={{ cursor: 'pointer' }} />
              <text x={x + barWidth / 2} y={height - paddingBottom + 20} fontSize="12" fill="#374151" textAnchor="middle" style={{ transform: (item.plataforma || item.tipo_inversion)?.length > 10 ? 'rotate(-45deg)' : 'none', transformOrigin: `${x + barWidth / 2}px ${height - paddingBottom + 20}px` }}>
                {item.plataforma || item.tipo_inversion}
              </text>
            </g>
          )
        })}
        {hoverBar && (
          <g>
            <rect x={xFor(hoverBar.index) + barWidth / 2 - 90} y={20} width={180} height={100} fill="rgba(0,0,0,0.85)" rx="6" />
            <text x={xFor(hoverBar.index) + barWidth / 2} y={38} fontSize="12" fill="white" textAnchor="middle" fontWeight="700">{hoverBar.item.plataforma || hoverBar.item.tipo_inversion}</text>
            <text x={xFor(hoverBar.index) + barWidth / 2} y={58} fontSize="11" fill="white" textAnchor="middle">Inv: {formatFullValue(hoverBar.item.inversion_usd)}</text>
            <text x={xFor(hoverBar.index) + barWidth / 2} y={73} fontSize="11" fill="white" textAnchor="middle">Val: {formatFullValue(hoverBar.item.valor_actual_usd)}</text>
            <text x={xFor(hoverBar.index) + barWidth / 2} y={88} fontSize="11" fill={hoverBar.item.valor_actual_usd >= hoverBar.item.inversion_usd ? "#4ade80" : "#fb7185"} textAnchor="middle" fontWeight="600">
              Rent: {((hoverBar.item.valor_actual_usd - hoverBar.item.inversion_usd) / (hoverBar.item.inversion_usd || 1) * 100).toFixed(2)}%
            </text>
          </g>
        )}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', fontSize: '12px', color: '#6b7280' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6', opacity: 0.7 }}></div><span>Inversión</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#3b82f6' }}></div><span>Valor Actual</span></div>
      </div>
    </div>
  )
}
