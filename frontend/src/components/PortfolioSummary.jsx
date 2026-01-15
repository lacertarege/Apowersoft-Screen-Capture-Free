import React from 'react'
import NumberCell from '../ui/NumberCell.jsx'

export function PortfolioSummary({ investments, currency }) {
  const stats = React.useMemo(() => {
    const invertido = investments.reduce((a, x) => a + (Number(x.importe_total) || 0), 0)
    const valorActual = investments.reduce((a, x) => a + (Number(x.balance) || 0), 0)
    // Backend 'rendimiento' already includes: unrealizedGain + realizedGain + dividends
    // Do NOT add dividends again!
    const rendimiento = investments.reduce((a, x) => a + (Number(x.rendimiento) || 0), 0)
    const rentab = invertido ? (rendimiento / invertido) : 0

    return { invertido, valorActual, rendimiento, rentab }
  }, [investments])

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div>
          Invertido: <NumberCell value={stats.invertido} currency={currency} />
        </div>
        <div>
          Valor actual: <NumberCell value={stats.valorActual} currency={currency} />
        </div>
        <div>
          Rendimiento: <NumberCell value={stats.rendimiento} currency={currency} />
        </div>
        <div>
          Rentabilidad:
          <span className={stats.rentab >= 0 ? 'text-green' : 'text-red'}>
            {new Intl.NumberFormat('es-PE', {
              style: 'percent',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }).format(stats.rentab)}
          </span>
        </div>
      </div>
    </div>
  )
}
