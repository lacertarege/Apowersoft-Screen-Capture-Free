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
    return Array.from(years).sort((a, b) => a - b)
  }, [items])

  // Obtener todos los mercados únicos (ej. BVL, NYSE, NASDAQ, etc.)
  const allMarkets = useMemo(() => {
    const markets = new Set()
    items.forEach(item => {
      Object.values(item.dividendos_por_anio_mercado || {}).forEach(yearData => {
        Object.keys(yearData).forEach(m => markets.add(m))
      })
    })
    return Array.from(markets).sort()
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

    // Inicializar totales por año
    allYears.forEach(year => {
      totales[year] = {}
      allMarkets.forEach(m => {
        totales[year][m] = { USD: 0, PEN: 0 }
      })
    })

    items.forEach(item => {
      // Sumar por año y mercado
      allYears.forEach(year => {
        const yearMercadoData = item.dividendos_por_anio_mercado?.[year]
        if (yearMercadoData) {
          Object.keys(yearMercadoData).forEach(mercado => {
            if (!totales[year][mercado]) {
              totales[year][mercado] = { USD: 0, PEN: 0 }
            }
            totales[year][mercado].USD += yearMercadoData[mercado]?.USD || 0
            totales[year][mercado].PEN += yearMercadoData[mercado]?.PEN || 0
          })
        }
      })
    })

    return totales
  }, [items, allYears, allMarkets])

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Dividendos</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowResumenModal(true)}
            style={{ padding: '8px 16px', fontSize: '14px' }}
          >
            📊 Ver Resumen General
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontWeight: '500' }}>Año:</label>
            <select
              value={selectedYear || ''}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '14px',
                cursor: 'pointer'
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
          <table style={{ margin: 0 }}>
            <colgroup>
              <col style={{ width: '100px' }} />
              <col style={{ width: '250px' }} />
              {/* Columnas dinámicas por mercado */}
              {allMarkets.map(m => (
                <React.Fragment key={m}>
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '100px' }} />
                </React.Fragment>
              ))}
              <col style={{ width: '120px' }} />
            </colgroup>
            <thead>
              {/* Primera fila: encabezados de mercado */}
              <tr>
                <th rowSpan="2" style={{ verticalAlign: 'middle' }}>Ticker</th>
                <th rowSpan="2" style={{ verticalAlign: 'middle' }}>Empresa</th>
                {allMarkets.map(m => (
                  <th key={m} colSpan="2" style={{ textAlign: 'center', borderBottom: '1px solid #d1d5db' }}>{m}</th>
                ))}
                <th rowSpan="2" style={{ textAlign: 'center', verticalAlign: 'middle' }}>Acciones</th>
              </tr>
              {/* Segunda fila: subencabezados de moneda */}
              <tr>
                {allMarkets.map(m => (
                  <React.Fragment key={m}>
                    <th style={{ textAlign: 'right' }}>USD</th>
                    <th style={{ textAlign: 'right' }}>PEN</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
          </table>

          <div style={{ maxHeight: 'calc(70vh - 86px)', overflow: 'auto', marginTop: '-1px' }}>
            <table style={{ margin: 0 }}>
              <colgroup>
                <col style={{ width: '100px' }} />
                <col style={{ width: '250px' }} />
                {allMarkets.map(m => (
                  <React.Fragment key={m}>
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '100px' }} />
                  </React.Fragment>
                ))}
                <col style={{ width: '120px' }} />
              </colgroup>
              <tbody>
                {items.map(item => (
                  <tr key={item.ticker_id} onClick={() => handleRowClick(item)} style={{ cursor: 'pointer' }}>
                    <td><strong>{item.ticker}</strong></td>
                    <td>{item.nombre}</td>
                    {selectedYear && (() => {
                      const yearMercadoData = item.dividendos_por_anio_mercado?.[selectedYear] || {}

                      return allMarkets.map(m => {
                        const dataMercado = yearMercadoData[m] || { USD: 0, PEN: 0 }
                        return (
                          <React.Fragment key={m}>
                            <td style={{ textAlign: 'right' }}>
                              {dataMercado.USD ? fmtCurr(dataMercado.USD, 'USD').replace('$ ', '') : '-'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {dataMercado.PEN ? fmtCurr(dataMercado.PEN, 'PEN').replace('S/ ', '') : '-'}
                            </td>
                          </React.Fragment>
                        )
                      })
                    })()}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleRegisterDividend(item) }}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
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
                  <td colSpan="2" style={{ textAlign: 'right', paddingRight: '12px' }}>
                    TOTAL GLOBAL
                  </td>
                  {selectedYear && (() => {
                    const totales = totalesGlobales[selectedYear] || {}

                    return allMarkets.map(m => {
                      const totalMercado = totales[m] || { USD: 0, PEN: 0 }
                      return (
                        <React.Fragment key={m}>
                          <td style={{ textAlign: 'right' }}>
                            {totalMercado.USD > 0 ? fmtCurr(totalMercado.USD, 'USD').replace('$ ', '') : '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {totalMercado.PEN > 0 ? fmtCurr(totalMercado.PEN, 'PEN').replace('S/ ', '') : '-'}
                          </td>
                        </React.Fragment>
                      )
                    })
                  })()}
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )
      }

      {
        showDetailModal && selectedTicker && (
          <DetailDividendosModal
            ticker={selectedTicker}
            items={items}
            onSelectTicker={setSelectedTicker}
            onClose={() => setShowDetailModal(false)}
            onDividendRegistered={loadResumen}
            onOpenRegisterModal={() => { setShowDetailModal(false); setShowRegisterModal(true) }}
          />
        )
      }

      {
        showRegisterModal && selectedTicker && (
          <RegisterDividendoModal
            ticker={selectedTicker}
            onClose={() => setShowRegisterModal(false)}
            onSave={() => {
              setShowRegisterModal(false)
              loadResumen()
            }}
          />
        )
      }

      {
        showResumenModal && (
          <ResumenGeneralModal
            totalesGlobales={totalesGlobales}
            allYears={allYears}
            allMarkets={allMarkets}
            onClose={() => setShowResumenModal(false)}
          />
        )
      }
    </div >
  )
}

