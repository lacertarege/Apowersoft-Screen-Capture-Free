import React, { useState, useMemo } from 'react'

const getBinarySplitLayout = (data, x, y, width, height) => {
    if (data.length === 0) return []
    if (data.length === 1) {
        return [{
            ...data[0],
            x, y, width, height
        }]
    }

    // Split data into two lists with approximately equal value sum
    const totalValue = data.reduce((sum, item) => sum + item.value, 0)
    let halfValue = 0
    let splitIndex = 0
    for (let i = 0; i < data.length; i++) {
        halfValue += data[i].value
        if (halfValue >= totalValue / 2) {
            splitIndex = i + 1
            break
        }
    }
    // Ensure we at least split one of
    if (splitIndex >= data.length) splitIndex = data.length - 1

    const groupA = data.slice(0, splitIndex)
    const groupB = data.slice(splitIndex)

    const valueA = groupA.reduce((sum, item) => sum + item.value, 0)
    const valueB = groupB.reduce((sum, item) => sum + item.value, 0)

    // Split area
    const isVertical = width > height
    if (isVertical) {
        const widthA = (valueA / totalValue) * width
        const widthB = width - widthA
        return [
            ...getBinarySplitLayout(groupA, x, y, widthA, height),
            ...getBinarySplitLayout(groupB, x + widthA, y, widthB, height)
        ]
    } else {
        const heightA = (valueA / totalValue) * height
        const heightB = height - heightA
        return [
            ...getBinarySplitLayout(groupA, x, y, width, heightA),
            ...getBinarySplitLayout(groupB, x, y + heightA, width, heightB)
        ]
    }
}

export default function TreemapChart({ data, width = 1000, height = 600 }) {
    const [hoverItem, setHoverItem] = useState(null)

    // Calculate layout
    const layout = useMemo(() => {
        if (!data || data.length === 0) return []
        // 1. Level 1: Sectors
        return getBinarySplitLayout(data, 0, 0, width, height).map(sector => {
            // 2. Level 2: Tickers within Sector
            const childrenLayout = getBinarySplitLayout(sector.children, sector.x, sector.y, sector.width, sector.height)
            return {
                ...sector,
                childrenLayout
            }
        })
    }, [data, width, height])

    const getColor = (perf) => {
        // Finviz style: Red (-3%) <-> Black (0%) <-> Green (+3%)
        if (perf > 0) {
            // Scale 0 to 5% -> 0 to 255 opacity/intensity
            const intensity = Math.min(Math.abs(perf) / 3, 1)
            // Base green #10b981
            return `rgba(16, 185, 129, ${0.3 + intensity * 0.7})`
        } else {
            const intensity = Math.min(Math.abs(perf) / 3, 1)
            // Base red #ef4444
            return `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`
        }
    }

    const getTextColor = (perf) => {
        // Ensure text is readable against dark background
        const intensity = Math.min(Math.abs(perf) / 3, 1)
        if (intensity > 0.6) return 'white'
        return '#1e293b' // Dark gray
    }

    if (!data || data.length === 0) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Sin datos disponibles</div>

    return (
        <div style={{ position: 'relative', width, height, background: '#111' }}>
            <svg width={width} height={height} style={{ display: 'block' }}>
                {layout.map((sector, i) => (
                    <g key={i}>
                        {/* Draw Items Only */}
                        {sector.childrenLayout.map((item, j) => {
                            // item.performance is percentage
                            const color = getColor(item.performance)
                            const textColor = getTextColor(item.performance)

                            return (
                                <g key={`${i}-${j}`}
                                    onMouseEnter={() => setHoverItem(item)}
                                    onMouseLeave={() => setHoverItem(null)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <rect
                                        x={item.x}
                                        y={item.y}
                                        width={item.width}
                                        height={item.height}
                                        fill={color}
                                        stroke="#111"
                                        strokeWidth="1"
                                    />
                                    {/* Text Label - Only if box is big enough */}
                                    {item.width > 40 && item.height > 30 && (
                                        <g style={{ pointerEvents: 'none' }}>
                                            <text
                                                x={item.x + item.width / 2}
                                                y={item.y + item.height / 2 - 2}
                                                textAnchor="middle"
                                                fontSize="14"
                                                fontWeight="bold"
                                                fill={textColor}
                                            >
                                                {item.name}
                                            </text>
                                            <text
                                                x={item.x + item.width / 2}
                                                y={item.y + item.height / 2 + 12}
                                                textAnchor="middle"
                                                fontSize="11"
                                                fill={textColor}
                                            >
                                                {item.performance > 0 ? '+' : ''}{item.performance.toFixed(2)}%
                                            </text>
                                        </g>
                                    )}
                                </g>
                            )
                        })}

                        {/* Outline for Sector? Optional, obscures items. Let's rely on item grouping visually */}
                    </g>
                ))}
            </svg>

            {/* Tooltip */}
            {hoverItem && (
                <div style={{
                    position: 'absolute',
                    left: hoverItem.x + hoverItem.width / 2,
                    top: hoverItem.y + hoverItem.height / 2,
                    transform: 'translate(-50%, -100%)',
                    background: 'rgba(0,0,0,0.9)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    border: `1px solid ${hoverItem.performance >= 0 ? '#10b981' : '#ef4444'}`
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{hoverItem.name}</div>
                    <div>Sector: {layout.find(s => s.children.find(c => c.name === hoverItem.name))?.name}</div>
                    <div>Value: ${hoverItem.value.toLocaleString('en-US', { disableGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    <div style={{ color: hoverItem.performance >= 0 ? '#4ade80' : '#fb7185' }}>
                        Unrealized Return: {hoverItem.performance > 0 ? '+' : ''}{hoverItem.performance.toFixed(2)}%
                    </div>
                </div>
            )}
        </div>
    )
}
