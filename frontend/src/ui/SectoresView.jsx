import React, { useEffect, useState } from 'react'
import { API } from './config'

export default function SectoresView() {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)

    // Modal state
    const [open, setOpen] = useState(false)
    const [editItem, setEditItem] = useState(null)

    // Form state
    const [nombre, setNombre] = useState('')
    const [descripcion, setDescripcion] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        fetchItems()
    }, [])

    function fetchItems() {
        setLoading(true)
        fetch(`${API}/sectores`)
            .then(r => r.json())
            .then(d => {
                setItems(d.items || [])
                setLoading(false)
            })
            .catch(e => {
                console.error(e)
                setLoading(false)
            })
    }

    function handleOpenNew() {
        setEditItem(null)
        setNombre('')
        setDescripcion('')
        setError('')
        setOpen(true)
    }

    function handleOpenEdit(it) {
        setEditItem(it)
        setNombre(it.nombre)
        setDescripcion(it.descripcion || '')
        setError('')
        setOpen(true)
    }

    function handleClose() {
        setOpen(false)
        setEditItem(null)
    }

    async function handleSave() {
        if (!nombre) {
            setError('El nombre es requerido')
            return
        }

        try {
            const url = editItem ? `${API}/sectores/${editItem.id}` : `${API}/sectores`
            const method = editItem ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, descripcion })
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Error al guardar')
            }

            handleClose()
            fetchItems()
        } catch (e) {
            setError(e.message)
        }
    }

    async function handleDelete(it) {
        if (!confirm(`¿Eliminar sector "${it.nombre}"?`)) return
        try {
            const res = await fetch(`${API}/sectores/${it.id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || 'Error eliminando')
            } else {
                fetchItems()
            }
        } catch (e) {
            alert(e.message)
        }
    }

    return (
        <div className="container-fluid">
            <div className="flex-between" style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Gestión de Sectores</h2>
                <button onClick={handleOpenNew} className="btn btn-primary">+ Nuevo Sector</button>
            </div>

            {loading && <div style={{ padding: 20 }}>Cargando...</div>}

            {!loading && (
                <div style={{ overflowX: 'auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', width: '25%' }}>Nombre</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', width: '60%' }}>Descripción</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(it => (
                                <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px 16px' }}><strong>{it.nombre}</strong></td>
                                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{it.descripcion}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => handleOpenEdit(it)}
                                            className="btn"
                                            style={{ marginRight: 8, padding: '4px 8px', fontSize: '12px' }}
                                        >
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(it)}
                                            className="btn"
                                            style={{ padding: '4px 8px', fontSize: '12px', color: '#ef4444' }}
                                        >
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                                        No hay sectores registrados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {open && (
                <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && handleClose()}>
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3>{editItem ? 'Editar Sector' : 'Nuevo Sector'}</h3>
                            <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>×</button>
                        </div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

                            <div className="form-group">
                                <label>Nombre</label>
                                <input
                                    type="text"
                                    value={nombre}
                                    onChange={e => setNombre(e.target.value)}
                                    placeholder="Ej. Tecnología"
                                    autoFocus
                                />
                            </div>

                            <div className="form-group">
                                <label>Descripción</label>
                                <textarea
                                    value={descripcion}
                                    onChange={e => setDescripcion(e.target.value)}
                                    placeholder="Descripción del sector..."
                                    rows={3}
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={handleClose}>Cancelar</button>
                            <button onClick={handleSave} className="btn-primary">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
