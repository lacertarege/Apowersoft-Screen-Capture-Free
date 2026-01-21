import React from 'react'

export default function Layout({ children }) {
  const [now, setNow] = React.useState(new Date())

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const fmtNow = React.useMemo(() => {
    try {
      const fDate = new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      const fTime = new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      return `${fDate.format(now)} ${fTime.format(now)}`
    } catch {
      return now.toLocaleString()
    }
  }, [now])

  return (
    <div>
      <header className="topbar">
        <div className="topbar-content">
          <h1 className="topbar-title">INVERSIONES</h1>
          <nav className="topbar-nav">
            <a href="#empresas">Empresas</a>
            <a href="#dashboard">Dashboard</a>
            <a href="#dividendos">Dividendos</a>
            <div className="nav-dropdown">
              <div className="nav-dropdown-title">
                Configuración
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ marginLeft: '4px' }}>
                  <path d="M6 8L2 4h8L6 8z" />
                </svg>
              </div>
              <div className="nav-dropdown-content">
                <a href="#config/tipo-cambio">Tipo de cambio</a>
                <a href="#config/precios-historicos">Precios históricos</a>
                <a href="#tipos-inversion">Tipos de inversión</a>
                <a href="#sectores">Sectores</a>
                <a href="#plataformas">Plataformas</a>
              </div>
            </div>
          </nav>
          <div className="topbar-datetime">
            <span style={{ opacity: 0.7 }}>v2.3.0</span>
            {' • '}
            <span>{fmtNow}</span>
          </div>
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}