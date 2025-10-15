import React, { useState, useEffect, useMemo } from 'react'
import { API } from './config.js'
import { fmtCurr, fmtDateLima } from './utils.js'

export function DividendosView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showResumenModal, setShowResumenModal] = useState(false)
  const [selectedYear, setSelectedYear] = useState(null)

  useEffect(() => {
    loadResumen()
  }, [])

  const loadResumen = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/dividendos/resumen`)
      const d = await r.json().catch(() => ({}))
      setItems(d.items || [])
    } catch (e) {
      console.error('Error loading dividendos resumen:', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  // Obtener todos los años únicos de todos los dividendos
  const allYears = useMemo(() => {
    const years = new Set()
    items.forEach(item => {
      Object.keys(item.dividendos_por_anio || {}).forEach(year => years.add(year))
    })
    return Array.from(years).sort((a, b) => a - b) // Ordenar de menor a mayor (2023, 2024, 2025...)
  }, [items])

  const handleRowClick = (ticker) => {
    setSelectedTicker(ticker)
    setShowDetailModal(true)
  }

  const handleRegisterDividend = (ticker) => {
    setSelectedTicker(ticker)
    setShowRegisterModal(true)
  }

  // Calcular totales globales por año y mercado
  const totalesGlobales = useMemo(() => {
    const totales = {}
    
    // Totales por año y mercado
    allYears.forEach(year => {
      totales[year] = { 
        NYSE: { USD: 0, PEN: 0 },
        BVL: { USD: 0, PEN: 0 }
      }
    })
    
    items.forEach(item => {
      // Sumar por año y mercado
      allYears.forEach(year => {
        const yearMercadoData = item.dividendos_por_anio_mercado?.[year]
        if (yearMercadoData) {
          totales[year].NYSE.USD += yearMercadoData.NYSE?.USD || 0
          totales[year].NYSE.PEN += yearMercadoData.NYSE?.PEN || 0
          totales[year].BVL.USD += yearMercadoData.BVL?.USD || 0
          totales[year].BVL.PEN += yearMercadoData.BVL?.PEN || 0
        }
      })
    })
    
    return totales
  }, [items, allYears])

  // Establecer año inicial al más reciente
  useEffect(() => {
    if (!selectedYear && allYears.length > 0) {
      setSelectedYear(allYears[allYears.length - 1])
    }
  }, [allYears, selectedYear])

  // Años a mostrar según el filtro (siempre un solo año)
  const yearsToShow = useMemo(() => {
    return selectedYear ? [selectedYear] : []
  }, [selectedYear])

  return (
    <div className="container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
        <h2 style={{margin:0}}>Dividendos</h2>
        <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
          <button 
            className="btn btn-primary"
            onClick={() => setShowResumenModal(true)}
            style={{padding:'8px 16px', fontSize:'14px'}}
          >
            📊 Ver Resumen General
          </button>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <label style={{fontWeight:'500'}}>Año:</label>
            <select 
              value={selectedYear || ''} 
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                padding:'8px 12px',
                border:'1px solid #d1d5db',
                borderRadius:'4px',
                backgroundColor:'white',
                fontSize:'14px',
                cursor:'pointer'
              }}
            >
              {allYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Cargando resumen de dividendos...</p>
      ) : items.length === 0 ? (
        <div className="card">
          <p>No hay acciones o ETFs con inversiones para mostrar dividendos.</p>
        </div>
      ) : (
        <div className="card">
          <table style={{margin:0}}>
            <colgroup>
              <col style={{width:'100px'}} />
              <col style={{width:'250px'}} />
              <col style={{width:'100px'}} />
              <col style={{width:'100px'}} />
              <col style={{width:'100px'}} />
              <col style={{width:'100px'}} />
              <col style={{width:'120px'}} />
            </colgroup>
            <thead>
              {/* Primera fila: encabezados de mercado */}
              <tr>
                <th rowSpan="2" style={{verticalAlign:'middle'}}>Ticker</th>
                <th rowSpan="2" style={{verticalAlign:'middle'}}>Empresa</th>
                <th colSpan="2" style={{textAlign:'center', borderBottom:'1px solid #d1d5db'}}>NYSE</th>
                <th colSpan="2" style={{textAlign:'center', borderBottom:'1px solid #d1d5db'}}>BVL</th>
                <th rowSpan="2" style={{textAlign:'center', verticalAlign:'middle'}}>Acciones</th>
              </tr>
              {/* Segunda fila: subencabezados de moneda */}
              <tr>
                <th style={{textAlign:'right'}}>USD</th>
                <th style={{textAlign:'right'}}>PEN</th>
                <th style={{textAlign:'right'}}>USD</th>
                <th style={{textAlign:'right'}}>PEN</th>
              </tr>
            </thead>
          </table>
          
          <div style={{maxHeight:'calc(70vh - 86px)', overflow:'auto', marginTop:'-1px'}}>
            <table style={{margin:0}}>
              <colgroup>
                <col style={{width:'100px'}} />
                <col style={{width:'250px'}} />
                <col style={{width:'100px'}} />
                <col style={{width:'100px'}} />
                <col style={{width:'100px'}} />
                <col style={{width:'100px'}} />
                <col style={{width:'120px'}} />
              </colgroup>
              <tbody>
                {items.map(item => (
                  <tr key={item.ticker_id} onClick={() => handleRowClick(item)} style={{ cursor: 'pointer' }}>
                    <td><strong>{item.ticker}</strong></td>
                    <td>{item.nombre}</td>
                    {selectedYear && (() => {
                      const yearMercadoData = item.dividendos_por_anio_mercado?.[selectedYear] || {
                        NYSE: { USD: 0, PEN: 0 },
                        BVL: { USD: 0, PEN: 0 }
                      }
                      return (
                        <>
                          {/* NYSE */}
                          <td style={{textAlign:'right'}}>
                            {yearMercadoData.NYSE?.USD ? fmtCurr(yearMercadoData.NYSE.USD, 'USD').replace('$ ', '') : '-'}
                          </td>
                          <td style={{textAlign:'right'}}>
                            {yearMercadoData.NYSE?.PEN ? fmtCurr(yearMercadoData.NYSE.PEN, 'PEN').replace('S/ ', '') : '-'}
                          </td>
                          {/* BVL */}
                          <td style={{textAlign:'right'}}>
                            {yearMercadoData.BVL?.USD ? fmtCurr(yearMercadoData.BVL.USD, 'USD').replace('$ ', '') : '-'}
                          </td>
                          <td style={{textAlign:'right'}}>
                            {yearMercadoData.BVL?.PEN ? fmtCurr(yearMercadoData.BVL.PEN, 'PEN').replace('S/ ', '') : '-'}
                          </td>
                        </>
                      )
                    })()}
                    <td style={{textAlign:'center'}}>
                      <button 
                        className="btn btn-sm" 
                        onClick={(e) => { e.stopPropagation(); handleRegisterDividend(item) }}
                        style={{padding:'4px 8px', fontSize:'12px'}}
                      >
                        ➕ Nuevo
                      </button>
                    </td>
                  </tr>
                ))}
                
                {/* Fila de TOTAL GLOBAL */}
                <tr style={{
                  backgroundColor: '#374151',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1.05em'
                }}>
                  <td colSpan="2" style={{textAlign:'right', paddingRight:'12px'}}>
                    TOTAL GLOBAL
                  </td>
                  {selectedYear && (() => {
                    const totales = totalesGlobales[selectedYear] || {
                      NYSE: { USD: 0, PEN: 0 },
                      BVL: { USD: 0, PEN: 0 }
                    }
                    return (
                      <>
                        {/* NYSE */}
                        <td style={{textAlign:'right'}}>
                          {totales.NYSE?.USD > 0 ? fmtCurr(totales.NYSE.USD, 'USD').replace('$ ', '') : '-'}
                        </td>
                        <td style={{textAlign:'right'}}>
                          {totales.NYSE?.PEN > 0 ? fmtCurr(totales.NYSE.PEN, 'PEN').replace('S/ ', '') : '-'}
                        </td>
                        {/* BVL */}
                        <td style={{textAlign:'right'}}>
                          {totales.BVL?.USD > 0 ? fmtCurr(totales.BVL.USD, 'USD').replace('$ ', '') : '-'}
                        </td>
                        <td style={{textAlign:'right'}}>
                          {totales.BVL?.PEN > 0 ? fmtCurr(totales.BVL.PEN, 'PEN').replace('S/ ', '') : '-'}
                        </td>
                      </>
                    )
                  })()}
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showDetailModal && selectedTicker && (
        <DetailDividendosModal
          ticker={selectedTicker}
          onClose={() => setShowDetailModal(false)}
          onDividendRegistered={loadResumen}
          onOpenRegisterModal={() => { setShowDetailModal(false); setShowRegisterModal(true) }}
        />
      )}

      {showRegisterModal && selectedTicker && (
        <RegisterDividendoModal
          ticker={selectedTicker}
          onClose={() => setShowRegisterModal(false)}
          onSave={() => {
            setShowRegisterModal(false)
            loadResumen()
          }}
        />
      )}

      {showResumenModal && (
        <ResumenGeneralModal
          totalesGlobales={totalesGlobales}
          allYears={allYears}
          onClose={() => setShowResumenModal(false)}
        />
      )}
    </div>
  )
}

// Modal de detalle de dividendos
function DetailDividendosModal({ ticker, onClose, onDividendRegistered, onOpenRegisterModal }) {
  const [dividendos, setDividendos] = useState([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [editando, setEditando] = useState(null)
  const [tiposCambio, setTiposCambio] = useState({})

  useEffect(() => {
    loadDividendos()
  }, [ticker])

  const loadDividendos = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/dividendos/ticker/${ticker.ticker_id}`)
      const d = await r.json().catch(() => ({}))
      const divs = d.dividendos || []
      
      // Ordenar por fecha de más antigua a más reciente
      divs.sort((a, b) => a.fecha.localeCompare(b.fecha))
      
      setDividendos(divs)
      
      // Cargar tipos de cambio para las fechas de los dividendos
      if (divs.length > 0) {
        await loadTiposCambio(divs.map(div => div.fecha))
      }
    } catch (e) {
      console.error('Error loading ticker dividends:', e)
      setDividendos([])
    } finally {
      setLoading(false)
    }
  }

  const loadTiposCambio = async (fechas) => {
    try {
      // Cargar todos los tipos de cambio (últimos 1000 para tener histórico)
      const r = await fetch(`${API}/config/tipo-cambio?limit=1000`)
      const d = await r.json().catch(() => ({}))
      const items = d.items || []
      
      // Crear un mapa de fecha => tipo de cambio
      const tcMap = {}
      items.forEach(tc => {
        tcMap[tc.fecha] = tc.usd_pen
      })
      
      setTiposCambio(tcMap)
    } catch (e) {
      console.error('Error loading tipos de cambio:', e)
      setTiposCambio({})
    }
  }

  const getTipoCambio = (fecha) => {
    return tiposCambio[fecha] || null
  }

  const getValorEnSoles = (dividendo) => {
    if (dividendo.moneda === 'PEN') {
      return dividendo.monto
    }
    const tc = getTipoCambio(dividendo.fecha)
    if (tc) {
      return dividendo.monto * tc
    }
    return null
  }

  const handleEdit = (dividendo) => {
    setEditando(dividendo)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este dividendo?')) return
    setDeleting(id)
    try {
      const r = await fetch(`${API}/dividendos/${id}`, { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) {
        throw new Error(d.error || 'No se pudo eliminar el dividendo')
      }
      alert('Dividendo eliminado exitosamente')
      loadDividendos()
      onDividendRegistered()
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const totalDividendos = useMemo(() => {
    return dividendos.reduce((sum, d) => sum + (d.monto || 0), 0)
  }, [dividendos])

  const totalEnSoles = useMemo(() => {
    return dividendos.reduce((sum, d) => {
      const valorSoles = getValorEnSoles(d)
      return sum + (valorSoles || 0)
    }, 0)
  }, [dividendos, tiposCambio])

  // Agrupar dividendos por año para mostrar subtotales
  const dividendosPorAnio = useMemo(() => {
    const grupos = {}
    dividendos.forEach(d => {
      const anio = d.fecha.substring(0, 4)
      if (!grupos[anio]) {
        grupos[anio] = []
      }
      grupos[anio].push(d)
    })
    return grupos
  }, [dividendos])

  const calcularSubtotalAnio = (divs) => {
    const subtotalUSD = divs.reduce((sum, d) => sum + (d.moneda === 'USD' ? d.monto : 0), 0)
    const subtotalPEN = divs.reduce((sum, d) => {
      const valorSoles = getValorEnSoles(d)
      return sum + (valorSoles || 0)
    }, 0)
    return { USD: subtotalUSD, PEN: subtotalPEN }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{margin:0}}>Dividendos de {ticker.ticker} - {ticker.nombre}</h3>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 8px'
            }}
          >
            &times;
          </button>
        </div>
        
        <div style={{padding: '24px'}}>
          {loading ? (
            <p>Cargando dividendos...</p>
          ) : dividendos.length === 0 ? (
            <div>
              <p>No hay dividendos registrados para este ticker.</p>
              <button className="btn btn-primary" onClick={onOpenRegisterModal} style={{marginTop:'12px'}}>
                ➕ Registrar primer dividendo
              </button>
            </div>
          ) : (
            <>
              <div style={{overflowX:'auto'}}>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Mercado</th>
                      <th style={{textAlign:'right'}}>Monto</th>
                      <th style={{textAlign:'right'}}>Tipo de Cambio</th>
                      <th style={{textAlign:'right'}}>Valor en S/</th>
                      <th style={{textAlign:'center'}}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(dividendosPorAnio).sort().map(anio => {
                      const divsDelAnio = dividendosPorAnio[anio]
                      const subtotal = calcularSubtotalAnio(divsDelAnio)
                      
                      return (
                        <React.Fragment key={`anio-${anio}`}>
                          {/* Dividendos del año */}
                          {divsDelAnio.map(d => {
                            const tc = getTipoCambio(d.fecha)
                            const valorSoles = getValorEnSoles(d)
                            return (
                              <tr key={d.id}>
                                <td>{fmtDateLima(d.fecha)}</td>
                                <td>{d.mercado || '-'}</td>
                                <td style={{textAlign:'right'}}>{fmtCurr(d.monto, d.moneda)}</td>
                                <td style={{textAlign:'right'}}>
                                  {d.moneda === 'USD' ? (tc ? tc.toFixed(3) : '-') : '-'}
                                </td>
                                <td style={{textAlign:'right'}}>
                                  {valorSoles !== null ? fmtCurr(valorSoles, 'PEN') : '-'}
                                </td>
                                <td style={{textAlign:'center'}}>
                                  <div style={{display:'flex', gap:'4px', justifyContent:'center'}}>
                                    <button
                                      className="btn btn-sm"
                                      onClick={() => handleEdit(d)}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        backgroundColor: '#f3f4f6',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                      title="Editar"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      className="btn btn-sm"
                                      onClick={() => handleDelete(d.id)}
                                      disabled={deleting === d.id}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        backgroundColor: '#fee2e2',
                                        borderColor: '#fca5a5',
                                        color: '#991b1b',
                                        cursor: deleting === d.id ? 'not-allowed' : 'pointer'
                                      }}
                                    >
                                      {deleting === d.id ? '⏳' : '🗑️'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                          
                          {/* Subtotal del año */}
                          <tr style={{backgroundColor: '#f3f4f6', fontWeight: 'bold'}}>
                            <td colSpan="2" style={{textAlign:'right', paddingRight:'8px'}}>
                              Subtotal {anio}:
                            </td>
                            <td style={{textAlign:'right'}}>
                              {subtotal.USD > 0 ? fmtCurr(subtotal.USD, 'USD') : ''}
                            </td>
                            <td></td>
                            <td style={{textAlign:'right'}}>
                              {fmtCurr(subtotal.PEN, 'PEN')}
                            </td>
                            <td></td>
                          </tr>
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ 
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '2px solid #374151'
              }}>
                <div style={{
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  backgroundColor: '#e5e7eb',
                  padding: '12px',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  fontSize: '1.1em'
                }}>
                  <span>TOTAL GENERAL:</span>
                  <div style={{display: 'flex', gap: '16px'}}>
                    {totalDividendos > 0 && (
                      <span>{fmtCurr(totalDividendos, ticker.moneda)}</span>
                    )}
                    {totalEnSoles > 0 && (
                      <span>{fmtCurr(totalEnSoles, 'PEN')}</span>
                    )}
                  </div>
                </div>
                <div style={{marginTop: '12px', textAlign: 'right'}}>
                  <button className="btn btn-primary" onClick={onOpenRegisterModal}>
                    ➕ Registrar Nuevo
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de edición */}
      {editando && (
        <RegisterDividendoModal
          ticker={ticker}
          dividendoToEdit={editando}
          onClose={() => setEditando(null)}
          onSave={() => {
            setEditando(null)
            loadDividendos()
            onDividendRegistered()
          }}
        />
      )}
    </div>
  )
}

// Modal para registrar/editar un dividendo
function RegisterDividendoModal({ ticker, dividendoToEdit = null, onClose, onSave }) {
  const [fecha, setFecha] = useState(dividendoToEdit ? dividendoToEdit.fecha : '')
  const [monto, setMonto] = useState(dividendoToEdit ? dividendoToEdit.monto : '')
  const [mercado, setMercado] = useState(dividendoToEdit ? dividendoToEdit.mercado : '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const m = Number(monto)
    if (!fecha || !isFinite(m) || m <= 0) {
      alert('Ingrese una fecha y un monto válido (> 0)')
      return
    }
    if (!mercado) {
      alert('Por favor seleccione un mercado')
      return
    }

    setSaving(true)
    try {
      const method = dividendoToEdit ? 'PATCH' : 'POST'
      const url = dividendoToEdit ? `${API}/dividendos/${dividendoToEdit.id}` : `${API}/dividendos`
      const body = {
        ticker_id: ticker.ticker_id,
        fecha: fecha,
        monto: m,
        moneda: ticker.moneda,
        mercado: mercado
      }

      const r = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const d = await r.json().catch(() => ({}))

      if (!r.ok || d.error) {
        throw new Error(d.error || 'No se pudo guardar el dividendo')
      }
      alert('Dividendo guardado exitosamente')
      onSave()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{margin:0}}>
            {dividendoToEdit ? 'Editar' : 'Registrar'} Dividendo - {ticker.ticker} ({ticker.moneda})
          </h3>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 8px'
            }}
          >
            &times;
          </button>
        </div>
        
        <div style={{padding: '24px'}}>
          <form onSubmit={handleSubmit}>
            <div style={{marginBottom: '16px'}}>
              <label style={{display:'block', marginBottom:'4px', fontWeight:'500'}}>Fecha:</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>
            <div style={{marginBottom: '16px'}}>
              <label style={{display:'block', marginBottom:'4px', fontWeight:'500'}}>Mercado:</label>
              <select
                value={mercado}
                onChange={(e) => setMercado(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">-- Seleccione un mercado --</option>
                <option value="BVL">BVL</option>
                <option value="NYSE">NYSE</option>
              </select>
            </div>
            <div style={{marginBottom: '16px'}}>
              <label style={{display:'block', marginBottom:'4px', fontWeight:'500'}}>
                Monto ({ticker.moneda}):
              </label>
              <input
                type="number"
                step="0.000001"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>
            <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
              <button 
                type="button" 
                className="btn" 
                onClick={onClose} 
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar Dividendo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Modal de resumen general por año, mercado y moneda
function ResumenGeneralModal({ totalesGlobales, allYears, onClose }) {
  // Calcular gran total de todos los años
  const granTotal = useMemo(() => {
    const total = {
      NYSE: { USD: 0, PEN: 0 },
      BVL: { USD: 0, PEN: 0 }
    }
    
    allYears.forEach(year => {
      const yearData = totalesGlobales[year]
      if (yearData) {
        total.NYSE.USD += yearData.NYSE?.USD || 0
        total.NYSE.PEN += yearData.NYSE?.PEN || 0
        total.BVL.USD += yearData.BVL?.USD || 0
        total.BVL.PEN += yearData.BVL?.PEN || 0
      }
    })
    
    return total
  }, [totalesGlobales, allYears])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '900px',
        width: '90%',
        maxHeight: '85vh',
        overflow: 'auto',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          zIndex: 1
        }}>
          <h3 style={{margin:0}}>📊 Resumen General de Dividendos</h3>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 8px'
            }}
          >
            &times;
          </button>
        </div>
        
        <div style={{padding: '24px'}}>
          {allYears.length === 0 ? (
            <p>No hay datos de dividendos para mostrar.</p>
          ) : (
            <>
              <h4 style={{marginTop: 0, marginBottom: '20px', color: '#374151'}}>
                Dividendos por Año, Mercado y Moneda
              </h4>
              
              <div style={{overflowX: 'auto'}}>
                <table style={{width: '100%'}}>
                  <thead>
                    <tr style={{backgroundColor: '#f9fafb'}}>
                      <th style={{textAlign:'left', padding:'12px'}}>Año</th>
                      <th style={{textAlign:'left', padding:'12px'}}>Mercado</th>
                      <th style={{textAlign:'right', padding:'12px'}}>USD</th>
                      <th style={{textAlign:'right', padding:'12px'}}>PEN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allYears.map(year => {
                      const yearData = totalesGlobales[year] || {
                        NYSE: { USD: 0, PEN: 0 },
                        BVL: { USD: 0, PEN: 0 }
                      }
                      
                      const totalAnio = {
                        USD: (yearData.NYSE?.USD || 0) + (yearData.BVL?.USD || 0),
                        PEN: (yearData.NYSE?.PEN || 0) + (yearData.BVL?.PEN || 0)
                      }
                      
                      return (
                        <React.Fragment key={year}>
                          {/* NYSE */}
                          <tr>
                            <td style={{padding:'10px 12px'}} rowSpan="2">
                              <strong style={{fontSize:'1.05em'}}>{year}</strong>
                            </td>
                            <td style={{padding:'10px 12px'}}>NYSE</td>
                            <td style={{textAlign:'right', padding:'10px 12px'}}>
                              {yearData.NYSE?.USD > 0 ? fmtCurr(yearData.NYSE.USD, 'USD') : '-'}
                            </td>
                            <td style={{textAlign:'right', padding:'10px 12px'}}>
                              {yearData.NYSE?.PEN > 0 ? fmtCurr(yearData.NYSE.PEN, 'PEN') : '-'}
                            </td>
                          </tr>
                          {/* BVL */}
                          <tr>
                            <td style={{padding:'10px 12px'}}>BVL</td>
                            <td style={{textAlign:'right', padding:'10px 12px'}}>
                              {yearData.BVL?.USD > 0 ? fmtCurr(yearData.BVL.USD, 'USD') : '-'}
                            </td>
                            <td style={{textAlign:'right', padding:'10px 12px'}}>
                              {yearData.BVL?.PEN > 0 ? fmtCurr(yearData.BVL.PEN, 'PEN') : '-'}
                            </td>
                          </tr>
                          {/* Subtotal del año */}
                          <tr style={{backgroundColor: '#f3f4f6', fontWeight: 'bold'}}>
                            <td colSpan="2" style={{padding:'10px 12px', textAlign:'right'}}>
                              Subtotal {year}:
                            </td>
                            <td style={{textAlign:'right', padding:'10px 12px'}}>
                              {totalAnio.USD > 0 ? fmtCurr(totalAnio.USD, 'USD') : '-'}
                            </td>
                            <td style={{textAlign:'right', padding:'10px 12px'}}>
                              {totalAnio.PEN > 0 ? fmtCurr(totalAnio.PEN, 'PEN') : '-'}
                            </td>
                          </tr>
                        </React.Fragment>
                      )
                    })}
                    
                    {/* TOTAL GENERAL */}
                    <tr style={{
                      backgroundColor: '#374151',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '1.1em'
                    }}>
                      <td colSpan="2" style={{padding:'14px 12px', textAlign:'right'}}>
                        TOTAL GENERAL:
                      </td>
                      <td style={{textAlign:'right', padding:'14px 12px'}}>
                        {(granTotal.NYSE.USD + granTotal.BVL.USD) > 0 
                          ? fmtCurr(granTotal.NYSE.USD + granTotal.BVL.USD, 'USD') 
                          : '-'}
                      </td>
                      <td style={{textAlign:'right', padding:'14px 12px'}}>
                        {(granTotal.NYSE.PEN + granTotal.BVL.PEN) > 0 
                          ? fmtCurr(granTotal.NYSE.PEN + granTotal.BVL.PEN, 'PEN') 
                          : '-'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Resumen por mercado */}
              <div style={{marginTop: '30px'}}>
                <h4 style={{marginBottom: '15px', color: '#374151'}}>
                  Resumen por Mercado (Todos los años)
                </h4>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                  {/* NYSE */}
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe'
                  }}>
                    <h5 style={{margin: '0 0 12px 0', color: '#1e40af'}}>NYSE</h5>
                    <div style={{fontSize: '0.95em'}}>
                      <div style={{marginBottom: '8px'}}>
                        <span style={{fontWeight: '500'}}>USD:</span>{' '}
                        <span style={{fontWeight: 'bold'}}>
                          {granTotal.NYSE.USD > 0 ? fmtCurr(granTotal.NYSE.USD, 'USD') : '-'}
                        </span>
                      </div>
                      <div>
                        <span style={{fontWeight: '500'}}>PEN:</span>{' '}
                        <span style={{fontWeight: 'bold'}}>
                          {granTotal.NYSE.PEN > 0 ? fmtCurr(granTotal.NYSE.PEN, 'PEN') : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* BVL */}
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0'
                  }}>
                    <h5 style={{margin: '0 0 12px 0', color: '#15803d'}}>BVL</h5>
                    <div style={{fontSize: '0.95em'}}>
                      <div style={{marginBottom: '8px'}}>
                        <span style={{fontWeight: '500'}}>USD:</span>{' '}
                        <span style={{fontWeight: 'bold'}}>
                          {granTotal.BVL.USD > 0 ? fmtCurr(granTotal.BVL.USD, 'USD') : '-'}
                        </span>
                      </div>
                      <div>
                        <span style={{fontWeight: '500'}}>PEN:</span>{' '}
                        <span style={{fontWeight: 'bold'}}>
                          {granTotal.BVL.PEN > 0 ? fmtCurr(granTotal.BVL.PEN, 'PEN') : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
