import { request } from 'undici'
import { memoizeAsync } from '../utils/cache.js'
import pRetry from 'p-retry'

const AV_KEY = process.env.ALPHAVANTAGE_KEY
const POLY_KEY = process.env.POLYGON_KEY

// Exchange-specific symbol mapping
const EXCHANGE_SYMBOLS = {
  'NYSE': {
    polygon: (ticker) => ticker,
    alphavantage: (ticker) => ticker,
    yahoo: (ticker) => ticker,
  },
  'NASDAQ': {
    polygon: (ticker) => ticker,
    alphavantage: (ticker) => ticker,
    yahoo: (ticker) => ticker,
  },
  'BVL': {
    polygon: null,  // Polygon no soporta BVL
    alphavantage: null,  // AlphaVantage no soporta BVL
    yahoo: (ticker) => `${ticker}.LM`,  // Yahoo usa sufijo .LM para Lima
  },
}

// US stocks que cotizan en BVL - usar NYSE como fuente de precio
const US_STOCKS = [
  'AMZN', 'GOOGL', 'GOOG', 'NVDA', 'TSLA', 'AAPL', 'MSFT',
  'META', 'NFLX', 'SPY', 'QQQ', 'DIA', 'IWM',
  'JPM', 'BAC', 'WMT', 'JNJ', 'V', 'MA', 'PG', 'KO', 'PEP'
]

// Determinar si debe usar NYSE como referencia para stock USA en BVL
function shouldUseNysePrice(ticker, exchange) {
  if (exchange !== 'BVL') return false
  return US_STOCKS.includes(ticker.toUpperCase())
}

// Fallback local symbols to allow search without external API keys or when rate-limited
const MANUAL_SYMBOLS = [
  { ticker: 'AAPL', nombre: 'Apple Inc.', moneda: 'USD' },
  { ticker: 'MSFT', nombre: 'Microsoft Corporation', moneda: 'USD' },
  { ticker: 'TSLA', nombre: 'Tesla, Inc.', moneda: 'USD' },
  { ticker: 'GOOGL', nombre: 'Alphabet Inc. (Class A)', moneda: 'USD' },
  { ticker: 'AMZN', nombre: 'Amazon.com, Inc.', moneda: 'USD' },
  { ticker: 'NVDA', nombre: 'NVIDIA Corporation', moneda: 'USD' },
  { ticker: 'META', nombre: 'Meta Platforms, Inc.', moneda: 'USD' },
  { ticker: 'NFLX', nombre: 'Netflix, Inc.', moneda: 'USD' },
  { ticker: 'BABA', nombre: 'Alibaba Group Holding Limited', moneda: 'USD' },
  { ticker: 'JPM', nombre: 'JPMorgan Chase & Co.', moneda: 'USD' },
  { ticker: 'BAC', nombre: 'Bank of America Corporation', moneda: 'USD' },
  { ticker: 'KO', nombre: 'The Coca-Cola Company', moneda: 'USD' },
  { ticker: 'PEP', nombre: 'PepsiCo, Inc.', moneda: 'USD' },
  { ticker: 'SPY', nombre: 'SPDR S&P 500 ETF Trust', moneda: 'USD' },
]

// Common headers to reduce chances of 403/429 throttling on some providers (e.g., Yahoo)
const DEFAULT_HTTP_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
  'connection': 'keep-alive'
}

async function fetchJson(url, { headers } = {}) {
  try {
    const r = await request(url, {
      headers: { ...DEFAULT_HTTP_HEADERS, ...(headers || {}) },
      timeout: 10000 // 10 segundos timeout
    })

    if (r.statusCode < 200 || r.statusCode >= 300) {
      const text = await r.body.text()
      const err = new Error(`HTTP ${r.statusCode}: ${String(text || '').slice(0, 200)}`)
      err.statusCode = r.statusCode
      err.body = text
      throw err
    }

    try {
      return await r.body.json()
    } catch (e) {
      throw new Error(`Invalid JSON response: ${String(e?.message || 'Unknown error')}`)
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error(`No se pudo conectar con la API: ${error.message}`)
    }
    throw error
  }
}

