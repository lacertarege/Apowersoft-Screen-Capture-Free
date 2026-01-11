import React, { useEffect, useMemo, useState } from 'react'
import { API } from './config'

export default function NuevaDesinversionModal({ open, onClose, onSave, empresa }) {
    const [importe, setImporte] = useState('')
    const [cantidad, setCantidad] = useState('')
    const [fecha, setFecha] = useState('')
    const [plataforma, setPlataforma] = useState('Trii')
    const [stockDisponible, setStockDisponible] = useState(null)
    const [cargandoStock, setCargandoStock] = useState(false)
    const [cpp, setCpp] = useState(null)
    const [rendimiento, setRendimiento] = useState(null)

    useEffect(() => {
        if (open) {
            const hoy = new Date().toISOString().split('T')[0]
            setFecha(hoy)
            setImporte('')
            setCantidad('')
            setPlataforma('Trii')
            setStockDisponible(null)
            setCpp(null)
            setRendimiento(null)
        }
    }, [open])

    // Obtener stock disponible cuando abre el modal
    useEffect(() => {
        if (!open || !empresa?.id) {
            setStockDisponible(null)
            return
        }

        const obtenerStock = async () => {
            setCargandoStock(true)
            try {
                const response = await fetch(`${API}/tickers/${empresa.id}/inversiones`)
                if (response.ok) {
                    const data = await response.json()
                    const items = data.items || []

                    // Calcular stock neto
                    let stock = 0
                    items.forEach(inv => {
                        if (inv.tipo_operacion === 'INVERSION') {
                            stock += Number(inv.cantidad || 0)
                        } else if (inv.tipo_operacion === 'DESINVERSION') {
                            stock -= Number(inv.cantidad || 0)
                        }
                    })

                    setStockDisponible(stock)
                }
            } catch (error) {
                console.error('Error obteniendo stock:', error)
                setStockDisponible(0)
            } finally {
                setCargandoStock(false)
            }
        }

        obtenerStock()
    }, [empresa?.id, open])

    // Calcular CPP y rendimiento cuando cambian importe/cantidad
    useEffect(() => {
        if (!importe || !cantidad || !stockDisponible) {
            setCpp(null)
            setRendimiento(null)
            return
        }

        const importeNum = Number(importe)
        const cantidadNum = Number(cantidad)

        if (!isFinite(importeNum) || !isFinite(cantidadNum) || importeNum <= 0 || cantidadNum <= 0) {
            setCpp(null)
            setRendimiento(null)
            return
        }

        // El CPP se calculará en el backend, aquí solo mostramos estimación
        // Usar el promedio de apertura de las inversiones existentes como aproximación
        const obtenerCPP = async () => {
            try {
                const response = await fetch(`${API}/tickers/${empresa.id}/inversiones`)
                if (response.ok) {
                    const data = await response.json()
                    const inversiones = (data.items || []).filter(inv => inv.tipo_operacion === 'INVERSION')

                    if (inversiones.length > 0) {
                        let totalImporte = 0
                        let totalCantidad = 0
                        inversiones.forEach(inv => {
                            totalImporte += Number(inv.importe || 0)
                            totalCantidad += Number(inv.cantidad || 0)
                        })

                        const cppCalculado = totalCantidad > 0 ? totalImporte / totalCantidad : 0
                        setCpp(cppCalculado)

                        // Calcular rendimiento estimado
                        const costBasis = cppCalculado * cantidadNum
                        const rendimientoEstimado = importeNum - costBasis
                        const rentabilidadEstimada = costBasis > 0 ? (rendimientoEstimado / costBasis) * 100 : 0

                        setRendimiento({
                            amount: rendimientoEstimado,
                            rate: rentabilidadEstimada,
                            costBasis: costBasis
                        })
                    }
                }
            } catch (error) {
                console.error('Error calculando CPP:', error)
            }
        }

        obtenerCPP()
    }, [importe, cantidad, empresa?.id, stockDisponible])

    const precioSalida = useMemo(() => {
        const imp = Number(importe)
        const cant = Number(cantidad)
        if (!imp || !cant || cant === 0) return null
        const v = imp / cant
        return Number.isFinite(v) ? v : null
    }, [importe, cantidad])

    function save() {
        if (!importe || !cantidad || !fecha) return
        const payload = { fecha, importe: Number(importe), cantidad: Number(cantidad), plataforma, tipo_operacion: 'DESINVERSION' }
        console.log('🔍 DESINVERSION Modal - Sending:', payload)
        onSave(payload)
    }

    // Función para llenar automáticamente un retiro total
    function handleRetiroTotal() {
        if (!stockDisponible || stockDisponible <= 0) return

        // Usar el CPP como estimación del precio de salida
        // El usuario puede ajustar el importe manualmente si el precio actual es diferente
        const precioEstimado = cpp || 0
        const importeEstimado = stockDisponible * precioEstimado

        setCantidad(stockDisponible.toString())
        setImporte(importeEstimado.toFixed(2))
    }

    if (!open) return null

    const cantidadNum = Number(cantidad) || 0
    const stockInsuficiente = stockDisponible !== null && cantidadNum > stockDisponible
    const canSave = importe && cantidad && fecha && Number(cantidad) > 0 && !stockInsuficiente

    return (
        <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
            <div className="modal-content" style={{ maxWidth: '550px', maxHeight: '90vh' }}>
                {/* Header */}
                <div className="modal-header">
                    <div>
                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--orange-dark)' }}>
                            ↓ Desinversión
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
                    {/* Stock Disponible Alert */}
                    {cargandoStock ? (
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            background: 'var(--bg)',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--border-light)',
                            marginBottom: 'var(--space-md)',
                            fontSize: '13px',
                            color: 'var(--fg-secondary)'
                        }}>
                            Calculando stock disponible...
                        </div>
                    ) : stockDisponible !== null && (
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                            borderRadius: 'var(--radius)',
                            border: '1px solid #93c5fd',
                            marginBottom: 'var(--space-md)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 600, marginBottom: '2px' }}>
                                        Stock disponible
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#1e3a8a' }}>
                                        {stockDisponible.toFixed(4)} {empresa?.tipo_inversion_id === 1 ? 'cuotas' : 'acciones'}
                                    </div>
                                </div>
                                <button
                                    onClick={handleRetiroTotal}
                                    disabled={stockDisponible <= 0}
                                    style={{
                                        padding: '8px 16px',
                                        background: stockDisponible > 0 ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : '#e5e7eb',
                                        color: stockDisponible > 0 ? 'white' : '#9ca3af',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        cursor: stockDisponible > 0 ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.2s',
                                        boxShadow: stockDisponible > 0 ? '0 2px 4px rgba(220, 38, 38, 0.2)' : 'none'
                                    }}
                                    title="Llenar campos para retiro total de la posición"
                                >
                                    🚪 Retiro Total
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                        {/* Fecha */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Fecha de retiro</label>
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
                                <label>Importe Recibido ({empresa?.moneda || 'USD'})</label>
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
                                <label>Cantidad a retirar</label>
                                <input
                                    value={cantidad}
                                    onChange={e => setCantidad(e.target.value)}
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    placeholder="0.00"
                                    style={{
                                        borderColor: stockInsuficiente ? 'var(--error-color)' : undefined
                                    }}
                                />
                                {stockInsuficiente && (
                                    <div style={{
                                        fontSize: '12px',
                                        color: 'var(--error-color)',
                                        marginTop: '4px',
                                        fontWeight: 600
                                    }}>
                                        ❌ Stock insuficiente
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Precio de salida */}
                        {precioSalida !== null && (
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
                                    Precio de salida
                                </div>
                                <div style={{
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    color: 'var(--fg)',
                                    fontVariantNumeric: 'tabular-nums'
                                }}>
                                    {new Intl.NumberFormat('es-PE', {
                                        style: 'currency',
                                        currency: empresa?.moneda || 'USD'
                                    }).format(precioSalida)}
                                </div>
                            </div>
                        )}

                        {/* CPP y Rendimiento Estimado */}
                        {cpp !== null && rendimiento !== null && (
                            <div style={{
                                padding: 'var(--space-md)',
                                background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                                borderRadius: 'var(--radius)',
                                border: '1px solid #fdba74',
                                display: 'grid',
                                gap: 'var(--space-sm)'
                            }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#9a3412', marginBottom: '4px' }}>
                                    📊 Estimación de rendimiento
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
                                    <div>
                                        <div style={{ fontSize: '11px', color: '#9a3412', marginBottom: '2px' }}>
                                            Costo Promedio (CPP)
                                        </div>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#7c2d12' }}>
                                            {new Intl.NumberFormat('es-PE', {
                                                style: 'currency',
                                                currency: empresa?.moneda || 'USD'
                                            }).format(cpp)}
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ fontSize: '11px', color: '#9a3412', marginBottom: '2px' }}>
                                            Base de Costo
                                        </div>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#7c2d12' }}>
                                            {new Intl.NumberFormat('es-PE', {
                                                style: 'currency',
                                                currency: empresa?.moneda || 'USD'
                                            }).format(rendimiento.costBasis)}
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    borderTop: '1px solid #fdba74',
                                    paddingTop: 'var(--space-sm)',
                                    marginTop: 'var(--space-xs)'
                                }}>
                                    <div style={{ fontSize: '11px', color: '#9a3412', marginBottom: '2px' }}>
                                        Rendimiento Realizado
                                    </div>
                                    <div style={{
                                        fontSize: '18px',
                                        fontWeight: 700,
                                        color: rendimiento.amount >= 0 ? '#15803d' : '#dc2626'
                                    }}>
                                        {new Intl.NumberFormat('es-PE', {
                                            style: 'currency',
                                            currency: empresa?.moneda || 'USD',
                                            signDisplay: 'always'
                                        }).format(rendimiento.amount)}
                                        <span style={{ fontSize: '14px', marginLeft: '8px' }}>
                                            ({rendimiento.rate >= 0 ? '+' : ''}{rendimiento.rate.toFixed(2)}%)
                                        </span>
                                    </div>
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
                        style={{
                            padding: '10px 20px',
                            minWidth: '150px',
                            fontSize: '14px',
                            background: canSave ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : undefined,
                            borderColor: canSave ? '#ea580c' : undefined
                        }}
                    >
                        Registrar Desinversión
                    </button>
                </div>
            </div>
        </div>
    )
}
