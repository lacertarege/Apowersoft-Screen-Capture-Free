import { fetchPriceForSymbol } from '../sources/marketData.js'
import { getLimaDate } from '../utils/date.js'

export async function updateDailyPricesJob(db) {
  const tickers = db.prepare('SELECT id, ticker FROM tickers').all()
  const today = getLimaDate()
  for (const t of tickers) {
    try {
      const { price, source } = await fetchPriceForSymbol(t.ticker)
      const upsert = db.prepare(`INSERT INTO precios_historicos (ticker_id, fecha, precio, fuente_api, updated_at)
        VALUES (@ticker_id, @fecha, @precio, @fuente_api, @updated_at)
        ON CONFLICT(ticker_id, fecha) DO UPDATE SET precio=excluded.precio, fuente_api=excluded.fuente_api, updated_at=excluded.updated_at`)
      upsert.run({ ticker_id: t.id, fecha: today, precio: price, fuente_api: source, updated_at: new Date().toISOString() })
    } catch (e) {
      console.error('updateDailyPricesJob error for', t.ticker, e.message)
    }
  }
}