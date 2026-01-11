import React, { useEffect, useState } from 'react'
import NumberCell from './NumberCell.jsx'
import TickerModal from './TickerModal.jsx'
import EditTickerModal from './EditTickerModal.jsx'
import NuevaInversionModal from './NuevaInversionModal.jsx'
import NuevaDesinversionModal from './NuevaDesinversionModal.jsx'
import TickersTable from './TickersTable.jsx'
import DetalleTicker from './DetalleTicker.jsx'
import RefreshModal from './RefreshModal.jsx'
import { API, checkBackendConnection } from './config'
import { useTickers } from '../hooks/useTickers.js'
import { useInvestments } from '../hooks/useInvestments.js'
import { PortfolioSummary } from '../components/PortfolioSummary.jsx'
import TickerEvolucionModal from './TickerEvolucionModal.jsx'

export default function EmpresasView() {
  // Hooks personalizados
  const {
    tickers: items,
    loading: tickersLoading,
    error: tickersError,
    fetchTickers,
    createTicker,
    updateTicker,
    deleteTicker,
    refreshTickerPrice
  } = useTickers()

  const {
    loading: investmentsLoading,
    createInvestment
  } = useInvestments()

  // Estados locales
  const [tipos, setTipos] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [empresa, setEmpresa] = useState(null)
  const [investOpen, setInvestOpen] = useState(false)
  const [desinvestOpen, setDesinvestOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [presupuesto, setPresupuesto] = useState(null)
  const [activeTab, setActiveTab] = useState('PEN')
  const [showClosed, setShowClosed] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [refreshModal, setRefreshModal] = useState({ open: false, loading: false, attempts: [], message: '', inserted: 0, source: null, title: '', steps: [], from: null, to: null })
  const [refreshingMap, setRefreshing] = useState({})
  const [tickerEvolucionId, setTickerEvolucionId] = useState(null)

  const PRESUPUESTO_NOMBRE = presupuesto?.nombre || 'Presupuesto de Inversiones'
  const PRESUPUESTO_VERSION = presupuesto?.version || '1.0.0'

  const [errorBackend, setErrorBackend] = useState(false)
  const [backendStatus, setBackendStatus] = useState({ connected: false, message: '' })

  useEffect(() => {
    // Verificar conexión con el backend
    checkBackendConnection().then(status => {
      setBackendStatus(status)
      if (status.connected) {
        setErrorBackend(false)
        // Cargar datos si la conexión es exitosa
        fetchTickers().catch(() => setErrorBackend(true))
        fetch(`${API}/config/tipos-inversion`)
          .then(r => r.json())
          .then(d => setTipos(d.items || []))
          .catch(() => {
            setTipos([])
            setErrorBackend(true)
          })
        fetch(`${API}/config/presupuesto`)
          .then(r => r.json())
          .then(d => setPresupuesto(d.item || null))
          .catch(() => {
            setPresupuesto(null)
            setErrorBackend(true)
          })
      } else {
        setErrorBackend(true)
      }
    })
  }, [fetchTickers])

  const onSaveTicker = async (payload) => {
    try {
      await createTicker(payload)
      setShowNew(false)
      // Recargar la lista de tickers para asegurar que se muestre la nueva empresa
      await fetchTickers()
    } catch (err) {
      console.error('Error guardando ticker:', err)
      alert(`Error: ${err.message}`)
    }
  }

  const onDeleteTicker = async (it) => {
    if (!confirm('¿Eliminar esta empresa?')) return
    try {
      await deleteTicker(it.id)
    } catch (err) {
      console.error('Error eliminando ticker:', err)
      alert(`Error: ${err.message}`)
    }
  }

  function onOpenInvest(it) {
    setEmpresa(it); setInvestOpen(true)
  }

  const onSaveInvest = async (payload) => {
    if (!empresa) return
    try {
      await createInvestment(empresa.id, payload)
      setInvestOpen(false)
      await fetchTickers() // Recargar lista
    } catch (err) {
      console.error('Error guardando inversión:', err)
      alert(`Error: ${err.message}`)
    }
  }

  function onOpenDesinvest(it) {
    setEmpresa(it)
    setDesinvestOpen(true)
  }

  const onSaveDesinvest = async (payload) => {
    if (!empresa) return
    try {
      const response = await createInvestment(empresa.id, payload)

      // Mostrar mensaje con rendimiento realizado si está disponible
      if (response?.realized_return !== undefined) {
        const msg = `Desinversión registrada exitosamente.\n\nRendimiento Realizado: ${new Intl.NumberFormat('es-PE', {
          style: 'currency',
          currency: empresa.moneda || 'USD'
        }).format(response.realized_return)} (${response.realized_return_rate >= 0 ? '+' : ''}${response.realized_return_rate.toFixed(2)}%)`
        alert(msg)
      }

      setDesinvestOpen(false)
      await fetchTickers() // Recargar lista
    } catch (err) {
      console.error('Error guardando desinversión:', err)
      alert(`Error: ${err.message}`)
    }
  }

  // Fecha actual en Lima (YYYY-MM-DD)
  function todayStrLima() {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' })
    return fmt.format(new Date())
  }

  async function onUpdatePrice(tk) {
    const baseSteps = [
      { api: 'Polygon', status: 'consultando' },
      { api: 'Alpha Vantage', status: 'pendiente' },
      { api: 'Yahoo Finance', status: 'pendiente' },
      { api: 'Servicio Local', status: 'pendiente' },
    ]
    function applyAttemptStatuses(steps, attempts = []) {
      const next = steps.map(s => ({ ...s }))
      const setStatus = (apiName, statuses = []) => {
        const idx = next.findIndex(s => s.api === apiName)
        if (idx >= 0) {
          if (statuses.some(s => s === 'ok')) next[idx].status = 'ok'
          else if (statuses.some(s => s === 'error' || s === 'fallo')) next[idx].status = 'fallo'
          else if (statuses.some(s => s === 'nodata' || s === 'skipped')) next[idx].status = 'fallo'
        }
      }
      const poly = attempts.filter(a => String(a.source || '').startsWith('polygon') || String(a.source || '').startsWith('latest:polygon')).map(a => a.status)
      const av = attempts.filter(a => String(a.source || '').startsWith('alphavantage') || String(a.source || '').startsWith('latest:alphavantage')).map(a => a.status)
      const yh = attempts.filter(a => String(a.source || '').startsWith('yahoo')).map(a => a.status)
      setStatus('Polygon', poly)
      setStatus('Alpha Vantage', av)
      setStatus('Yahoo Finance', yh)
      // Servicio Local (local/rapidapi)
      const local = attempts.filter(a => { const s = String(a.source || a.provider || a.api || '').toLowerCase(); return s.startsWith('local') || s.startsWith('latest:local') || s.includes('rapidapi') }).map(a => a.status)
      setStatus('Servicio Local', local)
      return next
    }
    setRefreshModal({ open: true, loading: true, attempts: [], message: '', inserted: 0, source: null, title: `Actualizando ${tk.ticker}`, steps: baseSteps, from: null, to: null })
    setRefreshing(prev => ({ ...prev, [tk.id]: true }))
    try {
      const r = await fetch(`${API}/tickers/${tk.id}/refresh`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      await fetchTickers()
      const steps = applyAttemptStatuses(baseSteps, d.attempts || [])
      setRefreshModal(m => ({ ...m, loading: false, attempts: d.attempts || [], message: d.message || d.error || '', inserted: d.inserted || 0, source: d.source || null, from: d.from || null, to: d.to || null, steps }))
    } catch (e) {
      setRefreshModal(m => ({ ...m, loading: false, attempts: [], message: 'No fue posible conectar con los servicios consultados', inserted: 0, source: null }))
    } finally {
      setRefreshing(prev => ({ ...prev, [tk.id]: false }))
    }
  }

  function onEditTickerOpen(it) {
    setEditItem(it); setEditOpen(true)
  }

  async function onEditTickerSave(payload) {
    if (!editItem) return
    try {
      await updateTicker(editItem.id, payload)
      setEditOpen(false)
      setEditItem(null)
      await fetchTickers() // Recargar para ver los cambios
    } catch (err) {
      alert(`Error al editar: ${err.message}`)
    }
  }

  // Función para navegar a un ticker específico
  const handleNavigateToTicker = (newTickerId) => {
    setDetailId(newTickerId)
  }

  // Obtener la lista de tickers filtrados y ordenados
  const getFilteredTickers = () => {
    return items.filter(x => x.moneda === activeTab)
  }

  // Obtener el índice actual del ticker en la lista
  const getCurrentTickerIndex = () => {
    const filteredTickers = getFilteredTickers()
    return filteredTickers.findIndex(t => t.id === detailId)
  }

  if (detailId) {
    const filteredTickers = getFilteredTickers()
    const currentIndex = getCurrentTickerIndex()

    return (
      <DetalleTicker
        tickerId={detailId}
        onBack={() => { fetchTickers(); setDetailId(null) }}
        onChanged={fetchTickers}
        tickersList={filteredTickers}
        currentIndex={currentIndex}
        onNavigateToTicker={handleNavigateToTicker}
      />
    )
  }
  return (
    <div className="container-fluid">
      {errorBackend && (
        <div className="alert alert-danger" role="alert">
          <strong>Error de conexión: </strong>
          <span>No se pudo conectar con el servidor backend en {API}. </span>
          {backendStatus.message && <span>Detalles: {backendStatus.message}</span>}
          <div style={{ marginTop: '8px' }}>
            <button onClick={() => window.location.reload()} className="btn btn-sm btn-primary">
              Reintentar conexión
            </button>
          </div>
        </div>
      )}
      <div className="flex-between" style={{ marginBottom: 8 }}>
        <div>
          <div className="text-muted" style={{ marginTop: 4 }}>Empresas</div>
        </div>
        <div className="btn-group">
          <button onClick={() => setShowNew(true)} className="btn btn-primary">+ Nueva Empresa</button>
        </div>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <button className={`btn btn-sm ${activeTab === 'PEN' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('PEN')}>Soles (PEN)</button>
        <button className={`btn btn-sm ${activeTab === 'USD' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('USD')}>Dólares (USD)</button>

        <div style={{ flex: 1 }}></div>

        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none', color: '#64748b' }}>
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>Mostrar Historial</span>
        </label>
      </div>

      {(() => {
        // Mostrar solo empresas de la moneda activa
        const filtered = items.filter(x => x.moneda === activeTab);
        return (
          <>
            <TickersTable
              items={filtered}
              currency={activeTab}
              showClosed={showClosed}
              onDelete={onDeleteTicker}
              onOpenInvest={onOpenInvest}
              onOpenDesinvest={onOpenDesinvest}
              onOpenDetail={(it) => setDetailId(it.id)}
              onUpdatePrice={onUpdatePrice}
              onEdit={onEditTickerOpen}
              refreshingMap={refreshingMap}
              onShowEvolucion={(it) => setTickerEvolucionId(it.id)}
            />
            <PortfolioSummary investments={filtered} currency={activeTab} />
            {tickerEvolucionId && (
              <TickerEvolucionModal
                open={!!tickerEvolucionId}
                tickerId={tickerEvolucionId}
                onClose={() => setTickerEvolucionId(null)}
              />
            )}
          </>
        )
      })()}

      <TickerModal open={showNew} onClose={() => setShowNew(false)} onSave={onSaveTicker} tipos={tipos} defaultMoneda={activeTab} />
      <NuevaInversionModal open={investOpen} onClose={() => setInvestOpen(false)} onSave={onSaveInvest} empresa={empresa} />
      <NuevaDesinversionModal open={desinvestOpen} onClose={() => setDesinvestOpen(false)} onSave={onSaveDesinvest} empresa={empresa} />
      <EditTickerModal open={editOpen} onClose={() => { setEditOpen(false); setEditItem(null) }} onSave={onEditTickerSave} item={editItem} tipos={tipos} />
      <RefreshModal open={refreshModal.open} title={refreshModal.title} loading={refreshModal.loading} attempts={refreshModal.attempts} message={refreshModal.message} inserted={refreshModal.inserted} source={refreshModal.source} steps={refreshModal.steps} from={refreshModal.from} to={refreshModal.to} onClose={() => setRefreshModal(m => ({ ...m, open: false }))} />
    </div>
  )
}