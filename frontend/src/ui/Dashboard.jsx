import React, { useState, useEffect } from 'react'
import { API } from './config'
import BarChart from './BarChart.jsx'
import DualAxisLineChart from './DualAxisLineChart.jsx'
import InvestmentProfitabilityTable from './InvestmentProfitabilityTable.jsx'
import TWRMonthlyTable from './TWRMonthlyTable.jsx'
import AnnualSummaryTable from './AnnualSummaryTable.jsx'
import AnnualBarChart from './AnnualBarChart.jsx'

const ChartControls = ({ range, setRange, currency, setCurrency, showRange = true }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
    <div className="btn-group">
      {showRange && ['1w', '1m', '3m', '6m', '1y', 'ytd', 'all'].map(r => (
        <button key={r} onClick={() => setRange(r)} className={`btn btn-sm ${range === r ? 'btn-primary' : ''}`}>{r.toUpperCase()}</button>
      ))}
    </div>
    <div className="btn-group">
      <button onClick={() => setCurrency('USD')} className={`btn btn-sm ${currency === 'USD' ? 'btn-primary' : ''}`}>USD</button>
      <button onClick={() => setCurrency('PEN')} className={`btn btn-sm ${currency === 'PEN' ? 'btn-primary' : ''}`}>PEN</button>
    </div>
  </div>
)