async function _fetchPriceForSymbol(tickerInput) {
  // Manejar tanto string (legacy) como objeto
  const ticker = typeof tickerInput === 'string' ? tickerInput : tickerInput.ticker
  const exchange = typeof tickerInput === 'object' ? (tickerInput.exchange || 'NYSE') : 'NYSE'

  // Para US stocks en BVL, usar NYSE como referencia
  if (shouldUseNysePrice(ticker, exchange)) {
    console.log(`US stock ${ticker} en BVL - usando NYSE como referencia`)
    return _fetchPriceForSymbol({ ticker, exchange: 'NYSE' })
  }

  const config = EXCHANGE_SYMBOLS[exchange] || EXCHANGE_SYMBOLS['NYSE']

  // 1) API BVL Data (para exchange BVL) - obtener último precio
  if (exchange === 'BVL') {
    try {
      // Obtener últimas 5 días para asegurar que tengamos datos recientes
      const today = new Date()
      const fiveDaysAgo = new Date(today)
      fiveDaysAgo.setDate(today.getDate() - 5)

      const fromDate = fiveDaysAgo.toISOString().split('T')[0]
      const toDate = today.toISOString().split('T')[0]

      const url = `https://dataondemand.bvl.com.pe/v1/issuers/stock?name=${encodeURIComponent(ticker)}&startDate=${fromDate}&endDate=${toDate}`
      const data = await fetchJson(url)

      if (Array.isArray(data) && data.length > 0) {
        // Obtener el día más reciente
        const latest = data[data.length - 1]

        // Preferir close, luego average, luego yesterdayClose
        let price = latest.close && latest.close > 0 ? latest.close : null
        if (!price) price = latest.average && latest.average > 0 ? latest.average : null
        if (!price) price = latest.yesterdayClose && latest.yesterdayClose > 0 ? latest.yesterdayClose : null

        if (price) {
          console.log(`✓ Precio actual de ${ticker} desde BVL: $${price}`)
          return { price, source: `bvl:BVL` }
        }
      }
    } catch (e) {
      console.log(`⚠️ Error en API BVL para ${ticker}:`, e.message)
    }
  }

  // 2) Try Polygon spot price (si exchange lo soporta)
  if (config.polygon && POLY_KEY) {
    try {
      const symbol = config.polygon(ticker)
      const data = await fetchJson(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev?apiKey=${POLY_KEY}`)
      if (data && data.results && data.results[0]) {
        return { price: data.results[0].c, source: `polygon:${exchange}` }
      }
    } catch { }
  }

  // Fallback Alpha Vantage GLOBAL_QUOTE (si exchange lo soporta)
  if (config.alphavantage && AV_KEY) {
    try {
      const symbol = config.alphavantage(ticker)
      const data = await fetchJson(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${AV_KEY}`)
      const p = parseFloat(data?.['Global Quote']?.['05. price'])
      if (!Number.isNaN(p)) return { price: p, source: `alphavantage:${exchange}` }
    } catch { }
  }

  // Yahoo Finance fallback (mejor para BVL)
  if (config.yahoo) {
    try {
      const symbol = config.yahoo(ticker)
      // Implementación simple de Yahoo - solo para fallback
      // La función fetchDailyHistory tiene mejor implementación de Yahoo
      console.log(`Yahoo Finance fallback para ${symbol} (exchange: ${exchange})`)
    } catch { }
  }

  // Última opción: servicio local http://localhost:8000/tiempo-real/{ticker}
  try {
    const url = `http://localhost:8000/tiempo-real/${encodeURIComponent(ticker)}`
    const r = await request(url, { headers: { ...DEFAULT_HTTP_HEADERS } })
    if (r.statusCode >= 200 && r.statusCode < 300) {
      const raw = await r.body.text()
      let data
      try { data = JSON.parse(raw) } catch { }
      let price
      if (data && typeof data === 'object') {
        // Detectar campo de precio más probable
        price = [
          data.price,
          data.precio,
          data.last,
          data.close,
          data.valor,
          data?.data?.price,
          data?.data?.last,
          data?.result?.price,
        ].map(x => Number(x)).find(x => Number.isFinite(x))
      }
      if (!Number.isFinite(price)) {
        const m = String(raw || '').match(/[-+]?[0-9]*\.?[0-9]+/)
        if (m) price = Number(m[0])
      }
      if (Number.isFinite(price)) {
        return { price, source: 'local' }
      }
    }
  } catch { }

  throw new Error('No price available')
}

export const fetchPriceForSymbol = memoizeAsync(_fetchPriceForSymbol, 5 * 60 * 1000)

