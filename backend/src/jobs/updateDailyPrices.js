import { fetchPriceForSymbol } from '../sources/marketData.js'
import { getLimaDate } from '../utils/date.js'

export async function updateDailyPricesJob(db) {
  // Obtener ticker con exchange
  const tickers = db.prepare('SELECT id, ticker, exchange FROM tickers').all()
  const today = getLimaDate()

  for (const tickerObj of tickers) {
    try {
      // Pasar objeto completo con exchange
      const { price, source } = await fetchPriceForSymbol(tickerObj)

      const upsert = db.prepare(`INSERT INTO precios_historicos (ticker_id, fecha, precio, fuente_api, updated_at)
        VALUES (@ticker_id, @fecha, @precio, @fuente_api, @updated_at)
        ON CONFLICT(ticker_id, fecha) DO UPDATE SET precio=excluded.precio, fuente_api=excluded.fuente_api, updated_at=excluded.updated_at`)

      upsert.run({
        ticker_id: tickerObj.id,
        fecha: today,
        precio: price,
        fuente_api: source,
        updated_at: new Date().toISOString()
      })

      console.log(`✓ ${tickerObj.ticker} (${tickerObj.exchange || 'NYSE'}): $${price} from ${source}`)
    } catch (e) {
      console.error(`✗ ${tickerObj.ticker} (${tickerObj.exchange || 'NYSE'}):`, e.message)
    }
  }
}