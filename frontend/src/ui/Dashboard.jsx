import React, { useState, useEffect } from 'react'
import { API } from './config'

export default function Dashboard(){
  const [range, setRange] = useState('all')
  const [data, setData] = useState([])
  const [tipoCambio, setTipoCambio] = useState(null)
  const [currency, setCurrency] = useState('USD')
  const [dashboardInfo, setDashboardInfo] = useState(null)

  useEffect(()=>{
    fetch(`${API}/dashboard/series?range=${range}`).then(r=>r.json()).then(d=>setData(d.items||[]))
  },[range])

  useEffect(()=>{
    fetch(`${API}/config/tipo-cambio?limit=1`).then(r=>r.json()).then(d=>{
      const tc = d?.items?.[0]
      setTipoCambio(tc && (tc.usd_pen!=null) ? tc : null)
    }).catch(()=>setTipoCambio(null))
  }, [])

  useEffect(()=>{
    fetch(`${API}/dashboard/info`).then(r=>r.json()).then(d=>setDashboardInfo(d)).catch(()=>setDashboardInfo(null))
  }, [])

  const SimpleLineChart = ({ series, width=800, height=300, padding=50 }) => {
    const [hoverPoint, setHoverPoint] = useState(null)
    const svgRef = React.useRef(null)
    
    if (!series[0]?.points?.length) return <div style={{textAlign:'center', padding:'40px', color:'#999'}}>Sin datos</div>
    
    const allPoints = series.flatMap(s=>s.points)
    const ys = allPoints.map(p=> p.y)
    const minY = Math.min(...ys, 0)
    const maxY = Math.max(...ys, 1)
    const yRange = (maxY - minY) || 1
    const n = series[0]?.points?.length || 0
    
    const paddingLeft = 80
    const paddingBottom = 40
    const paddingTop = 20
    const paddingRight = 20
    
    const xFor = (i)=> paddingLeft + (n>1 ? (i * (width - paddingLeft - paddingRight) / (n - 1)) : 0)
    const yFor = (v)=> height - paddingBottom - ((v - minY) * (height - paddingTop - paddingBottom) / yRange)
    
    // Formatear valores para eje Y
    const formatValue = (val) => {
      if (Math.abs(val) >= 1000000) {
        return `${(val/1000000).toFixed(1)}M`
      } else if (Math.abs(val) >= 1000) {
        return `${(val/1000).toFixed(1)}K`
      }
      return val.toFixed(0)
    }
    
    // Formatear valores completos para tooltip
    const formatFullValue = (val) => {
      return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(val)
    }
    
    // Manejar movimiento del mouse
    const handleMouseMove = (e) => {
      if (!svgRef.current) return
      const svg = svgRef.current
      const rect = svg.getBoundingClientRect()
      const scaleX = width / rect.width
      const x = (e.clientX - rect.left) * scaleX
      
      // Encontrar el punto más cercano
      let closestIdx = -1
      let minDist = Infinity
      
      for (let i = 0; i < n; i++) {
        const pointX = xFor(i)
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
    
    // Calcular ticks para eje Y (5 divisiones)
    const yTicks = []
    const tickCount = 5
    for (let i = 0; i <= tickCount; i++) {
      const val = minY + (yRange * i / tickCount)
      yTicks.push({ val, y: yFor(val) })
    }
    
    // Calcular ticks para eje X (mostrar fechas estratégicamente)
    const xTicks = []
    const maxXLabels = n < 10 ? n : 8
    const step = Math.max(1, Math.floor(n / maxXLabels))
    
    for (let i = 0; i < n; i += step) {
      const point = series[0].points[i]
      if (point?.date) {
        xTicks.push({ i, date: point.date })
      }
    }
    // Asegurar que incluimos el último punto
    if (n > 1 && xTicks[xTicks.length - 1]?.i !== n - 1) {
      const lastPoint = series[0].points[n - 1]
      if (lastPoint?.date) {
        xTicks.push({ i: n - 1, date: lastPoint.date })
      }
    }
    
    return (
      <svg 
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`} 
        style={{width:'100%', height:'auto', cursor: 'crosshair'}}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Líneas de grid horizontal (valores Y) */}
        {yTicks.map((tick, idx) => (
          <g key={`y-${idx}`}>
            <line 
              x1={paddingLeft} 
              y1={tick.y} 
              x2={width-paddingRight} 
              y2={tick.y} 
              stroke="#e5e7eb" 
              strokeWidth="1"
              strokeDasharray="4,4"
            />
            <text 
              x={paddingLeft - 8} 
              y={tick.y + 4} 
              textAnchor="end" 
              fontSize="11" 
              fill="#666"
            >
              {formatValue(tick.val)}
            </text>
          </g>
        ))}
        
        {/* Ejes principales */}
        <line 
          x1={paddingLeft} 
          y1={height-paddingBottom} 
          x2={width-paddingRight} 
          y2={height-paddingBottom} 
          stroke="#9ca3af" 
          strokeWidth="2"
        />
        <line 
          x1={paddingLeft} 
          y1={paddingTop} 
          x2={paddingLeft} 
          y2={height-paddingBottom} 
          stroke="#9ca3af" 
          strokeWidth="2"
        />
        
        {/* Líneas de datos */}
        {series.map((s, sIdx)=>{
          const d = (s.points||[]).map((p,i)=>`${i===0?'M':'L'} ${xFor(i)} ${yFor(p.y)}`).join(' ')
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" />
              {/* Puntos en la línea */}
              {s.points.map((p,i) => {
                if (i % Math.max(1, Math.floor(n / 20)) === 0 || i === n - 1) {
                  return (
                    <circle 
                      key={`${sIdx}-${i}`} 
                      cx={xFor(i)} 
                      cy={yFor(p.y)} 
                      r="3" 
                      fill={s.color}
                      stroke="white"
                      strokeWidth="1.5"
                    />
                  )
                }
                return null
              })}
            </g>
          )
        })}
        
        {/* Labels de fechas en eje X */}
        {xTicks.map((tick, idx) => {
          const date = new Date(tick.date)
          const label = date.toLocaleDateString('es-PE', { 
            day: '2-digit', 
            month: 'short',
            year: n > 30 ? '2-digit' : undefined
          })
          return (
            <text 
              key={`x-${idx}`}
              x={xFor(tick.i)} 
              y={height - paddingBottom + 20} 
              textAnchor="middle" 
              fontSize="10" 
              fill="#666"
            >
              {label}
            </text>
          )
        })}
        
        {/* Label del eje Y */}
        <text 
          x={15} 
          y={height/2} 
          textAnchor="middle" 
          fontSize="12" 
          fill="#374151"
          fontWeight="600"
          transform={`rotate(-90, 15, ${height/2})`}
        >
          Valor ({currency})
        </text>
        
        {/* Leyenda */}
        <g transform={`translate(${paddingLeft + 20}, ${paddingTop})`}>
          {series.map((s, idx) => (
            <g key={s.name} transform={`translate(${idx * 120}, 0)`}>
              <line x1="0" y1="0" x2="20" y2="0" stroke={s.color} strokeWidth="2.5" />
              <text x="25" y="4" fontSize="11" fill="#374151">{s.name}</text>
            </g>
          ))}
        </g>
        
        {/* Tooltip y línea vertical al hacer hover */}
        {hoverPoint !== null && (
          <>
            {/* Línea vertical */}
            <line 
              x1={xFor(hoverPoint)} 
              y1={paddingTop} 
              x2={xFor(hoverPoint)} 
              y2={height-paddingBottom}
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="5,5"
            />
            
            {/* Puntos destacados en todas las series */}
            {series.map((s, sIdx) => (
              <circle 
                key={`hover-${sIdx}`}
                cx={xFor(hoverPoint)} 
                cy={yFor(s.points[hoverPoint].y)} 
                r="5" 
                fill={s.color}
                stroke="white"
                strokeWidth="2"
              />
            ))}
            
            {/* Tooltip card */}
            {(() => {
              const tooltipX = xFor(hoverPoint)
              const tooltipWidth = 180
              const tooltipHeight = 20 + series.length * 22 + 20
              let finalX = tooltipX + 10
              
              // Si está muy a la derecha, mostrarlo a la izquierda
              if (finalX + tooltipWidth > width - paddingRight) {
                finalX = tooltipX - tooltipWidth - 10
              }
              
              const finalY = paddingTop + 60
              const point = series[0].points[hoverPoint]
              const date = new Date(point.date)
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
                    x={finalX + 10} 
                    y={finalY + 16} 
                    fontSize="11" 
                    fill="#6b7280"
                    fontWeight="600"
                  >
                    {dateLabel}
                  </text>
                  
                  {/* Valores de cada serie */}
                  {series.map((s, idx) => (
                    <g key={`tooltip-${idx}`}>
                      <circle
                        cx={finalX + 10}
                        cy={finalY + 35 + idx * 22}
                        r="3"
                        fill={s.color}
                      />
                      <text 
                        x={finalX + 18} 
                        y={finalY + 39 + idx * 22} 
                        fontSize="10" 
                        fill="#374151"
                      >
                        {s.name}:
                      </text>
                      <text 
                        x={finalX + tooltipWidth - 10} 
                        y={finalY + 39 + idx * 22} 
                        fontSize="10" 
                        fill="#111827"
                        fontWeight="600"
                        textAnchor="end"
                      >
                        {formatFullValue(s.points[hoverPoint].y)}
                      </text>
                    </g>
                  ))}
                </g>
              )
            })()}
          </>
        )}
      </svg>
    )
  }

  const last = data[data.length-1] || {}
  const inv = Number(last.inversionUsd||0)
  const bal = Number(last.balanceUsd||0)
  const rend = bal - inv
  const rentab = inv ? (rend / inv) : 0

  const convertValue = (usdValue) => currency==='PEN' && tipoCambio ? usdValue * tipoCambio.usd_pen : usdValue
  const seriesAB = [
    { name: 'Invertido', color: '#64748b', points: data.map(d=>({ y: convertValue(Number(d.inversionUsd||0)), date: d.fecha })) },
    { name: 'Valor', color: '#2563eb', points: data.map(d=>({ y: convertValue(Number(d.balanceUsd||0)), date: d.fecha })) }
  ]
  const seriesR = [
    { name: 'Rendimiento', color: rend>=0 ? '#16a34a' : '#dc2626', points: data.map(d=>({ y: convertValue(Number(d.balanceUsd||0) - Number(d.inversionUsd||0)), date: d.fecha })) }
  ]

  const firstDate = data[0]?.fecha || '-'
  const lastDate = last?.fecha || '-'

  return (
    <div className="container-fluid">
      <div className="flex-between" style={{marginBottom:8}}>
        <h1 style={{margin:0}}>Dashboard</h1>
        <div className="btn-group">
          {['1w','1m','3m','6m','1y','ytd','all'].map(r=> (
            <button key={r} onClick={()=>setRange(r)} className={`btn btn-sm ${range===r?'btn-primary':''}`}>{r.toUpperCase()}</button>
          ))}
        </div>
        <div className="btn-group">
          <button onClick={()=>setCurrency('USD')} className={`btn btn-sm ${currency==='USD'?'btn-primary':''}`}>USD</button>
          <button onClick={()=>setCurrency('PEN')} className={`btn btn-sm ${currency==='PEN'?'btn-primary':''}`}>PEN</button>
        </div>
      </div>

      <div style={{marginTop:4, display:'flex', gap:16, alignItems:'center'}}>
        {tipoCambio && (
          <div className="text-muted">
            1 USD = {tipoCambio.usd_pen} PEN
          </div>
        )}
        {dashboardInfo && dashboardInfo.primeraInversion && (
          <div className="text-muted">
            Datos desde: {new Date(dashboardInfo.primeraInversion).toLocaleDateString('es-PE')}
            {dashboardInfo.totalInversiones > 0 && ` (${dashboardInfo.totalInversiones} inversiones)`}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex-between">
          <h3 className="card-title">Inversión vs Valor</h3>
        </div>
        <SimpleLineChart series={seriesAB} />
      </div>

      <div className="card" style={{marginTop:12}}>
        <div className="flex-between">
          <h3 className="card-title">Rendimiento</h3>
          <div className="text-muted">{firstDate} → {lastDate}</div>
        </div>
        <SimpleLineChart series={seriesR} />
      </div>
    </div>
  )
}