// Modal de detalle de dividendos
function DetailDividendosModal({ ticker, items = [], onSelectTicker, onClose, onDividendRegistered, onOpenRegisterModal }) {
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
        backgroundColor: 'white',
        borderRadius: '8px',
        maxWidth: '900px',
        width: '95%',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h3 style={{ margin: 0 }}>Dividendos de {ticker.ticker} - {ticker.nombre}</h3>
            {items.length > 0 && onSelectTicker && (() => {
              const idx = items.findIndex(i => i.ticker_id === ticker.ticker_id)
              const prev = idx > 0 ? items[idx - 1] : null
              const next = idx < items.length - 1 ? items[idx + 1] : null

              return (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    disabled={!prev}
                    onClick={() => prev && onSelectTicker(prev)}
                    className="btn btn-sm"
                    style={{ padding: '2px 8px', fontSize: '12px' }}
                    title={prev ? `Anterior: ${prev.ticker}` : ''}
                  >
                    ◀
                  </button>
                  <button
                    disabled={!next}
                    onClick={() => next && onSelectTicker(next)}
                    className="btn btn-sm"
                    style={{ padding: '2px 8px', fontSize: '12px' }}
                    title={next ? `Siguiente: ${next.ticker}` : ''}
                  >
                    ▶
                  </button>
                </div>
              )
            })()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        </div>

        <div style={{ padding: '24px' }}>
          {loading ? (
            <p>Cargando dividendos...</p>
          ) : dividendos.length === 0 ? (
            <div>
              <p>No hay dividendos registrados para este ticker.</p>
              <button className="btn btn-primary" onClick={onOpenRegisterModal} style={{ marginTop: '12px' }}>
                ➕ Registrar primer dividendo
              </button>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Exchange</th>
                      <th>Plataforma</th>
                      <th style={{ textAlign: 'right' }}>Monto</th>
                      <th style={{ textAlign: 'right' }}>Tipo de Cambio</th>
                      <th style={{ textAlign: 'right' }}>Valor en S/</th>
                      <th style={{ textAlign: 'center' }}>Acciones</th>
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
                                <td style={{ whiteSpace: 'nowrap' }}>{fmtDateLima(d.fecha)}</td>
                                <td>{d.mercado || '-'}</td>
                                <td>{d.plataforma || '-'}</td>
                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtCurr(d.monto, d.moneda)}</td>
                                <td style={{ textAlign: 'right' }}>
                                  {d.moneda === 'USD' ? (tc ? tc.toFixed(3) : '-') : '-'}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {valorSoles !== null ? fmtCurr(valorSoles, 'PEN') : '-'}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
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
                          <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}>
                            <td colSpan="2" style={{ textAlign: 'right', paddingRight: '8px' }}>
                              Subtotal {anio}:
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {subtotal.USD > 0 ? fmtCurr(subtotal.USD, 'USD') : ''}
                            </td>
                            <td></td>
                            <td style={{ textAlign: 'right' }}>
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
                  <div style={{ display: 'flex', gap: '16px' }}>
                    {totalDividendos > 0 && (
                      <span>{fmtCurr(totalDividendos, ticker.moneda)}</span>
                    )}
                    {totalEnSoles > 0 && (
                      <span>{fmtCurr(totalEnSoles, 'PEN')}</span>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: '12px', textAlign: 'right' }}>
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
  const [exchange, setExchange] = useState(dividendoToEdit ? (dividendoToEdit.mercado || dividendoToEdit.exchange) : 'BVL')
  const [plataformaId, setPlataformaId] = useState(dividendoToEdit ? dividendoToEdit.plataforma_id : '')
  const [plataformas, setPlataformas] = useState([])
  const [exchanges, setExchanges] = useState([])
  const [saving, setSaving] = useState(false)

  // Establecer default de plataforma luego de cargar si no es edición
  useEffect(() => {
    if (!dividendoToEdit && !plataformaId && plataformas.length > 0) {
      // Buscar ID de 'Trii' si existe, o usar el primero
      const trii = plataformas.find(p => p.nombre === 'Trii')
      if (trii) setPlataformaId(trii.id)
    }
  }, [plataformas, dividendoToEdit])

  // Cargar plataformas y exchanges desde la API
  useEffect(() => {
    fetch(`${API}/plataformas?activo=1`)
      .then(r => r.json())
      .then(data => {
        // Ordenar alfabéticamente descendente (Z-A)
        const items = data.items || []
        items.sort((a, b) => b.nombre.localeCompare(a.nombre))
        setPlataformas(items)
      })
      .catch(err => console.error('Error cargando plataformas:', err))

    fetch(`${API}/exchanges?activo=1`)
      .then(r => r.json())
      .then(data => setExchanges(data.items || []))
      .catch(err => console.error('Error cargando exchanges:', err))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const m = Number(monto)
    if (!fecha || !isFinite(m) || m <= 0) {
      alert('Ingrese una fecha y un monto válido (> 0)')
      return
    }
    if (!exchange) {
      alert('Por favor seleccione un exchange')
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
        mercado: exchange,
        plataforma_id: plataformaId ? Number(plataformaId) : null
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
          <h3 style={{ margin: 0 }}>
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

        <div style={{ padding: '24px' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Fecha:</label>
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
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Plataforma:</label>
              <select
                value={plataformaId}
                onChange={(e) => setPlataformaId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">-- Seleccione plataforma --</option>
                {plataformas.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Exchange:</label>
              <select
                value={exchange}
                onChange={(e) => setExchange(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">-- Seleccione exchange --</option>
                {exchanges.map(e => (
                  <option key={e.id} value={e.nombre}>{e.nombre}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
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
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
function ResumenGeneralModal({ totalesGlobales, allYears, allMarkets, onClose }) {
  // Calcular gran total de todos los años
  const granTotal = useMemo(() => {
    const total = {}

    // Inicializar total por mercado
    allMarkets.forEach(m => {
      total[m] = { USD: 0, PEN: 0 }
    })

    allYears.forEach(year => {
      const yearData = totalesGlobales[year]
      if (yearData) {
        Object.keys(yearData).forEach(m => {
          if (!total[m]) total[m] = { USD: 0, PEN: 0 }
          total[m].USD += yearData[m]?.USD || 0
          total[m].PEN += yearData[m]?.PEN || 0
        })
      }
    })

    return total
  }, [totalesGlobales, allYears, allMarkets])

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
          <h3 style={{ margin: 0 }}>📊 Resumen General de Dividendos</h3>
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

        <div style={{ padding: '24px' }}>
          {allYears.length === 0 ? (
            <p>No hay datos de dividendos para mostrar.</p>
          ) : (
            <>
              <h4 style={{ marginTop: 0, marginBottom: '20px', color: '#374151' }}>
                Dividendos por Año, Mercado y Moneda
              </h4>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th style={{ textAlign: 'left', padding: '12px' }}>Año</th>
                      <th style={{ textAlign: 'left', padding: '12px' }}>Mercado</th>
                      <th style={{ textAlign: 'right', padding: '12px' }}>USD</th>
                      <th style={{ textAlign: 'right', padding: '12px' }}>PEN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allYears.map(year => {
                      const yearData = totalesGlobales[year] || {}

                      const totalAnio = { USD: 0, PEN: 0 }
                      allMarkets.forEach(m => {
                        totalAnio.USD += yearData[m]?.USD || 0
                        totalAnio.PEN += yearData[m]?.PEN || 0
                      })

                      return (
                        <React.Fragment key={year}>
                          {/* Datos por Mercado */}
                          {allMarkets.map((m, idx) => (
                            <tr key={`${year}-${m}`}>
                              {/* Primera fila del año: mostrar celda con año.
                                   Pero aquí estamos haciendo una fila por cada mercado.
                                   Podemos hacer fila 1 con rowspan */}
                              {idx === 0 && (
                                <td style={{ padding: '10px 12px' }} rowSpan={allMarkets.length}>
                                  <strong style={{ fontSize: '1.05em' }}>{year}</strong>
                                </td>
                              )}
                              <td style={{ padding: '10px 12px' }}>{m}</td>
                              <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                                {yearData[m]?.USD > 0 ? fmtCurr(yearData[m].USD, 'USD') : '-'}
                              </td>
                              <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                                {yearData[m]?.PEN > 0 ? fmtCurr(yearData[m].PEN, 'PEN') : '-'}
                              </td>
                            </tr>
                          ))}

                          {/* Subtotal del año */}
                          <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}>
                            <td colSpan="2" style={{ padding: '10px 12px', textAlign: 'right' }}>
                              Subtotal {year}:
                            </td>
                            <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                              {totalAnio.USD > 0 ? fmtCurr(totalAnio.USD, 'USD') : '-'}
                            </td>
                            <td style={{ textAlign: 'right', padding: '10px 12px' }}>
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
                      <td colSpan="2" style={{ padding: '14px 12px', textAlign: 'right' }}>
                        TOTAL GENERAL:
                      </td>
                      <td style={{ textAlign: 'right', padding: '14px 12px' }}>
                        {Object.values(granTotal).reduce((sum, v) => sum + v.USD, 0) > 0
                          ? fmtCurr(Object.values(granTotal).reduce((sum, v) => sum + v.USD, 0), 'USD')
                          : '-'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '14px 12px' }}>
                        {Object.values(granTotal).reduce((sum, v) => sum + v.PEN, 0) > 0
                          ? fmtCurr(Object.values(granTotal).reduce((sum, v) => sum + v.PEN, 0), 'PEN')
                          : '-'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Resumen por mercado */}
              <div style={{ marginTop: '30px' }}>
                <h4 style={{ marginBottom: '15px', color: '#374151' }}>
                  Resumen por Mercado (Todos los años)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {allMarkets.map(m => {
                    const data = granTotal[m] || { USD: 0, PEN: 0 }
                    return (
                      <div key={m} style={{
                        padding: '20px',
                        backgroundColor: '#eff6ff',
                        borderRadius: '8px',
                        border: '1px solid #bfdbfe'
                      }}>
                        <h5 style={{ margin: '0 0 12px 0', color: '#1e40af' }}>{m}</h5>
                        <div style={{ fontSize: '0.95em' }}>
                          <div style={{ marginBottom: '8px' }}>
                            <span style={{ fontWeight: '500' }}>USD:</span>{' '}
                            <span style={{ fontWeight: 'bold' }}>
                              {data.USD > 0 ? fmtCurr(data.USD, 'USD') : '-'}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontWeight: '500' }}>PEN:</span>{' '}
                            <span style={{ fontWeight: 'bold' }}>
                              {data.PEN > 0 ? fmtCurr(data.PEN, 'PEN') : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
