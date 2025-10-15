import { createDb } from '../setup/db.js'
import { fetchDailyHistory, fetchPriceForSymbol } from '../sources/marketData.js'

function isoToday(){
  return new Date().toISOString().slice(0,10)
}

function isWeekend(dateStr){
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay()
  return day === 0 || day === 6
}
function lastWeekday(dateStr){
  const d = new Date(dateStr + 'T00:00:00Z')
  const wd = d.getUTCDay()
  if (wd === 6) d.setUTCDate(d.getUTCDate() - 1)
  else if (wd === 0) d.setUTCDate(d.getUTCDate() - 2)
  return d.toISOString().slice(0,10)
}

export async function importHistoryRange(db, symbol, from, to){
  if (!symbol) throw new Error('Symbol requerido')
  if (!from) throw new Error('Fecha desde (from) requerida en formato YYYY-MM-DD')
  const toDate = to || isoToday()

  const t = db.prepare('SELECT id, ticker FROM tickers WHERE UPPER(ticker)=?').get(symbol.toUpperCase())
  if (!t){
    throw new Error(`Ticker ${symbol} no existe en la tabla tickers`)
  }

  const { items, source, attempts = [] } = await fetchDailyHistory(symbol, from, toDate)
  if (!items || items.length === 0){
    // Fallback: insertar precio reciente en el último día hábil del rango (si aplica)
    const targetDate = lastWeekday(toDate)
    if (new Date(from) > new Date(targetDate)){
      attempts.push({ source: 'latest', status: 'error', message: 'sin días hábiles dentro del rango solicitado' })
      return { inserted: 0, source: source || null, attempts, from, to: toDate }
    }
    try{
      const latest = await fetchPriceForSymbol(symbol)
      const latestSource = latest?.source || 'latest'
      const upsert = db.prepare(`INSERT INTO precios_historicos (ticker_id, fecha, precio, fuente_api, updated_at)
        VALUES (@ticker_id, @fecha, @precio, @fuente_api, @updated_at)
        ON CONFLICT(ticker_id, fecha) DO UPDATE SET precio=excluded.precio, fuente_api=excluded.fuente_api, updated_at=excluded.updated_at`)
      const nowIso = new Date().toISOString()
      upsert.run({ ticker_id: t.id, fecha: targetDate, precio: latest.price, fuente_api: `latest:${latestSource}`, updated_at: nowIso })
      attempts.push({ source: `latest:${latestSource}`, status: 'ok', message: 'fallback precio reciente en día hábil' })
      console.log(`importHistoryRange fallback latest: ${symbol} -> 1 día guardado (${targetDate}) fuente=latest:${latestSource}`)
      return { inserted: 1, source: `latest:${latestSource}`, attempts, from, to: toDate }
    } catch (e){
      attempts.push({ source: 'latest', status: 'error', message: String(e.message||e) })
      return { inserted: 0, source: source || null, attempts, from, to: toDate }
    }
  }

  // Filtrar solo días hábiles
  const filtered = items.filter(r => !isWeekend(r.fecha))

  const upsert = db.prepare(`INSERT INTO precios_historicos (ticker_id, fecha, precio, fuente_api, updated_at)
    VALUES (@ticker_id, @fecha, @precio, @fuente_api, @updated_at)
    ON CONFLICT(ticker_id, fecha) DO UPDATE SET precio=excluded.precio, fuente_api=excluded.fuente_api, updated_at=excluded.updated_at`)
  const nowIso = new Date().toISOString()
  const tx = db.transaction((rows)=>{
    for (const r of rows){
      upsert.run({ ticker_id: t.id, fecha: r.fecha, precio: r.precio, fuente_api: source, updated_at: nowIso })
    }
  })
  tx(filtered)

  console.log(`importHistoryRange: ${symbol} -> ${filtered.length} días guardados (${from} a ${toDate}) fuente=${source}`)
  return { inserted: filtered.length, source, attempts: attempts || [], from, to: toDate }
}

// CLI usage: node src/jobs/importHistoryRange.js TICKER FROM [TO]
if (process.argv[1] && process.argv[1].endsWith('importHistoryRange.js')){
  const [, , sym, fromArg, toArg] = process.argv
  const dbPath = process.env.DB_PATH || './data/investments.db'
  const db = createDb(dbPath)
  importHistoryRange(db, sym, fromArg, toArg).then(()=>{
    if (!process.env.KEEP_OPEN) db.close()
  }).catch(err=>{
    console.error('Error importHistoryRange:', err.message)
    if (!process.env.KEEP_OPEN) db.close()
    process.exitCode = 1
  })
}