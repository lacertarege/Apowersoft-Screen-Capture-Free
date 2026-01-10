import React from 'react'

export default function AnnualBarChart({ data }) {
    if (!data || data.length === 0) {
        return <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Sin datos</div>
    }

    const width = 800
    const height = 400
    const padding = { top: 40, right: 60, bottom: 60, left: 80 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // Preparar datos para graficar
    const years = data.map(d => d.año)
    const metrics = [
        { key: 'valorInicial', label: 'Vi', color: '#3b82f6' },
        { key: 'aportes', label: 'F', color: '#8b5cf6' },
        { key: 'valorFinal', label: 'Vf', color: '#10b981' },
        { key: 'rendimiento', label: 'Rm', color: '#f59e0b' }
    ]

    // Encontrar valores máximos para escala
    const allValues = data.flatMap(d => [d.valorInicial, d.aportes, d.valorFinal, Math.abs(d.rendimiento)])
    const maxValue = Math.max(...allValues, 0)
    const minValue = Math.min(...data.map(d => d.rendimiento), 0)

    const barWidth = chartWidth / (years.length * metrics.length + years.length)
    const groupWidth = barWidth * metrics.length

    const yScale = (value) => {
        const range = maxValue - minValue
        return chartHeight - ((value - minValue) / range) * chartHeight
    }

    const formatValue = (val) => {
        if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`
        if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}K`
        return val.toFixed(0)
    }

    return (
        <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                {/* Líneas de cuadrícula */}
                {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                    const value = minValue + ratio * (maxValue - minValue)
                    const y = padding.top + yScale(value)
                    return (
                        <g key={ratio}>
                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />
                            <text x={padding.left - 10} y={y + 4} fontSize="11" fill="#6b7280" textAnchor="end">{formatValue(value)}</text>
                        </g>
                    )
                })}

                {/* Barras */}
                {years.map((year, yearIdx) => {
                    const yearData = data[yearIdx]
                    const xStart = padding.left + yearIdx * (groupWidth + barWidth)

                    return (
                        <g key={year}>
                            {metrics.map((metric, metricIdx) => {
                                const value = yearData[metric.key]
                                const x = xStart + metricIdx * barWidth
                                const barHeight = Math.abs(yScale(value) - yScale(0))
                                const y = value >= 0
                                    ? padding.top + yScale(value)
                                    : padding.top + yScale(0)

                                return (
                                    <rect
                                        key={metric.key}
                                        x={x}
                                        y={y}
                                        width={barWidth * 0.8}
                                        height={barHeight}
                                        fill={metric.color}
                                        opacity={0.8}
                                    />
                                )
                            })}
                            {/* Etiqueta del año */}
                            <text
                                x={xStart + groupWidth / 2}
                                y={height - padding.bottom + 25}
                                fontSize="12"
                                fill="#374151"
                                textAnchor="middle"
                                fontWeight="600"
                            >
                                {year}
                            </text>
                        </g>
                    )
                })}

                {/* Leyenda */}
                <g transform={`translate(${padding.left}, ${padding.top - 20})`}>
                    {metrics.map((metric, idx) => (
                        <g key={metric.key} transform={`translate(${idx * 80}, 0)`}>
                            <rect x="0" y="0" width="12" height="12" fill={metric.color} opacity="0.8" />
                            <text x="18" y="10" fontSize="11" fill="#374151">{metric.label}</text>
                        </g>
                    ))}
                </g>

                {/* Etiqueta eje Y */}
                <text
                    x={15}
                    y={height / 2}
                    fontSize="12"
                    fill="#374151"
                    fontWeight="700"
                    transform={`rotate(-90, 15, ${height / 2})`}
                    textAnchor="middle"
                >
                    Valor (USD)
                </text>
            </svg>
        </div>
    )
}
