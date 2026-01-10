import Database from 'better-sqlite3'

const db = new Database('./data/investments.db')

const rows = db.prepare(`
  SELECT t.moneda, MIN(i.fecha) as primera_fecha 
  FROM inversiones i 
  JOIN tickers t ON t.id = i.ticker_id 
  GROUP BY t.moneda 
  ORDER BY primera_fecha
`).all()

console.log('Primeras inversiones por moneda:')
rows.forEach(row => {
    console.log(`  ${row.moneda}: ${row.primera_fecha}`)
})

db.close()
