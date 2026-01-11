import React from 'react'

export default function AnnualSummaryTable({ data }) {
    if (!data || data.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                Sin datos de resumen anual disponible
            </div>
        )
    }

    const formatCurrency = (val) => {
        if (val === null || val === undefined) return '-'
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val)
    }

    const formatPercentage = (val) => {
        if (val === null || val === undefined) return '-'
        const sign = val >= 0 ? '+' : ''
        return `${sign}${val.toFixed(2)}%`
    }

    const getColorForValue = (val) => {
        if (val === null || val === undefined || val === 0) return '#6b7280'
        return val >= 0 ? '#10b981' : '#ef4444'
    }

    return (
        <div style={{
            overflowX: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            backgroundColor: '#ffffff',
            marginBottom: '20px'
        }}>
            <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px'
            }}>
                <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={headerStyle}>AÑO</th>
                        <th style={headerRightStyle}>VALOR INICIAL (Vi)</th>
                        <th style={headerRightStyle}>FLUJO NETO (F)</th>
                        <th style={headerRightStyle}>DIVIDENDOS</th>
                        <th style={headerRightStyle}>VALOR FINAL (Vf)</th>
                        <th style={headerRightStyle}>REND. (Rm)</th>
                        <th style={headerRightStyle}>% RENT. (Rn)</th>
                        <th style={headerRightStyle}>MAX DD</th>
                        <th style={{ ...headerRightStyle, borderLeft: '1px solid #f1f5f9' }}>S&P 500</th>
                        <th style={headerRightStyle}>S&P/BVL PERU GEN</th>
                        <th style={headerRightStyle}>ALPHA (vs BVL)</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, index) => {
                        const alphaBvl = item.benchmarks?.sp_bvl_gen ? (item.rentabilidad - item.benchmarks.sp_bvl_gen) : null

                        return (
                            <tr
                                key={item.año}
                                style={{
                                    borderBottom: '1px solid #f1f5f9',
                                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#fcfdfe'
                                }}
                            >
                                <td style={{ ...cellStyle, fontWeight: '800', color: '#1e293b' }}>
                                    {item.año}
                                </td>
                                <td style={numericCellStyle}>
                                    {formatCurrency(item.valorInicial)}
                                </td>
                                <td
                                    style={{
                                        ...numericCellStyle,
                                        color: item.aportes > 0 ? '#10b981' : (item.aportes < 0 ? '#f59e0b' : '#94a3b8'),
                                        cursor: 'help'
                                    }}
                                    title={`(+) Depósitos: ${formatCurrency(item.inflows || 0)}\n(-) Retiros: ${formatCurrency(item.outflows || 0)}\n(=) Flujo Neto: ${formatCurrency(item.aportes)}`}
                                >
                                    {formatCurrency(item.aportes)}
                                </td>
                                <td style={{ ...numericCellStyle, color: '#0ea5e9' }}>
                                    {formatCurrency(item.dividendos || 0)}
                                </td>
                                <td style={{ ...numericCellStyle, fontWeight: '600', color: '#1e293b' }}>
                                    {formatCurrency(item.valorFinal)}
                                </td>
                                <td
                                    style={{
                                        ...numericCellStyle,
                                        color: getColorForValue(item.rendimiento),
                                        fontWeight: '600',
                                        cursor: 'help'
                                    }}
                                    title={`Rendimiento Orgánico: ${formatCurrency(item.rendimientoOrganico || 0)}\nEfecto Cambiario (FX): ${formatCurrency(item.efectoFx || 0)}\nDividendos: ${formatCurrency(item.dividendos || 0)}`}
                                >
                                    {formatCurrency(item.rendimiento)}
                                </td>
                                <td style={{ ...numericCellStyle, color: getColorForValue(item.rentabilidad), fontWeight: '700', backgroundColor: 'rgba(16, 185, 129, 0.03)' }}>
                                    {formatPercentage(item.rentabilidad)}
                                </td>
                                <td style={{ ...numericCellStyle, color: '#ef4444', fontWeight: '500' }}>
                                    {item.maxDrawdown ? `${item.maxDrawdown.toFixed(2)}%` : '-'}
                                </td>
                                <td style={{ ...numericCellStyle, color: getColorForValue(item.benchmarks?.sp500), borderLeft: '1px solid #f1f5f9' }}>
                                    {formatPercentage(item.benchmarks?.sp500)}
                                </td>
                                <td style={{ ...numericCellStyle, color: getColorForValue(item.benchmarks?.sp_bvl_gen) }}>
                                    {formatPercentage(item.benchmarks?.sp_bvl_gen)}
                                </td>
                                <td style={{ ...numericCellStyle, color: getColorForValue(alphaBvl), fontWeight: '700' }}>
                                    {alphaBvl !== null ? formatPercentage(alphaBvl) : '-'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

const headerStyle = {
    padding: '14px 16px',
    textAlign: 'left',
    fontWeight: '700',
    color: '#475569',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    fontSize: '11px',
    letterSpacing: '0.5px'
}

const headerRightStyle = {
    ...headerStyle,
    textAlign: 'right'
}

const cellRightStyle = {
    padding: '12px 16px',
    textAlign: 'right',
    color: '#475569'
}

const cellStyle = {
    padding: '12px 16px',
    textAlign: 'left',
    color: '#475569'
}

const numericCellStyle = {
    ...cellRightStyle,
    fontFamily: '"Roboto Mono", monospace',
    letterSpacing: '-0.5px'
}
