import React, { useEffect, useState } from 'react'
import Layout from './Layout.jsx'
import EmpresasView from './EmpresasView.jsx'
import Dashboard from './Dashboard.jsx'
import TipoCambioView from './TipoCambioView.jsx'
import PreciosHistoricosView from './PreciosHistoricosView.jsx'
import { DividendosView } from './DividendosView.jsx'
import TiposInversionView from './TiposInversionView.jsx'
import PlataformasView from './PlataformasView.jsx'

export default function App() {
  const [route, setRoute] = useState('empresas')

  useEffect(() => {
    function onHash() {
      setRoute((location.hash || '#empresas').replace('#', ''))
    }
    onHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <Layout>
      {route === 'empresas' && <EmpresasView />}
      {route === 'dashboard' && (
        <Dashboard />
      )}
      {route === 'dividendos' && (
        <DividendosView />
      )}
      {route === 'tipo-cambio' && (
        <TipoCambioView />
      )}
      {(route === 'config' || route === 'config/tipo-cambio') && (
        <TipoCambioView />
      )}
      {route === 'config/precios-historicos' && (
        <PreciosHistoricosView />
      )}
      {route === 'tipos-inversion' && (
        <TiposInversionView />
      )}
      {route === 'plataformas' && (
        <PlataformasView />
      )}
    </Layout>
  )
}