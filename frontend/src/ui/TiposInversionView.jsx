import React, { useState, useEffect } from 'react'
import { API } from './config.js'

export default function TiposInversionView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [deleting, setDeleting] = useState(null)

  // Estados del formulario
  const [formData, setFormData] = useState({
    nombre: '',
    activo: 1
  })

  useEffect(() => {
    loadTiposInversion()
  }, [])

  const loadTiposInversion = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/tipos-inversion`)
      const d = await r.json().catch(() => ({}))
      setItems(d.items || [])
    } catch (e) {
      console.error('Error loading tipos de inversión:', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleNuevo = () => {
    setEditando(null)
    setFormData({ nombre: '' })
    setShowModal(true)
  }

  const handleEditar = (item) => {
    setEditando(item)
    setFormData({
      nombre: item.nombre,
      activo: item.activo ?? 1
    })
    setShowModal(true)
  }

  const handleGuardar = async (e) => {
    e.preventDefault()

    if (!formData.nombre.trim()) {
      alert('El nombre es requerido')
      return
    }

    try {
      const method = editando ? 'PATCH' : 'POST'
      const url = editando ? `${API}/tipos-inversion/${editando.id}` : `${API}/tipos-inversion`

      const r = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const d = await r.json().catch(() => ({}))

      if (!r.ok || d.error) {
        throw new Error(d.error || 'No se pudo guardar')
      }

      alert(editando ? 'Tipo de inversión actualizado exitosamente' : 'Tipo de inversión creado exitosamente')
      setShowModal(false)
      loadTiposInversion()
    } catch (e) {
      alert(e.message)
    }
  }

  const handleEliminar = async (item) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${item.nombre}"?`)) {
      return
    }

    setDeleting(item.id)
    try {
      const r = await fetch(`${API}/tipos-inversion/${item.id}`, { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))

      if (!r.ok || d.error) {
        throw new Error(d.error || 'No se pudo eliminar')
      }

      alert('Tipo de inversión eliminado exitosamente')
      loadTiposInversion()
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const handleToggleActivo = async (item) => {
    try {
      const nuevoEstado = item.activo ? 0 : 1
      const r = await fetch(`${API}/tipos-inversion/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nuevoEstado })
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) {
        throw new Error(d.error || 'No se pudo actualizar')
      }
      loadTiposInversion()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Tipos de Inversión</h2>
        <button className="btn btn-primary" onClick={handleNuevo}>
          ➕ Nuevo Tipo de Inversión
        </button>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div className="card">
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Estado</th>
                <th style={{ textAlign: 'center', width: '150px' }}>Acciones</th>
              </tr>
            </thead>
          </table>

          <div style={{ maxHeight: 'calc(70vh - 40px)', overflow: 'auto', marginTop: '-1px' }}>
            <table style={{ margin: 0 }}>
              <colgroup>
                <col style={{ width: '80px' }} />
                <col />
                <col style={{ width: '100px' }} />
                <col style={{ width: '150px' }} />
              </colgroup>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                      No hay tipos de inversión registrados
                    </td>
                  </tr>
                ) : (
                  items.map(item => (
                    <tr key={item.id} style={{ opacity: item.activo ? 1 : 0.5 }}>
                      <td>{item.id}</td>
                      <td><strong>{item.nombre}</strong></td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleActivo(item)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: '600',
                            backgroundColor: item.activo ? '#dcfce7' : '#fee2e2',
                            color: item.activo ? '#166534' : '#991b1b',
                            border: `1px solid ${item.activo ? '#86efac' : '#fca5a5'}`,
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          title={item.activo ? 'Clic para desactivar' : 'Clic para activar'}
                        >
                          {item.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleEditar(item)}
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
                            onClick={() => handleEliminar(item)}
                            disabled={deleting === item.id}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              backgroundColor: '#fef2f2',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                            title="Eliminar"
                          >
                            {deleting === item.id ? '⏳' : '🗑️'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Crear/Editar */}
      {showModal && (
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
                {editando ? 'Editar Tipo de Inversión' : 'Nuevo Tipo de Inversión'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
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
              <form onSubmit={handleGuardar}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                    Nombre: *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    required
                    maxLength="100"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px'
                    }}
                    placeholder="Ej: Acciones, ETFs, Bonos..."
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowModal(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    {editando ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

