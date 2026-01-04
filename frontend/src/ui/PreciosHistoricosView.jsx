import React, { useEffect, useState } from 'react'
import { API } from './config'
import RefreshModal from './RefreshModal.jsx'
import { fmtDateLima } from './utils'
import { safeApiCall, safeAsyncHandler } from '../utils/safeApi'
import { usePriceUpdate } from '../hooks/usePriceUpdate'

export default function PreciosHistoricosView() {
  const [tickers, setTickers] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [sortField, setSortField] = useState('ticker')
  const [sortDir, setSortDir] = useState('asc')
  const [refreshingIds, setRefreshingIds] = useState([])
  const [refreshModal, setRefreshModal] = useState({ open: false, loading: false, attempts: [], message: '', inserted: 0, source: null, title: '', steps: [], from: null, to: null })
  const [tipos, setTipos] = useState([])
  const [selectedTipos, setSelectedTipos] = useState([])

  // Hook para manejo asíncrono de actualización de precios
  const { isUpdating, updateProgress, updatePrices } = usePriceUpdate()

  // Estados para el detalle expandible
  const [expandedTicker, setExpandedTicker] = useState(null)
  const [historicos, setHistoricos] = useState({})
  const [loadingHistoricos, setLoadingHistoricos] = useState({})

  // Estados para actualización masiva
  const [bulkUpdateModal, setBulkUpdateModal] = useState({
    open: false,
    isUpdating: false,
    progress: [],
    currentTicker: null,
    totalTickers: 0,
    completedTickers: 0
  })

  // Estados para registro manual de precios
  const [manualPriceModal, setManualPriceModal] = useState({
    open: false,
    ticker: null,
    fecha: '',
    precio: '',
    fuente: 'manual',
    loading: false
  })

  // Estados para edición y eliminación de precios
  const [editModal, setEditModal] = useState({
    open: false,
    ticker: null,
    precio: null,
    fecha: '',
    valor: ''
  })
  const [deleting, setDeleting] = useState(null)

  // Estado para importar CSV
  const [csvImportModal, setCsvImportModal] = useState({
    open: false,
    ticker: null,
    file: null,
    loading: false,
    step: 'upload', // 'upload' o 'mapping'
    csvData: null,
    columnMapping: {
      fecha: '',
      precio: ''
    }
  })

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/tickers?pageSize=1000&q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { setTickers(d.items || []) })
      .catch(() => setTickers([]))
      .finally(() => setLoading(false))
  }, [q])

  useEffect(() => {
    fetch(`${API}/config/tipos-inversion`).then(r => r.json()).then(d => {
      const items = d.items || []
      setTipos(items)
      const defaults = items.filter(t => {
        const name = (t.nombre || '').toLowerCase()
        return name === 'acciones' || name === 'etf' || name === 'etfs'
      }).map(t => t.id)
      setSelectedTipos(defaults)
    }).catch(() => { setTipos([]); setSelectedTipos([]) })
  }, [])

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const visibleTickers = React.useMemo(() => {
    if (!selectedTipos || selectedTipos.length === 0) return tickers
    const selectedNames = new Set(
      (tipos || []).filter(t => selectedTipos.includes(t.id)).map(t => (t.nombre || '').toLowerCase())
    )
    return tickers.filter(tk => selectedNames.has((tk.tipo_inversion_nombre || '').toLowerCase()))
  }, [tickers, tipos, selectedTipos])

  function sorted(items) {
    const arr = [...items]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      let va, vb
      switch (sortField) {
        case 'ticker':
          va = (a.ticker || '').toUpperCase(); vb = (b.ticker || '').toUpperCase();
          return va < vb ? -1 * dir : va > vb ? 1 * dir : 0
        case 'nombre':
          va = (a.nombre || '').toUpperCase(); vb = (b.nombre || '').toUpperCase();
          return va < vb ? -1 * dir : va > vb ? 1 * dir : 0
        case 'tipo_inversion_nombre':
          va = (a.tipo_inversion_nombre || '').toUpperCase(); vb = (b.tipo_inversion_nombre || '').toUpperCase();
          return va < vb ? -1 * dir : va > vb ? 1 * dir : 0
        case 'primera_compra':
        case 'fecha':
        case 'precio_reciente':
          va = a[sortField] || ''
          vb = b[sortField] || ''
          return (va < vb ? -1 : va > vb ? 1 : 0) * dir
        default:
          return 0
      }
    })
    return arr
  }

  // Función para actualizar un ticker individual con modal similar al masivo
  const refreshTicker = safeAsyncHandler(async (tk, isFromDetail = false) => {
    setBulkUpdateModal({
      open: true,
      isUpdating: true,
      progress: [`Iniciando actualización de ${tk.ticker}...`],
      currentTicker: tk.ticker,
      totalTickers: 1,
      completedTickers: 0
    })

    setRefreshingIds(prev => prev.includes(tk.id) ? prev : [...prev, tk.id])

    try {
      // Usar la fecha de primera compra que ya está disponible en los datos del ticker
      let fechaPrimeraInversion = tk.primera_compra || null

      // Si no está disponible en los datos del ticker, obtenerla desde las inversiones
      if (!fechaPrimeraInversion) {
        try {
          const inversionesResponse = await fetch(`${API}/tickers/${tk.id}/inversiones`)
          if (inversionesResponse.ok) {
            const inversionesData = await inversionesResponse.json()
            const inversiones = inversionesData.items || []
            if (inversiones.length > 0) {
              const primeraInversion = inversiones.reduce((min, inv) => {
                const fechaInv = new Date(inv.fecha)
                const fechaMin = new Date(min.fecha)
                return fechaInv < fechaMin ? inv : min
              })
              fechaPrimeraInversion = primeraInversion.fecha
            }
          }
        } catch (error) {
          console.error('Error obteniendo inversiones:', error)
        }
      }

      setBulkUpdateModal(prev => ({
        ...prev,
        progress: [...prev.progress, `Consultando servicios de precios para ${tk.ticker}${fechaPrimeraInversion ? ` desde ${fechaPrimeraInversion}` : ''}...`]
      }))

      // Preparar el payload con la fecha de la primera inversión
      const payload = {}
      if (fechaPrimeraInversion) {
        payload.from_date = fechaPrimeraInversion
      }

      const response = await fetch(`${API}/tickers/${tk.id}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      const message = data.error
        ? `❌ ${tk.ticker}: ${data.error}`
        : data.inserted > 0
          ? `✅ ${tk.ticker}: ${data.inserted} precios actualizados`
          : `⚠️ ${tk.ticker}: Sin nuevos precios`

      setBulkUpdateModal(prev => ({
        ...prev,
        progress: [...prev.progress, message],
        completedTickers: 1
      }))

      // Recargar datos en segundo plano
      setTimeout(async () => {
        try {
          // Recargar la lista principal de tickers
          const tickersResult = await safeApiCall(
            async () => {
              const tickersResponse = await fetch(`${API}/tickers?pageSize=1000&q=${encodeURIComponent(q)}`)
              const tickersData = await tickersResponse.json()
              return tickersData.items || []
            },
            [],
            'Error al refrescar la lista de tickers'
          )

          if (tickersResult.success) {
            setTickers(tickersResult.data)
          }

          // Si la actualización se hizo desde el detalle, recargar los históricos
          if (isFromDetail) {
            const historicosResult = await safeApiCall(
              () => loadHistoricos(tk.id),
              null,
              'Error al recargar históricos'
            )

            if (!historicosResult.success) {
              console.error('Error al recargar históricos:', historicosResult.error)
            }
          }
        } catch (error) {
          console.error('Error al recargar datos:', error)
        }
      }, 100)

      // Finalizar actualización
      setBulkUpdateModal(prev => ({
        ...prev,
        isUpdating: false,
        progress: [...prev.progress, '🎉 ¡Actualización completada!']
      }))

    } catch (error) {
      setBulkUpdateModal(prev => ({
        ...prev,
        isUpdating: false,
        progress: [...prev.progress, `❌ ${tk.ticker}: Error - ${error.message}`]
      }))
    } finally {
      setRefreshingIds(prev => prev.filter(id => id !== tk.id))
    }
  }, 'Error al actualizar precios del ticker')

  // Función para actualizar todos los tickers
  const updateAllTickers = safeAsyncHandler(async () => {
    const allTickers = visibleTickers.filter(t => t.ticker) // Filtrar tickers válidos

    setBulkUpdateModal({
      open: true,
      isUpdating: true,
      progress: [],
      currentTicker: null,
      totalTickers: allTickers.length,
      completedTickers: 0
    })

    for (let i = 0; i < allTickers.length; i++) {
      const ticker = allTickers[i]

      // Actualizar el ticker actual
      setBulkUpdateModal(prev => ({
        ...prev,
        currentTicker: ticker.ticker,
        progress: [...prev.progress, `Iniciando actualización de ${ticker.ticker}...`]
      }))

      try {
        // Usar la fecha de primera compra que ya está disponible en los datos del ticker
        let fechaPrimeraInversion = ticker.primera_compra || null

        // Si no está disponible en los datos del ticker, obtenerla desde las inversiones
        if (!fechaPrimeraInversion) {
          try {
            const inversionesResponse = await fetch(`${API}/tickers/${ticker.id}/inversiones`)
            if (inversionesResponse.ok) {
              const inversionesData = await inversionesResponse.json()
              const inversiones = inversionesData.items || []
              if (inversiones.length > 0) {
                const primeraInversion = inversiones.reduce((min, inv) => {
                  const fechaInv = new Date(inv.fecha)
                  const fechaMin = new Date(min.fecha)
                  return fechaInv < fechaMin ? inv : min
                })
                fechaPrimeraInversion = primeraInversion.fecha
              }
            }
          } catch (error) {
            console.error('Error obteniendo inversiones:', error)
          }
        }

        // Preparar el payload con la fecha de la primera inversión
        const payload = {}
        if (fechaPrimeraInversion) {
          payload.from_date = fechaPrimeraInversion
        }

        const response = await fetch(`${API}/tickers/${ticker.id}/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()

        // Construir mensaje enriquecido con exchange y fuente
        const exchangeBadge = ticker.exchange ? `[${ticker.exchange}]` : ''
        const sourceBadge = data.source ? `(${data.source})` : ''

        const message = data.error
          ? `❌ ${ticker.ticker} ${exchangeBadge}: ${data.error}`
          : data.inserted > 0
            ? `✅ ${ticker.ticker} ${exchangeBadge}: ${data.inserted} precios ${sourceBadge}`
            : `⚠️  ${ticker.ticker} ${exchangeBadge}: Sin nuevos precios ${sourceBadge}`

        setBulkUpdateModal(prev => ({
          ...prev,
          progress: [...prev.progress, message],
          completedTickers: prev.completedTickers + 1
        }))

        // Pequeña pausa para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        const exchangeBadge = ticker.exchange ? `[${ticker.exchange}]` : ''
        setBulkUpdateModal(prev => ({
          ...prev,
          progress: [...prev.progress, `❌ ${ticker.ticker} ${exchangeBadge}: Error - ${error.message}`],
          completedTickers: prev.completedTickers + 1
        }))
      }
    }

    // Finalizar actualización
    setBulkUpdateModal(prev => ({
      ...prev,
      isUpdating: false,
      progress: [...prev.progress, '🎉 ¡Actualización masiva completada!']
    }))

  }, 'Error en actualización masiva')

  // Función para registrar precio manualmente
  const addManualPrice = safeAsyncHandler(async (ticker) => {
    // Verificar si ya existe un precio para la fecha seleccionada
    const existingPrices = historicos[ticker.id] || []
    const selectedDate = new Date(manualPriceModal.fecha).toISOString().split('T')[0]

    const dateExists = existingPrices.some(price => {
      const priceDate = new Date(price.fecha).toISOString().split('T')[0]
      return priceDate === selectedDate
    })

    if (dateExists) {
      alert(`Ya existe un precio para la fecha ${manualPriceModal.fecha} en ${ticker.ticker}`)
      return
    }

    setManualPriceModal(prev => ({ ...prev, loading: true }))

    try {
      const response = await fetch(`${API}/tickers/${ticker.id}/precio`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fecha: manualPriceModal.fecha,
          precio: parseFloat(manualPriceModal.precio)
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Recargar los históricos del ticker
      await loadHistoricos(ticker.id)

      // Cerrar modal y mostrar éxito
      setManualPriceModal({
        open: false,
        ticker: null,
        fecha: '',
        precio: '',
        fuente: 'manual',
        loading: false
      })

      alert(`✅ Precio registrado exitosamente para ${ticker.ticker}`)

    } catch (error) {
      console.error('Error al registrar precio manual:', error)
      alert(`❌ Error al registrar precio: ${error.message}`)
      setManualPriceModal(prev => ({ ...prev, loading: false }))
    }

  }, 'Error al registrar precio manual')

  const parseCSVFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target.result
          const lines = content.split('\n').filter(line => line.trim())

          if (lines.length < 2) {
            reject(new Error('El archivo CSV debe tener al menos 2 líneas (header + datos)'))
            return
          }

          // Detectar separador (punto y coma o coma)
          const firstLine = lines[0]
          const semicolonCount = (firstLine.match(/;/g) || []).length
          const commaCount = (firstLine.match(/,/g) || []).length
          const separator = semicolonCount > commaCount ? ';' : ','

          const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''))
          const sampleData = lines.slice(1, 6).map(line =>
            line.split(separator).map(cell => cell.trim().replace(/"/g, ''))
          )

          resolve({
            headers,
            sampleData,
            separator,
            totalLines: lines.length - 1
          })
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error('Error al leer el archivo'))
      reader.readAsText(file, 'utf-8')
    })
  }

  const handleFileUpload = safeAsyncHandler(async (file) => {
    if (!file) {
      alert('Por favor selecciona un archivo CSV')
      return
    }

    try {
      const csvData = await parseCSVFile(file)

      setCsvImportModal(prev => ({
        ...prev,
        file: file,
        csvData: csvData,
        step: 'mapping',
        loading: false
      }))

    } catch (error) {
      console.error('Error al parsear CSV:', error)
      alert(`❌ Error al procesar el archivo CSV: ${error.message}`)
      setCsvImportModal(prev => ({ ...prev, loading: false }))
    }

  }, 'Error al procesar archivo CSV')

  const importCsvPrices = safeAsyncHandler(async (ticker, file, columnMapping) => {
    if (!file) {
      alert('Por favor selecciona un archivo CSV')
      return
    }

    if (!columnMapping.fecha || !columnMapping.precio) {
      alert('Por favor selecciona las columnas de fecha y precio')
      return
    }

    console.log('Enviando importación CSV:', {
      ticker: ticker.ticker,
      tickerId: ticker.id,
      columnMapping: columnMapping,
      fileName: file.name
    })

    setCsvImportModal(prev => ({ ...prev, loading: true }))

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('ticker_id', ticker.id)
      formData.append('column_mapping', JSON.stringify(columnMapping))

      const response = await fetch(`${API}/historicos/import-csv`, {
        method: 'POST',
        body: formData
      })

      console.log('Respuesta del servidor:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error del servidor:', errorData)
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Datos de respuesta:', data)

      // Recargar los históricos del ticker
      await loadHistoricos(ticker.id)

      // Cerrar modal y mostrar éxito
      setCsvImportModal({
        open: false,
        ticker: null,
        file: null,
        loading: false,
        step: 'upload',
        csvData: null,
        columnMapping: { fecha: '', precio: '' }
      })

      alert(`✅ Se importaron ${data.inserted || 0} precios exitosamente para ${ticker.ticker}`)

    } catch (error) {
      console.error('Error al importar CSV:', error)
      alert(`❌ Error al importar CSV: ${error.message}`)
      setCsvImportModal(prev => ({ ...prev, loading: false }))
    }

  }, 'Error al importar CSV')

  function FechaCell({ fecha }) {
    if (!fecha) return <span>-</span>
    const d = new Date(fecha)
    const now = new Date()
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24))
    const stale = diffDays > 7
    return <span style={{ color: stale ? '#dc2626' : undefined }}>{fmtDateLima(fecha)}</span>
  }

  // Función para cargar históricos de un ticker específico
  const loadHistoricos = async (tickerId) => {
    setLoadingHistoricos(prev => ({ ...prev, [tickerId]: true }))
    try {
      const response = await fetch(`${API}/historicos/${tickerId}?from=1970-01-01`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      const items = data.items || []
      items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      setHistoricos(prev => ({ ...prev, [tickerId]: items }))
    } catch (error) {
      console.error('Error loading historicos:', error)
      setHistoricos(prev => ({ ...prev, [tickerId]: [] }))
    } finally {
      setLoadingHistoricos(prev => ({ ...prev, [tickerId]: false }))
    }
  }

  // Función para abrir modal de edición
  const handleEdit = (ticker, precioItem) => {
    setEditModal({
      open: true,
      ticker: ticker,
      precio: precioItem,
      fecha: precioItem.fecha,
      valor: precioItem.precio.toString()
    })
  }

  // Función para guardar cambios
  const handleSaveEdit = async () => {
    if (!editModal.ticker || !editModal.precio || !editModal.fecha || !editModal.valor) return

    try {
      const response = await fetch(`${API}/tickers/${editModal.ticker.id}/precio`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: editModal.fecha,
          precio: parseFloat(editModal.valor)
        })
      })

      if (response.ok) {
        setEditModal({ open: false, ticker: null, precio: null, fecha: '', valor: '' })
        // Recargar históricos del ticker
        loadHistoricos(editModal.ticker.id)
      } else {
        alert('Error al actualizar el precio')
      }
    } catch (error) {
      console.error('Error updating price:', error)
      alert('Error al actualizar el precio')
    }
  }

  // Función para eliminar precio
  const handleDelete = async (precioItem) => {
    if (!confirm(`¿Estás seguro de eliminar el precio del ${fmtDateLima(precioItem.fecha)}?`)) return

    setDeleting(precioItem.fecha)

    try {
      const response = await fetch(`${API}/historicos/${precioItem.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Recargar históricos del ticker expandido
        if (expandedTicker) {
          loadHistoricos(expandedTicker.id)
        }
      } else {
        alert('Error al eliminar el precio')
      }
    } catch (error) {
      console.error('Error deleting price:', error)
      alert('Error al eliminar el precio')
    } finally {
      setDeleting(null)
    }
  }

  // Función para alternar la expansión de un ticker
  const toggleExpansion = (ticker) => {
    if (expandedTicker?.id === ticker.id) {
      setExpandedTicker(null)
    } else {
      setExpandedTicker(ticker)
      // Cargar históricos si no están cargados
      if (!historicos[ticker.id]) {
        loadHistoricos(ticker.id)
      }
    }
  }

  return (
    <div className="container">
      <style jsx="true">{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="card" style={{ marginBottom: 12 }}>
        {/* Header mejorado estilo Apple HIG */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Primera fila: Título y botón de actualización */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '600',
              letterSpacing: '-0.3px',
              color: '#1e293b'
            }}>
              Todas las Acciones y ETFs
            </h3>

            <button
              onClick={updateAllTickers}
              disabled={bulkUpdateModal.isUpdating}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: bulkUpdateModal.isUpdating ? '#94a3b8' : '#0ea5e9',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: bulkUpdateModal.isUpdating ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}
              onMouseEnter={(e) => {
                if (!bulkUpdateModal.isUpdating) {
                  e.currentTarget.style.backgroundColor = '#0284c7'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'
                }
              }}
              onMouseLeave={(e) => {
                if (!bulkUpdateModal.isUpdating) {
                  e.currentTarget.style.backgroundColor = '#0ea5e9'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'
                }
              }}
            >
              {bulkUpdateModal.isUpdating ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Actualizando...
                </>
              ) : (
                <>
                  🔄 Actualizar Todo
                </>
              )}
            </button>
          </div>

          {/* Segunda fila: Filtros tipo pill + Buscador */}
          {Boolean(tipos.length) && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              {/* Filtros estilo pill */}
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flexWrap: 'wrap',
                flex: 1
              }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#64748b',
                  marginRight: '4px'
                }}>
                  Filtrar tipo:
                </span>
                {tipos.map(t => {
                  const isSelected = selectedTipos.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTipos(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                      style={{
                        padding: '6px 14px',
                        fontSize: '13px',
                        fontWeight: isSelected ? '600' : '500',
                        backgroundColor: isSelected ? '#0ea5e9' : '#f1f5f9',
                        color: isSelected ? 'white' : '#475569',
                        border: isSelected ? '1.5px solid #0ea5e9' : '1.5px solid #e2e8f0',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#e2e8f0'
                          e.currentTarget.style.borderColor = '#cbd5e1'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#f1f5f9'
                          e.currentTarget.style.borderColor = '#e2e8f0'
                        }
                      }}
                    >
                      {t.nombre}
                    </button>
                  )
                })}
              </div>

              {/* Buscador mejorado */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <span style={{
                    position: 'absolute',
                    left: '12px',
                    fontSize: '16px',
                    color: '#94a3b8'
                  }}>
                    🔍
                  </span>
                  <input
                    placeholder="Buscar ticker o nombre..."
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    style={{
                      padding: '8px 12px 8px 36px',
                      fontSize: '14px',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      outline: 'none',
                      width: '260px',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#0ea5e9'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(14, 165, 233, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#64748b',
                  whiteSpace: 'nowrap'
                }}>
                  {visibleTickers.length} resultados
                </span>
              </div>
            </div>
          )}
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>Cargando...</div>
        ) : (
          <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>
                    <button onClick={() => toggleSort('ticker')} style={{ all: 'unset', cursor: 'pointer' }}>Ticker{sortField === 'ticker' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
                  </th>
                  <th style={{ textAlign: 'left' }}>
                    <button onClick={() => toggleSort('nombre')} style={{ all: 'unset', cursor: 'pointer' }}>Nombre empresa{sortField === 'nombre' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
                  </th>
                  <th style={{ textAlign: 'left' }}>
                    <button onClick={() => toggleSort('tipo_inversion_nombre')} style={{ all: 'unset', cursor: 'pointer' }}>Tipo de inversión{sortField === 'tipo_inversion_nombre' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
                  </th>
                  <th style={{ textAlign: 'left' }}>
                    <button onClick={() => toggleSort('primera_compra')} style={{ all: 'unset', cursor: 'pointer' }}>Primera compra{sortField === 'primera_compra' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
                  </th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <button onClick={() => toggleSort('fecha')} style={{ all: 'unset', cursor: 'pointer' }}>Fecha{sortField === 'fecha' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
                  </th>
                  <th style={{ textAlign: 'right' }}>
                    <button onClick={() => toggleSort('precio_reciente')} style={{ all: 'unset', cursor: 'pointer' }}>Precio más reciente{sortField === 'precio_reciente' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
                  </th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sorted(visibleTickers).map(tk => {
                  const isRefreshing = refreshingIds.includes(tk.id)
                  const isExpanded = expandedTicker?.id === tk.id
                  const tickerHistoricos = historicos[tk.id] || []
                  const isLoadingHistoricos = loadingHistoricos[tk.id]

                  return (
                    <React.Fragment key={tk.id}>
                      {/* Fila principal */}
                      <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpansion(tk)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                              fontSize: '12px',
                              color: '#666'
                            }}>
                              ▶
                            </span>
                            <span style={{ fontWeight: 'bold' }}>{tk.ticker}</span>
                          </div>
                        </td>
                        <td>{tk.nombre}</td>
                        <td>{tk.tipo_inversion_nombre || '-'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{tk.primera_compra ? fmtDateLima(tk.primera_compra) : '-'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}><FechaCell fecha={tk.fecha} /></td>
                        <td style={{ textAlign: 'right' }}>
                          {tk.precio_reciente ? `$${Number(tk.precio_reciente).toFixed(2)}` : '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            title="Actualizar precio"
                            onClick={(e) => {
                              e.stopPropagation()
                              !isRefreshing && refreshTicker(tk)
                            }}
                            disabled={isRefreshing}
                            style={{ padding: '4px 6px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: isRefreshing ? 'default' : 'pointer', opacity: isRefreshing ? 0.6 : 1 }}
                          >
                            {isRefreshing ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <g>
                                  <polyline points="23 4 23 10 17 10"></polyline>
                                  <polyline points="1 20 1 14 7 14"></polyline>
                                  <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.37 4.37A9 9 0 0020.49 15"></path>
                                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                                </g>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.37 4.37A9 9 0 0020.49 15"></path>
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Fila expandible con históricos */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="7" style={{ padding: 0, backgroundColor: '#f8f9fa', border: 'none' }}>
                            <div style={{ padding: '16px', borderTop: '1px solid #ddd' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h4 style={{ margin: 0, color: '#333' }}>
                                  Precios Históricos - {tk.ticker}
                                </h4>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCsvImportModal({
                                        open: true,
                                        ticker: tk,
                                        file: null,
                                        loading: false,
                                        step: 'upload',
                                        csvData: null,
                                        columnMapping: { fecha: '', precio: '' }
                                      });
                                    }}
                                    className="btn btn-outline-success"
                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                  >
                                    📄 Importar CSV
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setManualPriceModal({
                                        open: true,
                                        ticker: tk,
                                        fecha: new Date().toISOString().split('T')[0], // Fecha actual
                                        precio: '',
                                        fuente: 'manual',
                                        loading: false
                                      });
                                    }}
                                    className="btn btn-outline-primary"
                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                  >
                                    ➕ Agregar Precio
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      !isRefreshing && refreshTicker(tk, true);
                                    }}
                                    className="btn btn-primary"
                                    disabled={isRefreshing}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}
                                  >
                                    {isRefreshing ? (
                                      <>
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          style={{ animation: 'spin 1s linear infinite' }}
                                        >
                                          <path d="M21 12a9 9 0 11-6.219-8.56" />
                                        </svg>
                                        Procesando...
                                      </>
                                    ) : (
                                      'Actualizar Precios'
                                    )}
                                  </button>
                                </div>
                              </div>

                              {isLoadingHistoricos ? (
                                <div style={{
                                  textAlign: 'center',
                                  padding: '20px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}>
                                  <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#2563eb"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ animation: 'spin 1s linear infinite' }}
                                  >
                                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                                  </svg>
                                  <div style={{ fontSize: '14px', color: '#666' }}>Cargando datos históricos...</div>
                                </div>
                              ) : tickerHistoricos.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                                  Sin datos históricos disponibles
                                </div>
                              ) : (
                                <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
                                  <table style={{ width: '100%', fontSize: '14px' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#e9ecef' }}>
                                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Fecha</th>
                                        <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Precio</th>
                                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Fuente</th>
                                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', fontSize: '12px' }}>Actualizado</th>
                                        <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #ddd', width: '100px' }}>Acciones</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {tickerHistoricos.map((item, index) => (
                                        <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                                          <td style={{ padding: '8px' }}>{fmtDateLima(item.fecha)}</td>
                                          <td style={{ textAlign: 'right', padding: '8px' }}>
                                            {(() => {
                                              const currency = tk?.moneda || 'USD'
                                              const numValue = Number(item.precio) || 0

                                              if (currency === 'PEN') {
                                                return `S/ ${new Intl.NumberFormat('es-PE', {
                                                  minimumFractionDigits: 2,
                                                  maximumFractionDigits: 2
                                                }).format(numValue)}`
                                              }

                                              if (currency === 'USD') {
                                                return `$ ${new Intl.NumberFormat('es-PE', {
                                                  minimumFractionDigits: 2,
                                                  maximumFractionDigits: 2
                                                }).format(numValue)}`
                                              }

                                              return new Intl.NumberFormat('es-PE', {
                                                style: 'currency',
                                                currency: currency,
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                              }).format(numValue)
                                            })()}
                                          </td>
                                          <td style={{ padding: '8px' }}>{item.fuente_api || 'N/A'}</td>
                                          <td style={{ padding: '8px', fontSize: '11px', color: '#64748b' }}>
                                            {item.updated_at ? (
                                              (() => {
                                                const date = new Date(item.updated_at)
                                                const now = new Date()
                                                const diffMs = now - date
                                                const diffMins = Math.floor(diffMs / 60000)
                                                const diffHours = Math.floor(diffMs / 3600000)
                                                const diffDays = Math.floor(diffMs / 86400000)

                                                if (diffMins < 1) return 'Hace un momento'
                                                if (diffMins < 60) return `Hace ${diffMins}m`
                                                if (diffHours < 24) return `Hace ${diffHours}h`
                                                if (diffDays < 7) return `Hace ${diffDays}d`

                                                return date.toLocaleDateString('es-PE', {
                                                  year: 'numeric',
                                                  month: 'short',
                                                  day: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit'
                                                })
                                              })()
                                            ) : 'N/A'}
                                          </td>
                                          <td style={{ textAlign: 'center', padding: '8px' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleEdit(tk, item);
                                                }}
                                                className="btn btn-sm"
                                                style={{
                                                  padding: '4px 8px',
                                                  fontSize: '12px',
                                                  backgroundColor: '#f3f4f6',
                                                  border: '1px solid #d1d5db',
                                                  borderRadius: '4px',
                                                  cursor: 'pointer'
                                                }}
                                                title="Editar precio"
                                              >
                                                ✏️
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDelete(item);
                                                }}
                                                disabled={deleting === item.fecha}
                                                className="btn btn-sm"
                                                style={{
                                                  padding: '4px 8px',
                                                  fontSize: '12px',
                                                  backgroundColor: deleting === item.fecha ? '#f9fafb' : '#fef2f2',
                                                  border: '1px solid #d1d5db',
                                                  borderRadius: '4px',
                                                  cursor: deleting === item.fecha ? 'not-allowed' : 'pointer',
                                                  opacity: deleting === item.fecha ? 0.6 : 1
                                                }}
                                                title="Eliminar precio"
                                              >
                                                {deleting === item.fecha ? '⏳' : '🗑️'}
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <RefreshModal open={refreshModal.open} title={refreshModal.title} loading={refreshModal.loading} attempts={refreshModal.attempts} message={refreshModal.message} inserted={refreshModal.inserted} source={refreshModal.source} steps={refreshModal.steps} from={refreshModal.from} to={refreshModal.to} onClose={() => setRefreshModal(m => ({ ...m, open: false }))} />

      {/* Modal de actualización masiva */}
      {bulkUpdateModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h2 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>
              🔄 Actualización Masiva de Precios
            </h2>

            {bulkUpdateModal.isUpdating && (
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  <strong>Procesando...</strong>
                </div>
                <div style={{ fontSize: '14px', color: '#475569' }}>
                  {bulkUpdateModal.currentTicker && `Actualizando: ${bulkUpdateModal.currentTicker}`}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Progreso: {bulkUpdateModal.completedTickers} de {bulkUpdateModal.totalTickers} tickers
                </div>
              </div>
            )}

            <div style={{
              flex: 1,
              overflowY: 'auto',
              backgroundColor: '#f8fafc',
              borderRadius: '4px',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.4'
            }}>
              {bulkUpdateModal.progress.map((line, index) => (
                <div key={index} style={{ marginBottom: '4px', color: '#374151' }}>
                  {line}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              {!bulkUpdateModal.isUpdating && (
                <button
                  onClick={() => {
                    setBulkUpdateModal({ open: false, isUpdating: false, progress: [], currentTicker: null, totalTickers: 0, completedTickers: 0 })
                    // Recargar la página para mostrar los nuevos valores
                    window.location.reload()
                  }}
                  className="btn btn-primary"
                  style={{ padding: '8px 16px' }}
                >
                  Cerrar y Actualizar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para registro manual de precios */}
      {manualPriceModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>
              ➕ Agregar Precio Manual - {manualPriceModal.ticker?.ticker}
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                Fecha:
              </label>
              <input
                type="date"
                value={manualPriceModal.fecha}
                onChange={(e) => setManualPriceModal(prev => ({ ...prev, fecha: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                max={new Date().toISOString().split('T')[0]} // No permitir fechas futuras
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                Precio:
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={manualPriceModal.precio}
                onChange={(e) => setManualPriceModal(prev => ({ ...prev, precio: e.target.value }))}
                placeholder="Ej: 105.50"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                Fuente:
              </label>
              <select
                value={manualPriceModal.fuente}
                onChange={(e) => setManualPriceModal(prev => ({ ...prev, fuente: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="manual">Manual</option>
                <option value="bolsa">Bolsa</option>
                <option value="yahoo">Yahoo Finance</option>
                <option value="alpha">Alpha Vantage</option>
                <option value="polygon">Polygon</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setManualPriceModal({
                  open: false,
                  ticker: null,
                  fecha: '',
                  precio: '',
                  fuente: 'manual',
                  loading: false
                })}
                className="btn btn-outline-secondary"
                style={{ padding: '8px 16px' }}
                disabled={manualPriceModal.loading}
              >
                Cancelar
              </button>
              <button
                onClick={() => addManualPrice(manualPriceModal.ticker)}
                className="btn btn-primary"
                style={{
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                disabled={manualPriceModal.loading || !manualPriceModal.fecha || !manualPriceModal.precio}
              >
                {manualPriceModal.loading ? (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ animation: 'spin 1s linear infinite' }}
                    >
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    Guardando...
                  </>
                ) : (
                  '✅ Guardar Precio'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición */}
      {editModal.open && (
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
            padding: '24px',
            borderRadius: '8px',
            width: '400px',
            maxWidth: '90vw'
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Editar Precio Histórico</h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                Fecha:
              </label>
              <input
                type="date"
                value={editModal.fecha}
                onChange={(e) => setEditModal(prev => ({ ...prev, fecha: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                Precio:
              </label>
              <input
                type="number"
                step="0.01"
                value={editModal.valor}
                onChange={(e) => setEditModal(prev => ({ ...prev, valor: e.target.value }))}
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
                onClick={() => setEditModal({ open: false, ticker: null, precio: null, fecha: '', valor: '' })}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importar CSV */}
      {csvImportModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '700px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1e293b' }}>
              📄 Importar Precios desde CSV - {csvImportModal.ticker?.ticker}
            </h3>

            {csvImportModal.step === 'upload' && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                    Seleccionar archivo CSV:
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file) {
                        setCsvImportModal(prev => ({ ...prev, loading: true }))
                        handleFileUpload(file)
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                    disabled={csvImportModal.loading}
                  />
                </div>

                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#64748b'
                }}>
                  <strong>Información del archivo CSV:</strong>
                  <br />• Primera fila debe contener headers con nombres de columnas
                  <br />• Debe incluir al menos una columna de fecha y una de precio
                  <br />• Formatos de fecha soportados: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
                  <br />• Separadores soportados: punto y coma (;) o coma (,)
                  <br />• Después de seleccionar el archivo, podrás mapear las columnas
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    onClick={() => setCsvImportModal({
                      open: false,
                      ticker: null,
                      file: null,
                      loading: false,
                      step: 'upload',
                      csvData: null,
                      columnMapping: { fecha: '', precio: '' }
                    })}
                    className="btn btn-outline-secondary"
                    style={{ padding: '8px 16px' }}
                    disabled={csvImportModal.loading}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}

            {csvImportModal.step === 'mapping' && csvImportModal.csvData && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#374151' }}>
                    Mapear Columnas del CSV
                  </h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6b7280' }}>
                    Archivo: <strong>{csvImportModal.file?.name}</strong> ({csvImportModal.csvData.totalLines} filas de datos)
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                      📅 Columna de Fecha:
                    </label>
                    <select
                      value={csvImportModal.columnMapping.fecha}
                      onChange={(e) => setCsvImportModal(prev => ({
                        ...prev,
                        columnMapping: { ...prev.columnMapping, fecha: e.target.value }
                      }))}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">-- Seleccionar columna de fecha --</option>
                      {csvImportModal.csvData.headers.map((header, index) => (
                        <option key={index} value={index.toString()}>{header}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                      💰 Columna de Precio:
                    </label>
                    <select
                      value={csvImportModal.columnMapping.precio}
                      onChange={(e) => setCsvImportModal(prev => ({
                        ...prev,
                        columnMapping: { ...prev.columnMapping, precio: e.target.value }
                      }))}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">-- Seleccionar columna de precio --</option>
                      {csvImportModal.csvData.headers.map((header, index) => (
                        <option key={index} value={index.toString()}>{header}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Vista previa de los datos */}
                <div style={{ marginBottom: '16px' }}>
                  <h5 style={{ margin: '0 0 8px 0', color: '#374151' }}>
                    Vista previa de los datos:
                  </h5>
                  <div style={{
                    maxHeight: '200px',
                    overflow: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          {csvImportModal.csvData.headers.map((header, index) => (
                            <th
                              key={index}
                              style={{
                                padding: '6px 8px',
                                border: '1px solid #e5e7eb',
                                textAlign: 'left',
                                fontWeight: 'bold',
                                backgroundColor:
                                  index == csvImportModal.columnMapping.fecha ? '#dcfce7' :
                                    index == csvImportModal.columnMapping.precio ? '#dcfce7' : '#f9fafb'
                              }}
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvImportModal.csvData.sampleData.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                style={{
                                  padding: '4px 8px',
                                  border: '1px solid #e5e7eb',
                                  backgroundColor:
                                    cellIndex == csvImportModal.columnMapping.fecha ? '#dcfce7' :
                                      cellIndex == csvImportModal.columnMapping.precio ? '#dcfce7' : 'white'
                                }}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <button
                    onClick={() => setCsvImportModal(prev => ({
                      ...prev,
                      step: 'upload',
                      csvData: null,
                      columnMapping: { fecha: '', precio: '' }
                    }))}
                    className="btn btn-outline-secondary"
                    style={{ padding: '8px 16px' }}
                    disabled={csvImportModal.loading}
                  >
                    ← Volver
                  </button>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setCsvImportModal({
                        open: false,
                        ticker: null,
                        file: null,
                        loading: false,
                        step: 'upload',
                        csvData: null,
                        columnMapping: { fecha: '', precio: '' }
                      })}
                      className="btn btn-outline-secondary"
                      style={{ padding: '8px 16px' }}
                      disabled={csvImportModal.loading}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => importCsvPrices(
                        csvImportModal.ticker,
                        csvImportModal.file,
                        csvImportModal.columnMapping
                      )}
                      className="btn btn-success"
                      style={{
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      disabled={csvImportModal.loading || !csvImportModal.columnMapping.fecha || !csvImportModal.columnMapping.precio}
                    >
                      {csvImportModal.loading ? (
                        <>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ animation: 'spin 1s linear infinite' }}
                          >
                            <path d="M21 12a9 9 0 11-6.219-8.56" />
                          </svg>
                          Importando...
                        </>
                      ) : (
                        '📄 Importar CSV'
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}