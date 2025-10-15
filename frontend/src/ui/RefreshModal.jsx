export default function RefreshModal({ open, title, loading, attempts=[], message='', inserted=0, source=null, steps=[], from=null, to=null, onClose }){
  if (!open) return null
  const hasResult = !loading && (message || inserted || (attempts && attempts.length))
  const currentStep = steps?.find?.(s=>s.status==='consultando')
  
  return (
    <div className="modal-overlay" onClick={(e)=>{ if(e.target===e.currentTarget) onClose?.() }}>
      <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '85vh' }}>
        {/* Header */}
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>
            {title || 'Actualización de Precios'}
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
        <div className="modal-body" style={{ overflowY: 'auto', maxHeight: 'calc(85vh - 140px)' }}>
          {/* Steps de progreso */}
          {steps && steps.length > 0 && (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <h4 style={{ 
                margin: '0 0 var(--space-md) 0',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--fg)',
                letterSpacing: '-0.01em'
              }}>
                Progreso
              </h4>
              <div style={{
                background: 'var(--bg)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-light)',
                padding: 'var(--space-md)'
              }}>
                <ul style={{listStyle:'none', padding:0, margin:0, display:'grid', gap:'var(--space-sm)'}}>
                  {steps.map((s,idx)=> (
                    <li key={idx} style={{
                      display:'flex', 
                      alignItems:'center', 
                      gap:'var(--space-md)',
                      padding: 'var(--space-sm)',
                      borderRadius: 'var(--radius-sm)',
                      background: s.status === 'consultando' ? 'rgba(37, 99, 235, 0.05)' : 'transparent'
                    }}>
                      <StatusDot status={s.status}/>
                      <span style={{fontWeight:600, fontSize:'14px'}}>{s.api}</span>
                      <span style={{
                        fontSize:'13px',
                        color: 'var(--fg-secondary)',
                        fontWeight: 500
                      }}>
                        {labelStatus(s.status)}
                      </span>
                      {(()=>{ 
                        const msg = latestMsgFor(s.api, attempts)
                        return msg ? (
                          <span style={{
                            marginLeft:'auto', 
                            fontSize:'13px',
                            color: 'var(--fg-tertiary)'
                          }}>
                            {msg}
                          </span>
                        ) : null 
                      })()}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{
              display:'flex', 
              alignItems:'center', 
              gap:'var(--space-md)', 
              padding: 'var(--space-lg)',
              background: 'var(--bg)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-light)',
              marginBottom: 'var(--space-lg)'
            }}>
              <div className="loading" style={{width:'20px', height:'20px'}}></div>
              <span style={{fontSize:'15px', color:'var(--fg)'}}>
                {currentStep ? `Consultando API: ${currentStep.api}` : 'Consultando proveedores de datos...'}
              </span>
            </div>
          )}

          {/* Rango consultado */}
          {(from || to) && (
            <div style={{
              padding: 'var(--space-md) var(--space-lg)',
              background: 'var(--bg)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-light)',
              marginBottom: 'var(--space-lg)',
              fontSize:'14px',
              color:'var(--fg-secondary)'
            }}>
              <strong>Rango:</strong> {from||'-'} → {to||'-'}
            </div>
          )}

          {/* Resultados */}
          {hasResult && (
            <div style={{
              padding: 'var(--space-lg)',
              background: message.toLowerCase().includes('error') || message.toLowerCase().includes('no') 
                ? 'var(--danger-bg)' 
                : 'var(--success-bg)',
              borderRadius: 'var(--radius)',
              border: `1px solid ${message.toLowerCase().includes('error') || message.toLowerCase().includes('no')
                ? 'rgba(255, 59, 48, 0.3)'
                : 'rgba(52, 199, 89, 0.3)'}`,
              marginBottom: 'var(--space-lg)'
            }}>
              {!!message && (
                <div style={{
                  marginBottom: inserted ? 'var(--space-md)' : 0,
                  fontSize:'14px',
                  color:'var(--fg)',
                  fontWeight: 500
                }}>
                  {message}
                </div>
              )}
              <div style={{
                display:'grid', 
                gridTemplateColumns:'repeat(2, minmax(0,1fr))', 
                gap:'var(--space-md)'
              }}>
                <InfoItem label="Registros insertados" value={inserted} />
                <InfoItem label="Fuente de datos" value={source || '-'} />
              </div>
            </div>
          )}

          {/* Tabla de intentos */}
          {attempts && attempts.length > 0 && (
            <div>
              <h4 style={{ 
                margin: '0 0 var(--space-md) 0',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--fg)',
                letterSpacing: '-0.01em'
              }}>
                Detalle de Intentos
              </h4>
              <div style={{
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden'
              }}>
                <table style={{margin:0, border:'none'}}>
                  <thead>
                    <tr style={{background:'var(--bg)'}}>
                      <th style={{textAlign:'left', fontSize:'13px'}}>Proveedor</th>
                      <th style={{textAlign:'left', fontSize:'13px'}}>Estado</th>
                      <th style={{textAlign:'left', fontSize:'13px'}}>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((a, idx)=> (
                      <tr key={idx}>
                        <td style={{fontSize:'14px', fontWeight:600}}>{providerFromAttempt(a)}</td>
                        <td style={{fontSize:'14px'}}>
                          <StatusBadge status={a.status || (a.ok ? 'ok' : 'error')} />
                        </td>
                        <td style={{fontSize:'13px', color:'var(--fg-secondary)'}}>
                          {a.message || a.error || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button 
            onClick={onClose} 
            className="btn-primary"
            style={{
              padding: '10px 20px',
              minWidth: '90px',
              fontSize: '14px'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value }){
  return (
    <div>
      <div style={{
        fontSize:'13px',
        fontWeight:600,
        color:'var(--fg-secondary)',
        marginBottom:'4px'
      }}>
        {label}
      </div>
      <div style={{
        fontWeight:600,
        fontSize:'20px',
        color:'var(--fg)',
        fontVariantNumeric: 'tabular-nums'
      }}>
        {String(value)}
      </div>
    </div>
  )
}

function StatusDot({ status }){
  const colors = {
    'consultando': 'var(--primary)',
    'ok': 'var(--success)',
    'pendiente': 'var(--fg-tertiary)',
    'fallo': 'var(--danger)'
  }
  const color = colors[status] || 'var(--fg-tertiary)'
  
  return (
    <span style={{
      width:'10px', 
      height:'10px', 
      background: color, 
      display:'inline-block', 
      borderRadius:'50%',
      flexShrink: 0
    }}></span>
  )
}

function StatusBadge({ status }){
  const statusMap = {
    'ok': { bg: 'var(--success-bg)', color: 'var(--success)', label: 'OK' },
    'error': { bg: 'var(--danger-bg)', color: 'var(--danger)', label: 'Error' },
    'fallo': { bg: 'var(--danger-bg)', color: 'var(--danger)', label: 'Error' },
    'nodata': { bg: 'var(--warning-bg)', color: 'var(--warning)', label: 'Sin datos' },
    'skipped': { bg: 'var(--bg)', color: 'var(--fg-tertiary)', label: 'Omitido' }
  }
  
  const st = String(status||'').toLowerCase()
  const config = statusMap[st] || statusMap['skipped']
  
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 600,
      background: config.bg,
      color: config.color
    }}>
      {config.label}
    </span>
  )
}

function labelStatus(s){
  const labels = {
    'consultando': 'Consultando',
    'ok': 'Completado',
    'fallo': 'Falló',
    'pendiente': 'Pendiente'
  }
  return labels[s] || s || '-'
}

function mapAttemptStatus(a){
  const st = String(a?.status||'').toLowerCase()
  if (st==='ok') return 'OK'
  if (st==='error' || st==='fallo') return 'Error'
  if (st==='nodata') return 'Sin datos'
  if (st==='skipped') return 'Omitido'
  if (typeof a?.ok === 'boolean') return a.ok ? 'OK' : 'Error'
  return st || '-'
}

function providerFromAttempt(a){
  const api = a?.api || a?.provider
  if (api) return normalizeProvider(api)
  const src = a?.source || a?.fuente || ''
  if (!src) return '-'
  const s = String(src).toLowerCase()
  const cleaned = s.startsWith('latest:') ? s.slice(7) : s
  const name = cleaned.split(':')[0]
  return normalizeProvider(name)
}

function normalizeProvider(name){
  const n = String(name||'').toLowerCase()
  if (n.includes('polygon')) return 'Polygon'
  if (n.includes('alpha') || n.includes('alphavantage')) return 'Alpha Vantage'
  if (n.includes('yahoo')) return 'Yahoo Finance'
  if (n.includes('local') || n.includes('servicio')) return 'Servicio Local'
  if (n.includes('rapidapi')) return 'Servicio Local'
  return name || '-'
}

function latestMsgFor(apiName, attempts=[]){
  const filtered = (attempts||[]).filter(a=> providerFromAttempt(a) === apiName)
  if (!filtered.length) return ''
  const last = filtered[filtered.length - 1]
  return last.message || last.error || mapAttemptStatus(last)
}
