import React, { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3002'

// Common exchanges for dropdown
const EXCHANGES = [
    'BVL',
    'NYSE',
    'NASDAQ',
    'NYSE/NASDAQ',
    'AMEX',
    'LSE',
    'TSX',
    'CBOE',
    'OTC',
    'CRYPTO'
]

const COUNTRIES = [
    { code: 'PE', name: 'Perú' },
    { code: 'US', name: 'Estados Unidos' },
    { code: 'UK', name: 'Reino Unido' },
    { code: 'CA', name: 'Canadá' },
    { code: 'MX', name: 'México' },
    { code: 'BR', name: 'Brasil' },
    { code: 'CL', name: 'Chile' },
    { code: 'CO', name: 'Colombia' }
]

const CURRENCIES = ['USD', 'PEN', 'EUR', 'GBP']

export default function PlataformasView() {
    const [plataformas, setPlataformas] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [showInactive, setShowInactive] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        nombre: '',
        exchange: '',
        moneda_principal: 'USD',
        pais: '',
        url: '',
        activo: 1
    })

    const loadPlataformas = async () => {
        setLoading(true)
        try {
            const url = showInactive ? `${API}/plataformas` : `${API}/plataformas?activo=1`
            const res = await fetch(url)
            const data = await res.json()
            setPlataformas(data.items || [])
            setError(null)
        } catch (err) {
            setError('Error al cargar plataformas')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadPlataformas()
    }, [showInactive])

    const resetForm = () => {
        setFormData({
            nombre: '',
            exchange: '',
            moneda_principal: 'USD',
            pais: '',
            url: '',
            activo: 1
        })
        setEditingId(null)
    }

    const openModal = (plataforma = null) => {
        if (plataforma) {
            setFormData({
                nombre: plataforma.nombre || '',
                exchange: plataforma.exchange || '',
                moneda_principal: plataforma.moneda_principal || 'USD',
                pais: plataforma.pais || '',
                url: plataforma.url || '',
                activo: plataforma.activo ?? 1
            })
            setEditingId(plataforma.id)
        } else {
            resetForm()
        }
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        resetForm()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const method = editingId ? 'PUT' : 'POST'
            const url = editingId ? `${API}/plataformas/${editingId}` : `${API}/plataformas`

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al guardar')
            }

            closeModal()
            loadPlataformas()
        } catch (err) {
            alert(err.message)
        }
    }

    const handleDelete = async (plataforma) => {
        if (!confirm(`¿Desactivar la plataforma "${plataforma.nombre}"?`)) return

        try {
            const res = await fetch(`${API}/plataformas/${plataforma.id}`, { method: 'DELETE' })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al eliminar')
            }
            loadPlataformas()
        } catch (err) {
            alert(err.message)
        }
    }

    const handleReactivate = async (plataforma) => {
        try {
            const res = await fetch(`${API}/plataformas/${plataforma.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activo: 1 })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al reactivar')
            }
            loadPlataformas()
        } catch (err) {
            alert(err.message)
        }
    }

    return (
        <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1e293b' }}>
                    🏢 Plataformas de Inversión
                </h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#6b7280' }}>
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                        />
                        Mostrar inactivas
                    </label>
                    <button
                        onClick={() => openModal()}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        + Nueva Plataforma
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
                    {error}
                </div>
            )}

            <div className="card">
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
                ) : plataformas.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                        No hay plataformas registradas
                    </div>
                ) : (
                    <table style={{ width: '100%', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                <th style={{ padding: '12px 8px', textAlign: 'left' }}>Nombre</th>
                                <th style={{ padding: '12px 8px', textAlign: 'left' }}>Exchange</th>
                                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Moneda</th>
                                <th style={{ padding: '12px 8px', textAlign: 'center' }}>País</th>
                                <th style={{ padding: '12px 8px', textAlign: 'left' }}>URL</th>
                                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Estado</th>
                                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plataformas.map((p) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: p.activo ? 1 : 0.5 }}>
                                    <td style={{ padding: '10px 8px', fontWeight: '600' }}>{p.nombre}</td>
                                    <td style={{ padding: '10px 8px' }}>
                                        {p.exchange ? (
                                            <span style={{
                                                padding: '4px 8px',
                                                backgroundColor: '#eff6ff',
                                                color: '#1e40af',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: '500'
                                            }}>
                                                {p.exchange}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>{p.moneda_principal || '-'}</td>
                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>{p.pais || '-'}</td>
                                    <td style={{ padding: '10px 8px' }}>
                                        {p.url ? (
                                            <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9', textDecoration: 'none' }}>
                                                🔗 Ver sitio
                                            </a>
                                        ) : '-'}
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '12px',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            backgroundColor: p.activo ? '#dcfce7' : '#fee2e2',
                                            color: p.activo ? '#166534' : '#991b1b'
                                        }}>
                                            {p.activo ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                        <button
                                            onClick={() => openModal(p)}
                                            style={{
                                                background: 'none',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                                marginRight: '4px'
                                            }}
                                            title="Editar"
                                        >
                                            ✏️
                                        </button>
                                        {p.activo ? (
                                            <button
                                                onClick={() => handleDelete(p)}
                                                style={{
                                                    background: 'none',
                                                    border: '1px solid #fca5a5',
                                                    borderRadius: '4px',
                                                    padding: '4px 8px',
                                                    cursor: 'pointer',
                                                    color: '#dc2626'
                                                }}
                                                title="Desactivar"
                                            >
                                                🗑️
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleReactivate(p)}
                                                style={{
                                                    background: 'none',
                                                    border: '1px solid #86efac',
                                                    borderRadius: '4px',
                                                    padding: '4px 8px',
                                                    cursor: 'pointer',
                                                    color: '#16a34a'
                                                }}
                                                title="Reactivar"
                                            >
                                                ✅
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
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
                        borderRadius: '12px',
                        padding: '24px',
                        width: '100%',
                        maxWidth: '500px',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
                    }}>
                        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                            {editingId ? 'Editar Plataforma' : 'Nueva Plataforma'}
                        </h3>

                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gap: '16px' }}>
                                {/* Nombre */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                                        Nombre *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.nombre}
                                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px'
                                        }}
                                        placeholder="Ejemplo: Tyba, Interactive Brokers"
                                    />
                                </div>

                                {/* Exchange */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                                        Exchange
                                    </label>
                                    <select
                                        value={formData.exchange}
                                        onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px'
                                        }}
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {EXCHANGES.map((ex) => (
                                            <option key={ex} value={ex}>{ex}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Moneda y País (grid 2 cols) */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                                            Moneda Principal
                                        </label>
                                        <select
                                            value={formData.moneda_principal}
                                            onChange={(e) => setFormData({ ...formData, moneda_principal: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '8px 12px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        >
                                            {CURRENCIES.map((c) => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                                            País
                                        </label>
                                        <select
                                            value={formData.pais}
                                            onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '8px 12px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {COUNTRIES.map((c) => (
                                                <option key={c.code} value={c.code}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* URL */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                                        Sitio Web
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.url}
                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px'
                                        }}
                                        placeholder="https://..."
                                    />
                                </div>

                                {/* Activo checkbox */}
                                {editingId && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.activo === 1}
                                            onChange={(e) => setFormData({ ...formData, activo: e.target.checked ? 1 : 0 })}
                                        />
                                        Plataforma activa
                                    </label>
                                )}
                            </div>

                            {/* Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    style={{
                                        padding: '10px 20px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        backgroundColor: 'white',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ padding: '10px 20px' }}
                                >
                                    {editingId ? 'Guardar Cambios' : 'Crear Plataforma'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