export default function Dashboard() {
  const [tipoCambio, setTipoCambio] = useState(null)
  const [dashboardInfo, setDashboardInfo] = useState(null)

  // 1. Inversión vs Valor
  const [rangeAB, setRangeAB] = useState('all')
  const [currencyAB, setCurrencyAB] = useState('USD')
  const [dataAB, setDataAB] = useState([])
  const [dividendsAB, setDividendsAB] = useState([])

  // 2. Rendimiento
  const [rangeR, setRangeR] = useState('all')
  const [currencyR, setCurrencyR] = useState('USD')
  const [dataR, setDataR] = useState([])

  // 3. Plataformas
  const [currencyPlatform, setCurrencyPlatform] = useState('USD')
  const [platformData, setPlatformData] = useState([])

  // 4. Tipos
  const [currencyType, setCurrencyType] = useState('USD')
  const [typeData, setTypeData] = useState([])

  // 5. Dual Axis (Inversión vs Rentabilidad)
  const [rangeDual, setRangeDual] = useState('all')
  const [currencyDual, setCurrencyDual] = useState('USD')
  const [investmentProfitabilityData, setInvestmentProfitabilityData] = useState([])
  const [dividendsDual, setDividendsDual] = useState([])

  // Agregado por moneda (Tabla invert-rentab)
  const [evolutionTableData, setEvolutionTableData] = useState([])
  const [tableCurrency, setTableCurrency] = useState('USD')

  // Evolución Mensual
  const [monthlyEvolutionData, setMonthlyEvolutionData] = useState([])
  const [monthlyCurrency, setMonthlyCurrency] = useState('USD')
  const [monthlyLoading, setMonthlyLoading] = useState(true)

  // Resumen Anual
  const [annualEvolutionData, setAnnualEvolutionData] = useState([])
  const [annualLoading, setAnnualLoading] = useState(true)

  // Exchanges
  const [currencyExchange, setCurrencyExchange] = useState('USD')
  const [exchangeData, setExchangeData] = useState([])

  // Fetching
  useEffect(() => {
    fetch(`${API}/dashboard/series?range=${rangeAB}&currency=${currencyAB}`)
      .then(r => r.json())
      .then(d => {
        setDataAB(d.items || [])
        setDividendsAB(d.dividends || [])
      })
  }, [rangeAB, currencyAB])

  useEffect(() => {
    fetch(`${API}/dashboard/series?range=${rangeR}&currency=${currencyR}`).then(r => r.json()).then(d => setDataR(d.items || []))
  }, [rangeR, currencyR])

  useEffect(() => {
    fetch(`${API}/dashboard/by-platform?currency=${currencyPlatform}`).then(r => r.json()).then(d => setPlatformData(d.items || []))
  }, [currencyPlatform])

  useEffect(() => {
    fetch(`${API}/dashboard/by-type?currency=${currencyType}`).then(r => r.json()).then(d => setTypeData(d.items || []))
  }, [currencyType])

  useEffect(() => {
    fetch(`${API}/dashboard/investment-vs-profitability?range=${rangeDual}&currency=${currencyDual}`).then(r => r.json()).then(d => {
      setInvestmentProfitabilityData(d.items || [])
      setDividendsDual(d.dividends || [])
    })
  }, [rangeDual, currencyDual])

  useEffect(() => {
    fetch(`${API}/config/tipo-cambio?limit=1`).then(r => r.json()).then(d => {
      const tc = d?.items?.[0]
      setTipoCambio(tc && (tc.usd_pen != null) ? tc : null)
    }).catch(() => setTipoCambio(null))
  }, [])

  useEffect(() => {
    fetch(`${API}/dashboard/info`).then(r => r.json()).then(d => setDashboardInfo(d)).catch(() => setDashboardInfo(null))
  }, [])

  useEffect(() => {
    fetch(`${API}/dashboard/evolution-by-currency?currency=${tableCurrency}`).then(r => r.json()).then(d => setEvolutionTableData(d.items || [])).catch(() => setEvolutionTableData([]))
  }, [tableCurrency])

  useEffect(() => {
    setMonthlyLoading(true)
    fetch(`${API}/dashboard/evolution-monthly?currency=${monthlyCurrency}`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setMonthlyEvolutionData(d.items || []))
      .catch(() => setMonthlyEvolutionData([]))
      .finally(() => setMonthlyLoading(false))
  }, [monthlyCurrency])

  useEffect(() => {
    setAnnualLoading(true)
    fetch(`${API}/dashboard/evolution-annual`).then(r => r.json()).then(d => setAnnualEvolutionData(d.items || []))
      .catch(() => setAnnualEvolutionData([]))
      .finally(() => setAnnualLoading(false))
  }, [])

  useEffect(() => { // 2. Added useEffect for exchange
    fetch(`${API}/dashboard/by-exchange?currency=${currencyExchange}`).then(r => r.json()).then(d => setExchangeData(d.items || []))
  }, [currencyExchange])

  const SimpleLineChart = ({ series, currency, dividends = [], width = 800, height = 300, padding = 50 }) => {
    const [hoverPoint, setHoverPoint] = useState(null)
    const svgRef = React.useRef(null)

    if (!series?.[0]?.points?.length) return <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Sin datos</div>

    const allPoints = series.flatMap(s => s.points)
    const ys = allPoints.map(p => p.y)
    const minY = Math.min(...ys, 0)
    const maxY = Math.max(...ys, 1)
    const yRange = (maxY - minY) || 1
    const n = series[0]?.points?.length || 0

    const paddingLeft = 80
    const paddingBottom = 40
    const paddingTop = 20
    const paddingRight = 20

    const xFor = (i) => paddingLeft + (n > 1 ? (i * (width - paddingLeft - paddingRight) / (n - 1)) : 0)
    const yFor = (v) => height - paddingBottom - ((v - minY) * (height - paddingTop - paddingBottom) / yRange)

    const formatValue = (val) => {
      if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`
      if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}K`
      return val.toFixed(0)
    }

    const formatFullValue = (val) => {
      return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(val)
    }

    const handleMouseMove = (e) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const scaleX = width / rect.width
      const x = (e.clientX - rect.left) * scaleX
      let bestIdx = 0
      let minDist = Infinity
      for (let i = 0; i < n; i++) {
        const dist = Math.abs(xFor(i) - x)
        if (dist < minDist) {
          minDist = dist
          bestIdx = i
        }
      }
      setHoverPoint(bestIdx)
    }

    const yTicks = [minY, minY + yRange * 0.25, minY + yRange * 0.5, minY + yRange * 0.75, maxY]
    const xTickIndices = n > 10 ? [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1] : Array.from({ length: n }, (_, i) => i)
    const xTicks = xTickIndices.map(i => ({ i, date: series[0].points[i].date }))

    // Spread logic: Assuming series[0] is Invertido and series[1] is Valor, or checking names
    const valorSeries = series.find(s => s.name === 'Valor')
    const invertidoSeries = series.find(s => s.name === 'Invertido')

    let spreadPath = ''
    if (valorSeries && invertidoSeries) {
      const vPoints = valorSeries.points.map((p, i) => `${xFor(i)},${yFor(p.y)}`)
      const iPoints = invertidoSeries.points.map((p, i) => `${xFor(i)},${yFor(p.y)}`)
      spreadPath = [...vPoints, ...iPoints.reverse()].join(' ')
    }

    return (
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverPoint(null)} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        {yTicks.map((v, idx) => (
          <g key={idx}>
            <line x1={paddingLeft} y1={yFor(v)} x2={width - paddingRight} y2={yFor(v)} stroke="#f1f5f9" strokeWidth="1" />
            <text x={paddingLeft - 8} y={yFor(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{formatValue(v)}</text>
          </g>
        ))}

        {/* Spread Area */}
        {spreadPath && (
          <path d={`M ${spreadPath} Z`} fill="rgba(16, 185, 129, 0.1)" stroke="none" />
        )}

        {series.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color === '#3b82f6' && s.name === 'Invertido' ? '#000000' : s.color}
            strokeWidth="1.25"
            strokeLinejoin="round"
            strokeDasharray={s.name === 'Invertido' ? "4,4" : ""}
            points={s.points.map((p, i) => `${xFor(i)},${yFor(p.y)}`).join(' ')}
          />
        ))}

        {xTicks.map((tick, idx) => {
          const dateObj = new Date(tick.date)
          const d = String(dateObj.getUTCDate()).padStart(2, '0')
          const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
          const y = String(dateObj.getUTCFullYear()).slice(-2)
          return (
            <text key={`x-${idx}`} x={xFor(tick.i)} y={height - paddingBottom + 20} textAnchor="middle" fontSize="10" fill="#666">{`${d}.${m}.${y}`}</text>
          )
        })}

        <text x={15} y={height / 2} textAnchor="middle" fontSize="12" fill="#374151" fontWeight="600" transform={`rotate(-90, 15, ${height / 2})`}>Valor ({currency})</text>

        {/* Legend */}
        <g transform={`translate(${paddingLeft + 20}, ${paddingTop})`}>
          {/* Invertido Legend */}
          <g transform={`translate(0, 0)`}>
            <line x1="0" y1="0" x2="20" y2="0" stroke="#000000" strokeWidth="1.25" strokeDasharray="4,4" />
            <text x="25" y="4" fontSize="11" fill="#374151">Inversión Acumulada</text>
          </g>
          {/* Valor Legend */}
          <g transform={`translate(140, 0)`}>
            <line x1="0" y1="0" x2="20" y2="0" stroke="#10b981" strokeWidth="1.25" />
            <text x="25" y="4" fontSize="11" fill="#374151">Valor Actual</text>
          </g>
          {/* Dividendo Legend */}
          <g transform={`translate(240, 0)`}>
            <circle cx="10" cy="0" r="2" fill="#a855f7" />
            <text x="25" y="4" fontSize="11" fill="#374151">Dividendos</text>
          </g>
        </g>

        {/* Dividend Markers */}
        {dividends.map((div, i) => {
          // Find x position from date
          // Dividends array dates might not exactly match series dates if gaps, but usually they do in daily series.
          // Find closest series point index
          if (!valorSeries) return null
          const divDate = new Date(div.date)
          // Assuming series are sorted by date
          // Find index
          const idx = valorSeries.points.findIndex(p => p.date === div.date)
          if (idx === -1) return null

          const cx = xFor(idx)
          const cy = yFor(valorSeries.points[idx].y)

          return (
            <circle key={`div-mark-${i}`} cx={cx} cy={cy} r="2" fill="#a855f7" stroke="white" strokeWidth="1" />
          )
        })}

        {hoverPoint !== null && (
          <>
            <line x1={xFor(hoverPoint)} y1={paddingTop} x2={xFor(hoverPoint)} y2={height - paddingBottom} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5,5" />
            {series.map((s, sIdx) => (
              <circle key={`hover-${sIdx}`} cx={xFor(hoverPoint)} cy={yFor(s.points[hoverPoint].y)} r="2.5" fill={s.name === 'Invertido' ? '#000000' : s.color} stroke="white" strokeWidth="2" />
            ))}
            {(() => {
              const tooltipX = xFor(hoverPoint)
              const tooltipWidth = 200
              const pointDate = series[0].points[hoverPoint].date
              const divOnDate = dividends.find(d => d.date === pointDate)

              const tooltipHeight = 20 + series.length * 22 + (divOnDate ? 25 : 0) + 20

              let finalX = tooltipX + 10
              if (finalX + tooltipWidth > width - paddingRight) finalX = tooltipX - tooltipWidth - 10
              const finalY = paddingTop + 60
              const dateObj = new Date(pointDate)
              const d = String(dateObj.getUTCDate()).padStart(2, '0')
              const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
              const y = String(dateObj.getUTCFullYear()).slice(-2)
              const dateLabel = `${d}.${m}.${y}`

              return (
                <g>
                  <rect x={finalX + 2} y={finalY + 2} width={tooltipWidth} height={tooltipHeight} fill="rgba(0,0,0,0.15)" rx="6" />
                  <rect x={finalX} y={finalY} width={tooltipWidth} height={tooltipHeight} fill="white" stroke="#e5e7eb" strokeWidth="1.5" rx="6" />
                  <text x={finalX + 10} y={finalY + 16} fontSize="11" fill="#6b7280" fontWeight="600">{dateLabel}</text>

                  {series.map((s, idx) => (
                    <g key={`tooltip-${idx}`}>
                      <circle cx={finalX + 10} cy={finalY + 35 + idx * 22} r="1.5" fill={s.name === 'Invertido' ? '#000000' : s.color} />
                      <text x={finalX + 20} y={finalY + 39 + idx * 22} fontSize="11" fill="#4b5563">{s.name === 'Invertido' ? 'Cap. Externo' : s.name}:</text>
                      <text x={finalX + tooltipWidth - 10} y={finalY + 39 + idx * 22} textAnchor="end" fontSize="11" fill="#111827" fontWeight="700">{formatFullValue(s.points[hoverPoint].y)}</text>
                    </g>
                  ))}

                  {divOnDate && (
                    <g transform={`translate(0, ${series.length * 22 + 5})`}>
                      <text x={finalX + 10} y={finalY + 35} fontSize="11" fill="#a855f7" fontWeight="600">💰 Dividendos:</text>
                      <text x={finalX + tooltipWidth - 10} y={finalY + 35} textAnchor="end" fontSize="11" fill="#a855f7" fontWeight="700">{formatFullValue(divOnDate.amount)}</text>
                    </g>
                  )}
                </g>
              )
            })()}
          </>
        )}
      </svg>
    )
  }

  const seriesAB = [
    { name: 'Invertido', color: '#3b82f6', points: dataAB.map(d => ({ date: d.fecha, y: d.inversionUsd })) },
    { name: 'Valor', color: '#10b981', points: dataAB.map(d => ({ date: d.fecha, y: d.balanceUsd })) }
  ]

  const seriesR = [
    { name: 'Valor', color: '#8b5cf6', points: dataR.map(d => ({ date: d.fecha, y: d.balanceUsd })) }
  ]

  const firstDate = dataR.length > 0 ? new Date(dataR[0].fecha).toLocaleDateString('es-PE') : ''
  const lastDate = dataR.length > 0 ? new Date(dataR[dataR.length - 1].fecha).toLocaleDateString('es-PE') : ''

  return (
    <div className="container-fluid">
      {/* 1. Resumen Anual del Portafolio */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <h3 className="card-title">Resumen Anual del Portafolio</h3>
          <div className="text-muted">Consolidado en USD (Benchmarks de referencia)</div>
        </div>
        {annualLoading ? <div style={{ padding: '20px', textAlign: 'center' }}>Cargando resumen anual...</div> : <AnnualSummaryTable data={annualEvolutionData} />}
      </div>

      {/* 2. Gráfico de Barras del Resumen Anual */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="flex-between">
          <h3 className="card-title">Resumen Anual - Visualización</h3>
          <div className="text-muted">Comparativa visual por año</div>
        </div>
        {annualLoading ? <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div> : <AnnualBarChart data={annualEvolutionData} />}
      </div>

      <div className="flex-between" style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {tipoCambio && <div className="text-muted">1 USD = {tipoCambio.usd_pen} PEN</div>}
          {dashboardInfo && dashboardInfo.primeraInversion && (
            <div className="text-muted">
              Datos desde: {new Date(dashboardInfo.primeraInversion).toLocaleDateString('es-PE')}
              {dashboardInfo.totalInversiones > 0 && ` (${dashboardInfo.totalInversiones} inversiones)`}
            </div>
          )}
        </div>
      </div>

      {/* 3. Inversión vs Valor */}
      <div className="card">
        <div className="flex-between">
          <h3 className="card-title">Inversión vs Valor</h3>
        </div>
        <ChartControls range={rangeAB} setRange={setRangeAB} currency={currencyAB} setCurrency={setCurrencyAB} />
        <SimpleLineChart series={seriesAB} currency={currencyAB} dividends={dividendsAB} />
      </div>

      {/* 4. Inversión vs Rendimiento */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="flex-between">
          <h3 className="card-title">Inversión vs Rendimiento</h3>
          <div className="text-muted">Evolución temporal con doble eje</div>
        </div>
        <ChartControls range={rangeDual} setRange={setRangeDual} currency={currencyDual} setCurrency={setCurrencyDual} />
        <DualAxisLineChart data={investmentProfitabilityData} dividends={dividendsDual} currency={currencyDual} width={null} />
        <InvestmentProfitabilityTable data={evolutionTableData} currency={tableCurrency} onCurrencyChange={setTableCurrency} />
      </div>

      {/* 5. Inversiones por Plataforma */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="flex-between">
          <h3 className="card-title">Inversiones por Plataforma</h3>
          <div className="text-muted">Inversión vs Valor Actual</div>
        </div>
        <ChartControls showRange={false} currency={currencyPlatform} setCurrency={setCurrencyPlatform} />
        <BarChart data={platformData} currency={currencyPlatform} />
      </div>

      {/* 6. Inversiones por Exchange */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="flex-between">
          <h3 className="card-title">Inversiones por Exchange</h3>
          <div className="text-muted">Inversión vs Valor Actual</div>
        </div>
        <ChartControls showRange={false} currency={currencyExchange} setCurrency={setCurrencyExchange} />
        <BarChart data={exchangeData} currency={currencyExchange} />
      </div>

      {/* 7. Inversiones por Tipo */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="flex-between">
          <h3 className="card-title">Inversiones por Tipo</h3>
          <div className="text-muted">Inversión vs Valor Actual</div>
        </div>
        <ChartControls showRange={false} currency={currencyType} setCurrency={setCurrencyType} />
        <BarChart data={typeData} currency={currencyType} />
      </div>

      {/* 8. Evolución Mensual del Portafolio */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="flex-between">
          <h3 className="card-title">Evolución Mensual del Portafolio</h3>
          <div className="text-muted">Análisis detallado por mes</div>
        </div>
        {monthlyLoading ? <div style={{ padding: '40px', textAlign: 'center' }}><div style={{ display: 'inline-block', width: '40px', height: '40px', border: '4px solid #f3f4f6', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div><div style={{ marginTop: '16px', color: '#6b7280', fontSize: '14px' }}>Cargando datos...</div><style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style></div> :
          <TWRMonthlyTable data={monthlyEvolutionData} currency={monthlyCurrency} onCurrencyChange={setMonthlyCurrency} />
        }
      </div>
    </div>
  )
}