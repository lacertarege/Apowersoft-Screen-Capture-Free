import React, { useEffect, useState } from 'react'

export default function EditTickerModal({ open, onClose, onSave, item, tipos = [] }){
  const [moneda, setMoneda] = useState('USD')
  const [tipoInversionId, setTipoInversionId] = useState('')

  useEffect(()=>{
    if (open){
      setMoneda(item?.moneda || 'USD')
      const current = item?.tipo_inversion_id != null ? String(item.tipo_inversion_id) : (tipos[0] ? String(tipos[0].id) : '')
      setTipoInversionId(current)
    }
  }, [open, item?.id, item?.moneda, item?.tipo_inversion_id, JSON.stringify(tipos)])

  if (!open) return null

  const canSave = moneda && (tipoInversionId !== '')

  const handleSave = ()=>{
    if (!canSave) return
    onSave({ moneda, tipo_inversion_id: Number(tipoInversionId) })
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
      <div className="modal-content" style={{ maxWidth: '500px', maxHeight: '85vh' }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>
              Editar Empresa
            </h3>
            <p style={{ 
              margin: '4px 0 0 0', 
              fontSize: '14px', 
              color: 'var(--fg-secondary)',
              fontWeight: 500
            }}>
              {item?.ticker} • {item?.nombre}
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
            {/* Moneda y Tipo en grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Moneda</label>
                <select value={moneda} onChange={e=>setMoneda(e.target.value)} autoFocus>
                  <option value="USD">🇺🇸 Dólar (USD)</option>
                  <option value="PEN">🇵🇪 Sol (PEN)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tipo</label>
                <select value={tipoInversionId} onChange={e=>setTipoInversionId(e.target.value)}>
                  {tipos.length === 0 ? (
                    <option value="">Sin tipos disponibles</option>
                  ) : (
                    tipos.map(t=> (
                      <option key={t.id} value={String(t.id)}>{t.nombre}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Nota informativa */}
            <div style={{
              padding: 'var(--space-sm) var(--space-md)',
              background: 'var(--info-bg)',
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(90, 200, 250, 0.3)',
              display: 'flex',
              gap: 'var(--space-sm)',
              alignItems: 'start'
            }}>
              <span style={{ fontSize: '16px' }}>ℹ️</span>
              <p style={{ 
                margin: 0, 
                fontSize: '13px', 
                color: 'var(--fg-secondary)',
                lineHeight: 1.5
              }}>
                Solo puedes editar la moneda y el tipo de inversión. El símbolo y el nombre no se pueden modificar.
              </p>
            </div>
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
            onClick={handleSave} 
            disabled={!canSave} 
            className="btn-primary"
            style={{
              padding: '10px 20px',
              minWidth: '110px',
              fontSize: '14px'
            }}
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  )
}