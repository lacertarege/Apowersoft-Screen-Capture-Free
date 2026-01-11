import React, { useEffect, useMemo, useState } from 'react'
import { API } from './config'

export default function NuevaInversionModal({ open, onClose, onSave, empresa }) {
  const [importe, setImporte] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [fecha, setFecha] = useState('')
  const [plataforma, setPlataforma] = useState('Trii')
  const [esReinversion, setEsReinversion] = useState(false)
  const [precioHistorico, setPrecioHistorico] = useState(null)
  const [buscandoPrecio, setBuscandoPrecio] = useState(false)
  const [cantidadAutoCalculada, setCantidadAutoCalculada] = useState(false)

  useEffect(() => {
    if (open) {
      const hoy = new Date().toISOString().split('T')[0]
      setFecha(hoy); setImporte(''); setCantidad(''); setPlataforma('Trii')
      setEsReinversion(false)
      setPrecioHistorico(null)
      setCantidadAutoCalculada(false)
    }
  }, [open])

  // Buscar precio histórico cuando cambie la fecha o el importe
  useEffect(() => {
    if (!open || !empresa?.id || !fecha || !importe) {
      setPrecioHistorico(null)
      if (cantidadAutoCalculada) {
        setCantidad('')
        setCantidadAutoCalculada(false)
      }
      return
    }

    const importeNum = Number(importe)
    if (!isFinite(importeNum) || importeNum <= 0) {
      setPrecioHistorico(null)
      if (cantidadAutoCalculada) {
        setCantidad('')
        setCantidadAutoCalculada(false)
      }
      return
    }

    // Buscar precio histórico para la fecha
    const buscarPrecio = async () => {
      setBuscandoPrecio(true)
      try {
        // Obtener precios históricos desde la fecha hacia atrás
        const response = await fetch(`${API}/historicos/${empresa.id}?from=${fecha}`)
        if (response.ok) {
          const data = await response.json()
          const items = data.items || []
          // Buscar precio exacto para la fecha
          const precioExacto = items.find(p => p.fecha === fecha)
          if (precioExacto && precioExacto.precio) {
            const precio = Number(precioExacto.precio)
            if (isFinite(precio) && precio > 0) {
              setPrecioHistorico(precio)
              // Calcular cantidad automáticamente
              const cantidadCalculada = importeNum / precio
              setCantidad(cantidadCalculada.toFixed(6).replace(/\.?0+$/, ''))
              setCantidadAutoCalculada(true)
              return
            }
          }
        }
        // Si no hay precio para esa fecha, limpiar
        setPrecioHistorico(null)
        if (cantidadAutoCalculada) {
          setCantidad('')
          setCantidadAutoCalculada(false)
        }
      } catch (error) {
        console.error('Error buscando precio histórico:', error)
        setPrecioHistorico(null)
        if (cantidadAutoCalculada) {
          setCantidad('')
          setCantidadAutoCalculada(false)
        }
      } finally {
        setBuscandoPrecio(false)
      }
    }

    buscarPrecio()
  }, [fecha, importe, empresa?.id, open, cantidadAutoCalculada])

  const apertura = useMemo(() => {
    const imp = Number(importe); const cant = Number(cantidad)
    if (!imp || !cant) return null
    if (cant === 0) return null
    const v = imp / cant
    return Number.isFinite(v) ? v : null
  }, [importe, cantidad])

  function save() {
    if (!importe || !cantidad || !fecha) return
    onSave({
      fecha,
      importe: Number(importe),
      cantidad: Number(cantidad),
      plataforma,
      origen_capital: esReinversion ? 'REINVERSION' : 'FRESH_CASH'
    })
  }

  if (!open) return null

  const canSave = importe && cantidad && fecha && Number(cantidad) !== 0

  return (
    <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
      <div className="modal-content" style={{ maxWidth: '500px', maxHeight: '85vh' }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>
              Nueva Inversión
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
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
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
                <label>
                  Cantidad
                  {precioHistorico && (
                    <span style={{
                      fontSize: '11px',
                      color: 'var(--fg-secondary)',
                      fontWeight: 'normal',
                      marginLeft: '6px'
                    }}>
                      (auto)
                    </span>
                  )}
                </label>
                <input
                  value={cantidad}
                  onChange={e => {
                    setCantidad(e.target.value)
                    setCantidadAutoCalculada(false)
                  }}
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="0.00"
                  disabled={buscandoPrecio}
                  style={{
                    backgroundColor: cantidadAutoCalculada ? 'var(--bg)' : undefined
                  }}
                />
                {buscandoPrecio && (
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--fg-secondary)',
                    marginTop: '4px'
                  }}>
                    Buscando precio histórico...
                  </div>
                )}
                {precioHistorico && !buscandoPrecio && (
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--fg-secondary)',
                    marginTop: '4px'
                  }}>
                    Precio: {new Intl.NumberFormat('es-PE', {
                      style: 'currency',
                      currency: empresa?.moneda || 'USD'
                    }).format(precioHistorico)}
                  </div>
                )}
              </div>
            </div>

            {/* Precio de apertura calculado */}
            {apertura !== null && (
              <div style={{
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--bg)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--fg-secondary)',
                  marginBottom: '2px',
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
              <select value={plataforma} onChange={e => setPlataforma(e.target.value)}>
                <option value="Trii">Trii</option>
                <option value="Tyba">Tyba</option>
                <option value="Etoro">Etoro</option>
                <option value="Pacifico seguros">Pacífico Seguros</option>
                <option value="BBVA">BBVA</option>
              </select>
            </div>

            {/* Checkbox de Reinversión */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                <input
                  type="checkbox"
                  checked={esReinversion}
                  onChange={(e) => setEsReinversion(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                Esta inversión proviene de una desinversión reciente (capital reinvertido)
              </label>
              {esReinversion && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  background: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#92400e'
                }}>
                  💡 Esta inversión NO se contará como nuevo capital aportado en las métricas del dashboard.
                </div>
              )}            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              minWidth: '90px',
              fontSize: '14px'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="btn-primary"
            style={{
              padding: '10px 20px',
              minWidth: '130px',
              fontSize: '14px'
            }}
          >
            Guardar Inversión
          </button>
        </div>
      </div>
    </div>
  )
}