import React, { useEffect, useState } from 'react'
import { API } from './config'

export default function EditarInversionModal({ open, onClose, onSave, inversion, empresa }) {
  const [importe, setImporte] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [fecha, setFecha] = useState('')
  const [plataforma, setPlataforma] = useState(inversion?.plataforma || 'Trii')
  const [plataformas, setPlataformas] = useState([])
  const [exchange, setExchange] = useState(inversion?.exchange || 'BVL')
  const [exchanges, setExchanges] = useState([])

  useEffect(() => {
    // Cargar plataformas
    fetch(`${API}/plataformas?activo=1`)
      .then(r => r.json())
      .then(data => setPlataformas(data.items || []))
      .catch(err => console.error('Error cargando plataformas:', err))

    // Cargar exchanges
    fetch(`${API}/exchanges?activo=1`)
      .then(r => r.json())
      .then(data => setExchanges(data.items || []))
      .catch(err => console.error('Error cargando exchanges:', err))
  }, [])

  useEffect(() => {
    if (open && inversion) {
      setFecha(inversion.fecha || '')
      setImporte(inversion.importe || '')
      setCantidad(inversion.cantidad || '')
      setPlataforma(inversion.plataforma || 'Trii')

      // Si la inversión ya tiene exchange asociado, usarlo
      // Si no, intentar derivarlo de la plataforma si existiera esa lógica, o usar default BVL
      setExchange(inversion.exchange || 'BVL')
    }
  }, [open, inversion])

  const apertura = React.useMemo(() => {
    const imp = Number(importe); const cant = Number(cantidad)
    if (!imp || !cant) return null
    if (cant === 0) return null
    const v = imp / cant
    return Number.isFinite(v) ? v : null
  }, [importe, cantidad])

  function save() {
    if (!importe || !cantidad || !fecha) return
    onSave({ fecha, importe: Number(importe), cantidad: Number(cantidad), plataforma })
  }

  if (!open) return null

  const canSave = importe && cantidad && fecha && Number(cantidad) !== 0

  return (
    <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>
              Editar Inversión
            </h3>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: 'var(--fg-secondary)',
              fontWeight: 500
            }}>
              {empresa?.ticker} • {empresa?.nombre}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              padding: 0,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              color: 'var(--fg-secondary)',
              transition: 'all var(--transition-fast)'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.06)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
            {/* Fecha */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Fecha de inversión</label>
              <input
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                type="date"
                autoFocus
              />
            </div>

            {/* Importe y Cantidad en grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Importe ({empresa?.moneda || 'USD'})</label>
                <input
                  value={importe}
                  onChange={e => setImporte(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Cantidad</label>
                <input
                  value={cantidad}
                  onChange={e => setCantidad(e.target.value)}
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Precio de apertura calculado */}
            {apertura !== null && (
              <div style={{
                padding: 'var(--space-md) var(--space-lg)',
                background: 'var(--bg)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--fg-secondary)',
                  marginBottom: '4px',
                  fontWeight: 600
                }}>
                  Precio de apertura
                </div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: 'var(--fg)',
                  fontVariantNumeric: 'tabular-nums'
                }}>
                  {new Intl.NumberFormat('es-PE', {
                    style: 'currency',
                    currency: empresa?.moneda || 'USD'
                  }).format(apertura)}
                </div>
              </div>
            )}

            {/* Plataforma */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Plataforma</label>
              <select
                value={plataforma}
                onChange={e => setPlataforma(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">-- Seleccione --</option>
                {plataformas.map(p => (
                  <option key={p.id} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
            </div>

            {/* Exchange */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Exchange</label>
              <select
                value={exchange}
                onChange={e => setExchange(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="">-- Seleccione --</option>
                {exchanges.map(e => (
                  <option key={e.id} value={e.nombre}>{e.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              minWidth: '100px'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="btn-primary"
            style={{
              padding: '12px 24px',
              minWidth: '120px'
            }}
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  )
}
