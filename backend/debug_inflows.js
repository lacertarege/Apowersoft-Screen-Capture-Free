import Database from 'better-sqlite3'

const db = new Database('./data/investments.db')

// Get FX for today
const fx = db.prepare('SELECT usd_pen FROM tipos_cambio WHERE fecha = ?').get('2026-01-12')
console.log('FX 2026-01-12:', fx?.usd_pen || 3.73)

// Get all 2026 investments 
const inv2026 = db.prepare(`
  SELECT i.id, i.fecha, i.importe, i.tipo_operacion, i.origen_capital, t.moneda, t.ticker 
  FROM inversiones i 
  JOIN tickers t ON t.id=i.ticker_id 
  WHERE i.fecha >= '2026-01-01' 
  ORDER BY i.fecha
`).all()

console.log('\n=== Inversiones 2026 ===')
let inflows = 0, outflows = 0, reinv = 0

inv2026.forEach(i => {
    const fxRate = fx?.usd_pen || 3.73
    const usd = i.moneda === 'USD' ? i.importe : i.importe / fxRate

    const isDesinv = (i.tipo_operacion || '').toUpperCase().includes('DES')
    const isReinv = (i.origen_capital || '').toUpperCase() === 'REINVERSION'
    const isFresh = (i.origen_capital || 'FRESH_CASH').toUpperCase() === 'FRESH_CASH'

    let type = 'UNKNOWN'
    if (isDesinv) {
        type = 'OUTFLOW'
        outflows += usd
    } else if (isReinv) {
        type = 'REINV'
        reinv += usd
    } else if (isFresh) {
        type = 'INFLOW'
        inflows += usd
    }

    console.log(`${i.fecha} | ${i.ticker.padEnd(10)} | ${type.padEnd(7)} | ${i.importe.toFixed(2).padStart(12)} ${i.moneda} | = ${usd.toFixed(2).padStart(10)} USD`)
})

console.log('\n=== TOTALS ===')
console.log('Inflows (FRESH_CASH):', inflows.toFixed(2), 'USD')
console.log('Reinversiones:', reinv.toFixed(2), 'USD')
console.log('Outflows:', outflows.toFixed(2), 'USD')
console.log('Net Flow:', (inflows - outflows).toFixed(2), 'USD')

db.close()
