import React, { useEffect, useState } from 'react'
import { API } from './config'
import { fmtDateLima } from './utils'
import RefreshModal from './RefreshModal.jsx'

export default function TickerHistoricoDetalle({ ticker, onBack }){
  const [historicos, setHistoricos] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [inversiones, setInversiones] = useState([])
  const [refreshModal, setRefreshModal] = useState({ 
    open: false, 
    loading: false, 
    attempts: [], 
    message: '', 
    inserted: 0, 
    source: null, 
    title: '', 
    steps: [], 
    from: null, 
    to: null 
  })
  const [editModal, setEditModal] = useState({ 
    open: false, 
    precio: null, 
    fecha: '', 
    valor: '' 
  })
  const [deleting, setDeleting] = useState(null)

  // Cargar datos históricos e inversiones
  useEffect(() => {
    if (!ticker?.id) return
    
    const loadData = async () => {
      setLoading(true)
      try {
        // Cargar históricos e inversiones en paralelo
        const [historicosResponse, inversionesResponse] = await Promise.all([
          fetch(`${API}/historicos/${ticker.id}?from=1970-01-01`),
          fetch(`${API}/tickers/${ticker.id}/inversiones`)
        ])
        
        if (historicosResponse.ok) {
          const historicosData = await historicosResponse.json()
          const items = historicosData.items || []
          items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
          setHistoricos(items)
        }
        
        if (inversionesResponse.ok) {
          const inversionesData = await inversionesResponse.json()
          setInversiones(inversionesData.items || [])
        }
      } catch (error) {
        console.error('Error loading data:', error)
        setHistoricos([])
        setInversiones([])
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [ticker?.id])

  // Función para actualizar precios
  const doRefresh = async () => {
    setRefreshing(true)
    
    // Encontrar la fecha de la primera inversión
    let fechaPrimeraInversion = null
    if (inversiones && inversiones.length > 0) {
      const primeraInversion = inversiones.reduce((min, inv) => {
        const fechaInv = new Date(inv.fecha)
        const fechaMin = new Date(min.fecha)
        return fechaInv < fechaMin ? inv : min
      })
      fechaPrimeraInversion = primeraInversion.fecha
    }

    setRefreshModal({
      open: true,
      loading: true,
      attempts: [],
      message: '',
      inserted: 0,
      source: null,
      title: `Actualizando ${ticker.ticker}${fechaPrimeraInversion ? ` desde ${fechaPrimeraInversion}` : ''}`,
      steps: [
        { api: 'Polygon', status: 'consultando' },
        { api: 'Alpha Vantage', status: 'pendiente' }
      ],
      from: fechaPrimeraInversion,
      to: null
    })

    try {
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
      const data = await response.json()
      
      setRefreshModal(prev => ({
        ...prev,
        loading: false,
        attempts: data.attempts || [],
        message: data.message || data.error || '',
        inserted: data.inserted || 0,
        source: data.source || null
      }))

      // Recargar datos después de actualizar
      setTimeout(async () => {
        try {
          const [historicosResponse, inversionesResponse] = await Promise.all([
            fetch(`${API}/historicos/${ticker.id}?from=1970-01-01`),
            fetch(`${API}/tickers/${ticker.id}/inversiones`)
          ])
          
          if (historicosResponse.ok) {
            const historicosData = await historicosResponse.json()
            const items = historicosData.items || []
            items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            setHistoricos(items)
          }
          
          if (inversionesResponse.ok) {
            const inversionesData = await inversionesResponse.json()
            setInversiones(inversionesData.items || [])
          }
        } catch (error) {
          console.error('Error reloading data:', error)
        }
      }, 1000)

      // Cerrar modal después de 3 segundos
      setTimeout(() => {
        setRefreshModal(prev => ({ ...prev, open: false }))
      }, 3000)

    } catch (error) {
      console.error('Error refreshing prices:', error)
      setRefreshModal(prev => ({
        ...prev,
        loading: false,
        message: 'Error al actualizar precios'
      }))
      
      setTimeout(() => {
        setRefreshModal(prev => ({ ...prev, open: false }))
      }, 3000)
    } finally {
      setRefreshing(false)
    }
  }

  // Función para abrir modal de edición
  function handleEdit(precioItem) {
    setEditModal({
      open: true,
      precio: precioItem,
      fecha: precioItem.fecha,
      valor: precioItem.precio.toString()
    })
  }

  // Función para guardar cambios
  async function handleSaveEdit() {
    if (!editModal.precio || !editModal.fecha || !editModal.valor) return
    
    try {
      const response = await fetch(`${API}/tickers/${ticker.id}/precio`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: editModal.fecha,
          precio: parseFloat(editModal.valor)
        })
      })
      
      if (response.ok) {
        setEditModal({ open: false, precio: null, fecha: '', valor: '' })
        // Recargar datos
        const historicosResponse = await fetch(`${API}/historicos/${ticker.id}?from=1970-01-01`)
        if (historicosResponse.ok) {
          const historicosData = await historicosResponse.json()
          const items = historicosData.items || []
          items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
          setHistoricos(items)
        }
      } else {
        alert('Error al actualizar el precio')
      }
    } catch (error) {
      console.error('Error updating price:', error)
      alert('Error al actualizar el precio')
    }
  }

  // Función para eliminar precio
  async function handleDelete(precioItem) {
    if (!confirm(`¿Estás seguro de eliminar el precio del ${fmtDateLima(precioItem.fecha)}?`)) return
    
    setDeleting(precioItem.fecha)
    
    try {
      const response = await fetch(`${API}/historicos/${precioItem.id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Recargar datos
        const historicosResponse = await fetch(`${API}/historicos/${ticker.id}?from=1970-01-01`)
        if (historicosResponse.ok) {
          const historicosData = await historicosResponse.json()
          const items = historicosData.items || []
          items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
          setHistoricos(items)
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

  return (
    <div className="container">
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={onBack} className="btn">← Volver</button>
        <button 
          onClick={doRefresh} 
          disabled={refreshing} 
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: refreshing ? 0.7 : 1
          }}
        >
          {refreshing && (
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
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
          )}
          {refreshing ? 'Actualizando...' : 'Actualizar precios'}
        </button>
      </div>

      {/* Ticker Info */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 className="card-title" style={{ margin: 0 }}>
          {ticker?.ticker} · {ticker?.nombre}
        </h3>
        <div className="text-muted">Moneda: {ticker?.moneda}</div>
      </div>

      {/* Información de inversiones */}
      {inversiones.length > 0 && (
        <div className="card" style={{marginBottom: 12}}>
          <h3 className="card-title">Información de Inversiones</h3>
          <div style={{fontSize: '14px', color: '#666'}}>
            <strong>Total de inversiones:</strong> {inversiones.length}<br/>
            <strong>Primera inversión:</strong> {inversiones.reduce((min, inv) => {
              const fechaInv = new Date(inv.fecha)
              const fechaMin = new Date(min.fecha)
              return fechaInv < fechaMin ? inv : min
            }).fecha}<br/>
            <strong>Última inversión:</strong> {inversiones.reduce((max, inv) => {
              const fechaInv = new Date(inv.fecha)
              const fechaMax = new Date(max.fecha)
              return fechaInv > fechaMax ? inv : max
            }).fecha}
          </div>
        </div>
      )}

      {/* Históricos */}
      <div className="card">
        <h3 className="card-title">Precios Históricos</h3>
        
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <svg 
              width="32" 
              height="32" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#2563eb" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ animation: 'spin 1s linear infinite' }}
            >
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
            <div>Cargando datos históricos...</div>
          </div>
        ) : historicos.length === 0 ? (
          <div className="text-muted">Sin datos históricos disponibles</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Precio</th>
                  <th>Fuente</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {historicos.map((item, index) => (
                  <tr key={index}>
                    <td>{fmtDateLima(item.fecha)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {new Intl.NumberFormat('es-PE', {
                        style: 'currency',
                        currency: ticker?.moneda || 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(item.precio)}
                    </td>
                    <td>{item.fuente_api || 'N/A'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEdit(item)}
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
                          onClick={() => handleDelete(item)}
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
                onClick={() => setEditModal({ open: false, precio: null, fecha: '', valor: '' })}
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

      {/* Refresh Modal */}
      {refreshModal.open && (
        <RefreshModal
          open={refreshModal.open}
          loading={refreshModal.loading}
          title={refreshModal.title}
          message={refreshModal.message}
          inserted={refreshModal.inserted}
          source={refreshModal.source}
          steps={refreshModal.steps}
          from={refreshModal.from}
          to={refreshModal.to}
          onClose={() => setRefreshModal(prev => ({ ...prev, open: false }))}
        />
      )}
    </div>
  )
}