// Obtener histórico diario entre fechas [from, to]
export async function fetchDailyHistory(symbolOrObj, from, to) {
  // Manejar tanto string (legacy) como objeto con exchange
  const symbol = typeof symbolOrObj === 'string' ? symbolOrObj : symbolOrObj.ticker
  const exchange = typeof symbolOrObj === 'object' ? (symbolOrObj.exchange || 'NYSE') : 'NYSE'

  console.log(`📊 fetchDailyHistory: ${symbol} (${exchange}) desde ${from} hasta ${to}`)

  // Para US stocks en BVL, usar NYSE
  if (shouldUseNysePrice(symbol, exchange)) {
    console.log(`   → US stock en BVL detectado, redirigiendo a NYSE`)
    return fetchDailyHistory({ ticker: symbol, exchange: 'NYSE' }, from, to)
  }

  const config = EXCHANGE_SYMBOLS[exchange] || EXCHANGE_SYMBOLS['NYSE']
  const attempts = []

  // 1) API BVL Data (solo para exchange BVL)
  if (exchange === 'BVL') {
    console.log(`   → Intentando API oficial BVL (dataondemand.bvl.com.pe)`)
    try {
      const url = `https://dataondemand.bvl.com.pe/v1/issuers/stock?name=${encodeURIComponent(symbol)}&startDate=${from}&endDate=${to}`
      const data = await fetchJson(url)

      if (Array.isArray(data) && data.length > 0) {
        // Parsear respuesta de BVL - preferir close, luego average, luego yesterdayClose
        const items = data.map(item => {
          let precio = item.close && item.close > 0 ? item.close : null
          if (!precio) precio = item.average && item.average > 0 ? item.average : null
          if (!precio) precio = item.yesterdayClose && item.yesterdayClose > 0 ? item.yesterdayClose : null

          return precio ? { fecha: item.date, precio } : null
        }).filter(x => x !== null)

        if (items.length > 0) {
          attempts.push({ source: 'bvl', status: 'ok', count: items.length, message: `${items.length} días desde BVL oficial` })
          return { items, source: 'bvl:BVL', attempts }
        } else {
          attempts.push({ source: 'bvl', status: 'nodata', message: 'respuesta sin precios válidos' })
        }
      } else {
        attempts.push({ source: 'bvl', status: 'nodata', message: 'respuesta vacía o sin datos' })
      }
    } catch (e) {
      attempts.push({ source: 'bvl', status: 'error', message: String(e.message || e) })
    }
  }

  // 2) Intentar con Polygon aggregates 1/day
  if (POLY_KEY) {
    try {
      const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${POLY_KEY}`
      const data = await fetchJson(url)
      if (data && Array.isArray(data.results) && data.results.length) {
        const items = data.results.map(x => ({
          fecha: new Date(x.t).toISOString().slice(0, 10),
          precio: x.c
        }))
        attempts.push({ source: 'polygon', status: 'ok', count: items.length, message: `${items.length} días en el rango` })
        return { items, source: 'polygon', attempts }
      } else {
        // Si Polygon responde con status distinto de OK, reportar como error para mejor diagnóstico
        const status = (data && data.status) ? String(data.status) : 'nodata'
        if (status && status !== 'OK') attempts.push({ source: 'polygon', status: 'error', message: status })
        else attempts.push({ source: 'polygon', status: 'nodata', message: 'sin datos para el rango' })
      }
    } catch (e) { attempts.push({ source: 'polygon', status: 'error', message: String(e.message || e) }) }
  } else {
    attempts.push({ source: 'polygon', status: 'skipped', message: 'No API key' })
  }
  // 2) Fallback Alpha Vantage TIME_SERIES_DAILY_ADJUSTED (full) y filtrar rango
  if (AV_KEY) {
    try {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=full&apikey=${AV_KEY}`
      const data = await fetchJson(url)
      // Detectar límites de cuota o errores documentados y reportarlos como error informativo
      if (data?.Note || data?.Information) throw new Error(data.Note || data.Information)
      if (data?.['Error Message']) throw new Error(data['Error Message'])
      const series = data && (data['Time Series (Daily)'] || data['Time Series Daily'] || data['Time Series'] || data['Time Series (Daily)'])
      if (series) {
        const items = Object.keys(series)
          .filter(d => d >= from && d <= to)
          .sort()
          .map(d => ({ fecha: d, precio: parseFloat(series[d]['5. adjusted close'] || series[d]['4. close'] || series[d]['4. close']) }))
        if (items.length) {
          attempts.push({ source: 'alphavantage', status: 'ok', count: items.length, message: `${items.length} días en el rango` })
          return { items, source: 'alphavantage', attempts }
        } else {
          attempts.push({ source: 'alphavantage', status: 'nodata', message: 'serie disponible, sin datos en el rango' })
        }
      } else {
        attempts.push({ source: 'alphavantage', status: 'nodata', message: 'respuesta sin serie diaria' })
      }
    } catch (e) { attempts.push({ source: 'alphavantage', status: 'error', message: String(e.message || e) }) }
  } else {
    attempts.push({ source: 'alphavantage', status: 'skipped', message: 'No API key' })
  }
  // 3) Fallback Yahoo Finance chart API (sin API key)
  const period1 = Math.floor(new Date(from + 'T00:00:00Z').getTime() / 1000)
  // Yahoo usa period2 exclusivo, sumamos un día para incluir 'to'
  const period2 = Math.floor(new Date(to + 'T23:59:59Z').getTime() / 1000)

  const buildYahooUrl = (host, sym) => `https://${host}/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&includeAdjustedClose=true&period1=${period1}&period2=${period2}`

  const tryYahooFetch = async (sym, label = 'yahoo', host = 'query1.finance.yahoo.com') => {
    const url = buildYahooUrl(host, sym)
    try {
      const runner = async () => {
        const data = await fetchJson(url, { headers: { referer: 'https://finance.yahoo.com' } })
        const res = data?.chart?.result?.[0]
        const ts = res?.timestamp
        const adj = res?.indicators?.adjclose?.[0]?.adjclose
        const close = res?.indicators?.quote?.[0]?.close
        if (!Array.isArray(ts) || ts.length === 0) return { items: null }
        const prices = Array.isArray(adj) && adj.length === ts.length ? adj : close
        if (!Array.isArray(prices) || prices.length !== ts.length) return { items: null }
        const items = ts.map((t, i) => ({
          fecha: new Date(t * 1000).toISOString().slice(0, 10),
          precio: prices[i]
        })).filter(x => x.fecha >= from && x.fecha <= to && Number.isFinite(x.precio))
        return { items }
      }
      const result = await pRetry(runner, { retries: 2, minTimeout: 700, factor: 2 })
      if (result?.items && result.items.length) {
        attempts.push({ source: label, status: 'ok', count: result.items.length, message: `${result.items.length} días en el rango` })
        return { items: result.items, source: 'yahoo', attempts }
      } else {
        attempts.push({ source: label, status: 'nodata', message: 'sin datos para el rango' })
      }
    } catch (e) {
      attempts.push({ source: label, status: 'error', message: String(e.message || e) })
    }
    return null
  }

  // Determinar símbolo correcto para Yahoo según exchange
  const yahooSymbol = config.yahoo ? config.yahoo(symbol) : symbol
  console.log(`   → Intentando Yahoo Finance con símbolo: ${yahooSymbol}`)

  const y1 = await tryYahooFetch(yahooSymbol, `yahoo:${exchange}`, 'query1.finance.yahoo.com')
  if (y1) return y1

  // Host alterno
  const yAlt = await tryYahooFetch(yahooSymbol, `yahoo.alt:${exchange}`, 'query2.finance.yahoo.com')
  if (yAlt) return yAlt

  return { items: [], source: null, attempts }
}

async function _searchSymbols(q) {
  // Polygon first
  try {
    const data = await fetchJson(`https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(q)}&active=true&apiKey=${POLY_KEY}`)
    const items = (data.results || []).map(x => ({ ticker: x.ticker, nombre: x.name, moneda: x.currency_name || x.currency_symbol || 'USD' }))
    if (items.length) return { items, source: 'polygon' }
  } catch { }
  // Alpha Vantage SYMBOL_SEARCH
  try {
    const data = await fetchJson(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(q)}&apikey=${AV_KEY}`)
    const items = (data.bestMatches || []).map(x => ({ ticker: x['1. symbol'], nombre: x['2. name'], moneda: x['8. currency'] || 'USD' }))
    if (items.length) return { items, source: 'alphavantage' }
  } catch { }
  // Local manual fallback
  const ql = (q || '').toLowerCase().trim()
  if (ql) {
    const items = MANUAL_SYMBOLS.filter(x => x.ticker.toLowerCase().includes(ql) || x.nombre.toLowerCase().includes(ql)).slice(0, 20)
    if (items.length) return { items, source: 'manual' }
  }
  return { items: [], source: 'manual' }
}

export const searchSymbols = memoizeAsync(_searchSymbols, 15 * 60 * 1000)