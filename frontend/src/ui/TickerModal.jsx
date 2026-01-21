import React, { useState, useEffect } from 'react'
import { API } from './config'

export default function TickerModal({ open, onClose, onSave, tipos = [], defaultMoneda = 'USD' }) {
  const [ticker, setTicker] = useState('')
  const [nombre, setNombre] = useState('')
  const [moneda, setMoneda] = useState(defaultMoneda)
  const [tipoInversionId, setTipoInversionId] = useState('')
  const [pais, setPais] = useState('')

  // Lista de países comunes
  const countries = [
    'Estados Unidos', 'Perú', 'Bermudas', 'Reino Unido',
    'Canadá', 'Irlanda', 'Luxemburgo', 'Suiza',
    'España', 'Chile', 'Colombia', 'México', 'Brasil',
    'Islas Caimán', 'Panamá'
  ]

  // Estados para la búsqueda
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)

  useEffect(() => {
    if (open) {
      setTicker('')
      setNombre('')
      setMoneda(defaultMoneda)
      setPais('')
      setSearchQuery('')
      setSearchResults([])
      setShowSearchResults(false)
      const def = (tipos && tipos.length) ? String(tipos[0].id) : ''
      setTipoInversionId(def)
    }
  }, [open, JSON.stringify(tipos), defaultMoneda])

  // Función para buscar empresas
  const searchCompanies = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`${API}/search/symbols?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setSearchResults(data.items || [])
      setShowSearchResults(true)
    } catch (error) {
      console.error('Error buscando empresas:', error)
      setSearchResults([])
      setShowSearchResults(false)
    } finally {
      setIsSearching(false)
    }
  }

  // Función para seleccionar una empresa de los resultados
  const selectCompany = (company) => {
    setTicker(company.ticker)
    setNombre(company.nombre)
    setMoneda(company.moneda || 'USD')
    // Resetear país al seleccionar de búsqueda (podría inferirse si tuviéramos ISIN aquí, pero por ahora manual)
    setPais('')
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
  }

  // Manejar cambios en el campo de búsqueda
  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)

    // Si el usuario está escribiendo en el campo de búsqueda, limpiar los campos
    if (value && (ticker || nombre)) {
      setTicker('')
      setNombre('')
    }

    // Buscar con debounce
    clearTimeout(window.searchTimeout)
    window.searchTimeout = setTimeout(() => {
      searchCompanies(value)
    }, 300)
  }

  // Cerrar resultados de búsqueda al hacer clic fuera
  const handleClickOutside = (e) => {
    if (!e.target.closest('.search-container')) {
      setShowSearchResults(false)
    }
  }

  // Agregar event listener para cerrar resultados
  useEffect(() => {
    if (open && showSearchResults) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [open, showSearchResults])

  if (!open) return null

  const canSave = ticker.trim() && nombre.trim() && moneda && (tipoInversionId !== '')

  const handleSave = () => {
    if (!canSave) return
    onSave({
      ticker: ticker.trim().toUpperCase(),
      nombre: nombre.trim(),
      moneda,
      tipo_inversion_id: Number(tipoInversionId),
      pais: pais || null
    })
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
      <div className="modal-content" style={{ maxWidth: '560px', maxHeight: '85vh' }}>
        {/* Header */}
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>
            Nueva Empresa
          </h3>
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
          {/* Sección de búsqueda */}
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <label style={{
              display: 'block',
              marginBottom: 'var(--space-sm)',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--fg)',
              letterSpacing: '-0.01em'
            }}>
              Buscar Empresa
            </label>
            <div className="search-container" style={{ position: 'relative' }}>
              <input
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="AAPL, Apple, Microsoft..."
                style={{
                  width: '100%',
                  paddingRight: isSearching ? '100px' : '16px'
                }}
                autoFocus
              />
              {isSearching && (
                <div style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div className="loading" style={{ width: '16px', height: '16px' }}></div>
                  <span style={{ fontSize: '13px', color: 'var(--fg-tertiary)' }}>Buscando...</span>
                </div>
              )}

              {/* Resultados de búsqueda */}
              {showSearchResults && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: 'var(--shadow-md)',
                  animation: 'slideUp 200ms ease-out'
                }}>
                  {searchResults.map((company, index) => (
                    <div
                      key={index}
                      className="search-result-item"
                      onClick={() => selectCompany(company)}
                      style={{
                        padding: 'var(--space-sm) var(--space-md)',
                        cursor: 'pointer',
                        borderBottom: index < searchResults.length - 1 ? '1px solid var(--border-light)' : 'none',
                        transition: 'background var(--transition-fast)'
                      }}
                    >
                      <div style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        marginBottom: '2px',
                        color: 'var(--fg)'
                      }}>
                        {company.ticker}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: 'var(--fg-secondary)',
                        marginBottom: '1px'
                      }}>
                        {company.nombre}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--fg-tertiary)'
                      }}>
                        {company.moneda}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showSearchResults && searchResults.length === 0 && !isSearching && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-md)',
                  fontSize: '13px',
                  color: 'var(--fg-secondary)',
                  textAlign: 'center',
                  zIndex: 1000,
                  boxShadow: 'var(--shadow-md)'
                }}>
                  No se encontraron resultados
                </div>
              )}
            </div>
            <p style={{
              fontSize: '12px',
              color: 'var(--fg-tertiary)',
              marginTop: 'var(--space-xs)',
              marginBottom: 0
            }}>
              Busca por símbolo o nombre de empresa
            </p>
          </div>

          {/* Separador visual */}
          <div style={{
            height: '1px',
            background: 'var(--separator)',
            margin: 'var(--space-lg) 0'
          }}></div>

          {/* Información de la empresa */}
          <div>
            <h4 style={{
              margin: '0 0 var(--space-md) 0',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--fg)',
              letterSpacing: '-0.01em'
            }}>
              Información de la Empresa
            </h4>

            <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
              {/* Ticker y Nombre en grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-sm)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '13px', marginBottom: 'var(--space-xs)' }}>Símbolo</label>
                  <input
                    value={ticker}
                    onChange={e => setTicker(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    style={{ textTransform: 'uppercase', padding: '8px 12px', fontSize: '14px' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '13px', marginBottom: 'var(--space-xs)' }}>Nombre completo</label>
                  <input
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Apple Inc."
                    style={{ padding: '8px 12px', fontSize: '14px' }}
                  />
                </div>
              </div>

              {/* Moneda y Tipo en grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '13px', marginBottom: 'var(--space-xs)' }}>Moneda</label>
                  <select value={moneda} onChange={e => setMoneda(e.target.value)} style={{ padding: '8px 12px', fontSize: '14px' }}>
                    <option value="USD">🇺🇸 Dólar (USD)</option>
                    <option value="PEN">🇵🇪 Sol (PEN)</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '13px', marginBottom: 'var(--space-xs)' }}>Tipo</label>
                  <select value={tipoInversionId} onChange={e => setTipoInversionId(e.target.value)} style={{ padding: '8px 12px', fontSize: '14px' }}>
                    {tipos.length === 0 ? (
                      <option value="">Sin tipos disponibles</option>
                    ) : (
                      tipos.map(t => (
                        <option key={t.id} value={String(t.id)}>{t.nombre}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* País */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '13px', marginBottom: 'var(--space-xs)' }}>País</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={pais}
                    onChange={e => setPais(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '14px', width: '100%' }}
                  >
                    <option value="">-- Seleccionar --</option>
                    {countries.sort().map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
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
            Agregar Empresa
          </button>
        </div>
      </div>
    </div>
  )
}