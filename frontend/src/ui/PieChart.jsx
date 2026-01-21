import React, { useState } from 'react'

export default function PieChart({ data, valueKey = 'value', labelKey = 'label', currency = 'USD', width = 300, height = 300 }) {
    const [hoverSlice, setHoverSlice] = useState(null)

    if (!data || data.length === 0) {
        return <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Sin datos</div>
    }

    const validData = data.filter(d => d[valueKey] > 0)
    const total = validData.reduce((acc, cur) => acc + Number(cur[valueKey]), 0)

    // Colors aligned with BarChart palette
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

    let accumulatedAngle = 0
    const radius = Math.min(width, height) / 2 * 0.8
    const cx = width / 2
    const cy = height / 2

    const slices = validData.map((item, index) => {
        const value = Number(item[valueKey])
        const percentage = value / total
        const angle = percentage * 360

        const startAngle = accumulatedAngle
        accumulatedAngle += angle
        const endAngle = accumulatedAngle

        // Calculate path
        const x1 = cx + radius * Math.cos(Math.PI * startAngle / 180)
        const y1 = cy + radius * Math.sin(Math.PI * startAngle / 180)
        const x2 = cx + radius * Math.cos(Math.PI * endAngle / 180)
        const y2 = cy + radius * Math.sin(Math.PI * endAngle / 180)

        // Large arc flag
        const largeArcFlag = angle > 180 ? 1 : 0

        const pathData = [
            `M ${cx} ${cy}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z'
        ].join(' ')

        return {
            path: pathData,
            color: colors[index % colors.length],
            data: item,
            percentage,
            value
        }
    })

    const formatValue = (val) => {
        return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-PE', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val)
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                {slices.map((slice, i) => (
                    <path
                        key={i}
                        d={slice.path}
                        fill={slice.color}
                        stroke="white"
                        strokeWidth="2"
                        onMouseEnter={() => setHoverSlice(slice)}
                        onMouseLeave={() => setHoverSlice(null)}
                        style={{
                            cursor: 'pointer',
                            opacity: hoverSlice && hoverSlice !== slice ? 0.6 : 1,
                            transition: 'opacity 0.2s'
                        }}
                    />
                ))}
            </svg>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {slices.map((slice, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: slice.color }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '600', color: '#374151' }}>{slice.data[labelKey]}</span>
                            <span style={{ color: '#6b7280' }}>
                                {formatValue(slice.value)} ({(slice.percentage * 100).toFixed(1)}%)
                            </span>
                        </div>
                    </div>
                ))}
                <div style={{ marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                    <span style={{ fontWeight: '700', fontSize: '13px' }}>Total: {formatValue(total)}</span>
                </div>
            </div>
        </div>
    )
}
