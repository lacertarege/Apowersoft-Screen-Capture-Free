import { fetchDailyHistory } from '../sources/marketData.js'

function addDays(dateStr, days){
  const d = new Date(dateStr)
  d.setDate(d.getDate()+days)
  return d.toISOString().slice(0,10)
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
function nextWeekday(dateStr){
  const d = new Date(dateStr + 'T00:00:00Z')
  do { d.setUTCDate(d.getUTCDate() + 1) } while ([0,6].includes(d.getUTCDay()))
  return d.toISOString().slice(0,10)
}

export async function backfillHistoricalPrices(db){
  // Obtener IDs de tipos de inversión válidos (Acciones, ETFs)
  const tipoIds = db.prepare(`SELECT id FROM tipos_inversion WHERE UPPER(nombre) IN ('ACCIONES','ETFS')`).all().map(r=>r.id)
  if (tipoIds.length === 0) {
    console.log('backfillHistoricalPrices: no hay tipos de inversión Acciones/ETFs')
    return
  }
  // Solo tickers en USD (por ahora fuentes soportadas)
  const tickers = db.prepare(`SELECT id, ticker FROM tickers WHERE moneda='USD' AND tipo_inversion_id IN (${tipoIds.map(()=>'?').join(',')})`).all(...tipoIds)
  const today = lastWeekday(new Date().toISOString().slice(0,10))

  for (const t of tickers){
    try {
      const minCompra = db.prepare(`SELECT MIN(fecha) as f FROM inversiones WHERE ticker_id=?`).get(t.id)?.f
      if (!minCompra) {
        console.log('backfillHistoricalPrices: ticker sin compras, omitiendo', t.ticker)
        continue
      }
      // Un día hábil después de la compra más antigua (ignoramos maxHist para rellenar huecos)
      const from = nextWeekday(addDays(minCompra, 0)) // mover al siguiente hábil desde la fecha de compra (o día siguiente)
      if (from > today){
        console.log(`backfillHistoricalPrices: ${t.ticker} sin rango pendiente (from ${from} > today ${today})`)
        continue
      }

      const { items, source } = await fetchDailyHistory(t.ticker, from, today)
      if (!items || items.length === 0){
        console.log('backfillHistoricalPrices: sin datos para', t.ticker, 'rango', from, today)
        continue
      }

      const filtered = items.filter(r => !isWeekend(r.fecha))
      if (filtered.length === 0){
        console.log('backfillHistoricalPrices: todos los días del rango cayeron en fin de semana para', t.ticker)
        continue
      }

      const upsert = db.prepare(`INSERT INTO precios_historicos (ticker_id, fecha, precio, fuente_api, updated_at)
        VALUES (@ticker_id, @fecha, @precio, @fuente_api, @updated_at)
        ON CONFLICT(ticker_id, fecha) DO UPDATE SET precio=excluded.precio, fuente_api=excluded.fuente_api, updated_at=excluded.updated_at`)
      const tx = db.transaction((rows)=>{
        for (const r of rows){
          upsert.run({ ticker_id: t.id, fecha: r.fecha, precio: r.precio, fuente_api: source, updated_at: new Date().toISOString() })
        }
      })
      tx(filtered)

      console.log(`backfillHistoricalPrices: ${t.ticker} -> ${filtered.length} días guardados (${from} a ${today}) fuente=${source}`)
      // Pequeño delay para evitar rate limits de la API
      await new Promise(res=>setTimeout(res, 400))
    } catch (e){
      console.error('backfillHistoricalPrices error', t.ticker, e.message)
    }
  }
}