import React, { useState, useEffect } from 'react'
import { API } from './config'
import { fmtDateLima } from './utils'

export default function TipoCambioView(){
  const [items, setItems] = useState([])
  const [limit, setLimit] = useState(60)
  const [loading, setLoading] = useState(false)
  const [fecha, setFecha] = useState('')
  const [usdPen, setUsdPen] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Estados para edición
  const [editModal, setEditModal] = useState({
    open: false,
    fecha: '',
    usdPen: '',
    fuente: 'manual'
  })
  const [deleting, setDeleting] = useState(null)

  const load = async ()=>{
    setLoading(true)
    try{
      const r = await fetch(`${API}/config/tipo-cambio?limit=${limit}`)
      const d = await r.json().catch(()=>({}))
      setItems(d.items||[])
    }catch{
      setItems([])
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [limit])

  const latest = items[0] || null

  const fmtRate = (v)=>{
    const n = Number(v)
    if (!isFinite(n)) return '-'
    return n.toFixed(3)
  }

  const addManual = async ()=>{
    const f = (fecha||'').trim()
    const v = Number(usdPen)
    if (!f || !isFinite(v) || v <= 0){ alert('Ingrese fecha y un valor válido (> 0)'); return }
    setSaving(true)
    try{
      const r = await fetch(`${API}/config/tipo-cambio`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fecha: f, usd_pen: v, fuente_api:'manual' }) })
      const d = await r.json().catch(()=>({}))
      if (!r.ok || d.error){ throw new Error(d.error || 'No se pudo guardar') }
      setFecha(''); setUsdPen('')
      await load()
      alert('Tipo de cambio guardado')
    }catch(e){ alert(e.message) }
    finally{ setSaving(false) }
  }


  // Función para abrir modal de edición
  const handleEdit = (item) => {
    setEditModal({
      open: true,
      fecha: item.fecha,
      usdPen: item.usd_pen.toString(),
      fuente: item.fuente_api || 'manual'
    })
  }

  // Función para guardar cambios
  const handleSaveEdit = async () => {
    if (!editModal.fecha || !editModal.usdPen) return
    
    try {
      const response = await fetch(`${API}/config/tipo-cambio/${editModal.fecha}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usd_pen: parseFloat(editModal.usdPen),
          fuente_api: editModal.fuente
        })
      })
      
      if (response.ok) {
        setEditModal({ open: false, fecha: '', usdPen: '', fuente: 'manual' })
        await load()
        alert('Tipo de cambio actualizado exitosamente')
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Error al actualizar: ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error('Error updating exchange rate:', error)
      alert('Error al actualizar el tipo de cambio')
    }
  }

  // Función para eliminar
  const handleDelete = async (fecha) => {
    if (!confirm(`¿Estás seguro de eliminar el tipo de cambio del ${fmtDateLima(fecha)}?`)) return
    
    setDeleting(fecha)
    
    try {
      const response = await fetch(`${API}/config/tipo-cambio/${fecha}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        await load()
        alert('Tipo de cambio eliminado exitosamente')
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Error al eliminar: ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error('Error deleting exchange rate:', error)
      alert('Error al eliminar el tipo de cambio')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="container">
      <h2>Tipo de Cambio</h2>

      <div className="card" style={{marginBottom:12}}>
        <h3 className="card-title" style={{margin:0}}>Recientes</h3>
        {latest ? (
          <div className="text-muted" style={{marginTop:4}}>
            Último: 1 USD = {fmtRate(latest.usd_pen)} PEN · {fmtDateLima(latest.fecha)}
          </div>
        ) : (
          <div className="text-muted" style={{marginTop:4}}>Sin datos</div>
        )}

        <table style={{marginTop:12, margin:0}}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>USD → PEN</th>
              <th>Fuente</th>
              <th style={{textAlign:'center', width:'120px'}}>Acciones</th>
            </tr>
          </thead>
        </table>
        
        <div style={{maxHeight:'calc(60vh - 40px)', overflow:'auto', marginTop:'-1px'}}>
          <table style={{margin:0}}>
            <colgroup>
              <col />
              <col />
              <col />
              <col style={{width:'120px'}} />
            </colgroup>
            <tbody>
              {items.map((it)=> (
                <tr key={it.fecha}>
                  <td>{fmtDateLima(it.fecha)}</td>
                  <td style={{textAlign:'right'}}>{fmtRate(it.usd_pen)}</td>
                  <td>{it.fuente_api || '-'}</td>
                  <td style={{textAlign:'center'}}>
                    <div style={{display:'flex', gap:'4px', justifyContent:'center'}}>
                      <button
                        onClick={() => handleEdit(it)}
                        className="btn btn-sm"
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          backgroundColor: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="Editar tipo de cambio"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(it.fecha)}
                        disabled={deleting === it.fecha}
                        className="btn btn-sm"
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          backgroundColor: deleting === it.fecha ? '#f9fafb' : '#fef2f2',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          cursor: deleting === it.fecha ? 'not-allowed' : 'pointer',
                          opacity: deleting === it.fecha ? 0.6 : 1
                        }}
                        title="Eliminar tipo de cambio"
                      >
                        {deleting === it.fecha ? '⏳' : '🗑️'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-muted" style={{marginTop:8}}>
          Mostrando {items.length} registros · Límite:
          <select value={limit} onChange={e=>setLimit(Number(e.target.value))} style={{marginLeft:6}}>
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={120}>120</option>
            <option value={365}>365</option>
          </select>
        </div>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <h3 className="card-title">Agregar manual</h3>
        <div className="grid grid-tight" style={{alignItems:'end'}}>
          <div className="form-group">
            <label>Fecha:</label>
            <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} />
          </div>
          <div className="form-group">
            <label>USD → PEN:</label>
            <input type="number" min="0" step="0.0001" value={usdPen} onChange={e=>setUsdPen(e.target.value)} />
          </div>
          <div>
            <button onClick={addManual} disabled={saving || !fecha || !usdPen} className="btn-primary">Guardar</button>
          </div>
        </div>
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
            <h3 style={{ margin: '0 0 16px 0' }}>Editar Tipo de Cambio</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                Fecha:
              </label>
              <input
                type="date"
                value={editModal.fecha}
                disabled
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: '#f9fafb',
                  color: '#6b7280'
                }}
              />
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                La fecha no se puede modificar
              </div>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                USD → PEN:
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={editModal.usdPen}
                onChange={(e) => setEditModal(prev => ({ ...prev, usdPen: e.target.value }))}
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
                Fuente:
              </label>
              <select
                value={editModal.fuente}
                onChange={(e) => setEditModal(prev => ({ ...prev, fuente: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px'
                }}
              >
                <option value="manual">Manual</option>
                <option value="api">API</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditModal({ open: false, fecha: '', usdPen: '', fuente: 'manual' })}
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
                disabled={!editModal.usdPen}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: !editModal.usdPen ? '#d1d5db' : '#2563eb',
                  color: 'white',
                  cursor: !editModal.usdPen ? 'not-allowed' : 'pointer'
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}