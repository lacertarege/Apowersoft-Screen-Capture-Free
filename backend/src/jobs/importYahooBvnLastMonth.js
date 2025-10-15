// import { request } from 'undici'
import { createDb } from '../setup/db.js'

function toISODate(d){
  return new Date(d).toISOString().slice(0,10)
}

function rangeLastMonth(){
  const today = new Date()
  const from = new Date(today)
  from.setMonth(from.getMonth() - 1)
  // Normalizar a medianoche UTC para evitar desfases
  const fromStr = toISODate(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())))
  const toStr = toISODate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())))
  return { from: fromStr, to: toStr }
}

async function fetchYahooDailyHistory(symbol, from, to){
  // Yahoo periodos en epoch segundos; period2 al final del día UTC
  const period1 = Math.floor(new Date(from + 'T00:00:00Z').getTime() / 1000)
  const period2 = Math.floor(new Date(to + 'T23:59:59Z').getTime() / 1000)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&includeAdjustedClose=true&period1=${period1}&period2=${period2}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`)
  const data = await r.json()
  const res = data?.chart?.result?.[0]
  const ts = res?.timestamp
  const adj = res?.indicators?.adjclose?.[0]?.adjclose
  const close = res?.indicators?.quote?.[0]?.close
  if (!Array.isArray(ts) || ts.length === 0) throw new Error('Yahoo: respuesta sin timestamps')
  const prices = Array.isArray(adj) && adj.length === ts.length ? adj : close
  if (!Array.isArray(prices) || prices.length !== ts.length) throw new Error('Yahoo: arrays incongruentes')
  const items = ts.map((t, i) => ({
    fecha: new Date(t * 1000).toISOString().slice(0,10),
    precio: prices[i]
  })).filter(x => x.fecha >= from && x.fecha <= to && Number.isFinite(x.precio))
  return items
}

export async function importYahooBvnLastMonth(db){
  const symbol = 'BVN'
  const { from, to } = rangeLastMonth()

  // Buscar ticker en base de datos
  const t = db.prepare('SELECT id, ticker FROM tickers WHERE UPPER(ticker) = ?').get(symbol.toUpperCase())
  if (!t){
    throw new Error(`Ticker ${symbol} no existe en la tabla tickers`)
  }

  const items = await fetchYahooDailyHistory(symbol, from, to)
  if (!items.length){
    console.log(`Sin datos históricos para ${symbol} entre ${from} y ${to}`)
    return
  }

  const upsert = db.prepare(`INSERT INTO precios_historicos (ticker_id, fecha, precio, fuente_api, updated_at)
    VALUES (@ticker_id, @fecha, @precio, @fuente_api, @updated_at)
    ON CONFLICT(ticker_id, fecha) DO UPDATE SET precio=excluded.precio, fuente_api=excluded.fuente_api, updated_at=excluded.updated_at`)
  const nowIso = new Date().toISOString()
  const tx = db.transaction((rows)=>{
    for (const r of rows){
      upsert.run({ ticker_id: t.id, fecha: r.fecha, precio: r.precio, fuente_api: 'yahoo', updated_at: nowIso })
    }
  })
  tx(items)

  console.log(`importYahooBvnLastMonth: ${symbol} -> ${items.length} días guardados (${from} a ${to}) fuente=yahoo`)
}

// Permitir ejecutar directamente: node src/jobs/importYahooBvnLastMonth.js
if (process.argv[1] && process.argv[1].endsWith('importYahooBvnLastMonth.js')){
  const dbPath = process.env.DB_PATH || './data/investments.db'
  const db = createDb(dbPath)
  importYahooBvnLastMonth(db).then(()=>{
    if (!process.env.KEEP_OPEN) db.close()
  }).catch(err=>{
    console.error('Error importYahooBvnLastMonth:', err)
    if (!process.env.KEEP_OPEN) db.close()
    process.exitCode = 1
  })
}