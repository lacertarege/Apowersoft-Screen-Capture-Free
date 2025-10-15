import { request } from 'undici'

const RAPID_HOST = 'stock-and-options-trading-data-provider.p.rapidapi.com'
const RAPID_KEY = process.env.RAPIDAPI_KEY || process.env.OPTIONS_RAPIDAPI_KEY || ''
const RAPID_PROXY_SECRET = process.env.RAPIDAPI_PROXY_SECRET || ''

const DEFAULT_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
  'accept': 'application/json, text/plain, */*',
}

async function fetchJson(url, headers){
  const r = await request(url, { headers })
  const txt = await r.body.text()
  if (r.statusCode < 200 || r.statusCode >= 300){
    const err = new Error(`HTTP ${r.statusCode}: ${String(txt||'').slice(0,200)}`)
    err.statusCode = r.statusCode
    err.body = txt
    throw err
  }
  try{ return JSON.parse(txt) } catch(e){ throw new Error(String(e?.message||'Invalid JSON')) }
}

function normalizeOption(raw){
  if (!raw || typeof raw !== 'object') return null
  return {
    symbol: raw.symbol ?? raw.ticker ?? null,
    type: raw.type ?? (raw.optionType ?? (raw.symbol && /[CP]\d{8}/.test(raw.symbol) ? (raw.symbol.includes('C')?'call':'put') : null)),
    strike: Number(raw.strike ?? raw.strikePrice ?? raw.strike_price),
    last: Number(raw.last ?? raw.lastPrice ?? raw.last_price),
    bid: Number(raw.bid ?? raw.bidPrice ?? raw.bid_price),
    ask: Number(raw.ask ?? raw.askPrice ?? raw.ask_price),
    openInterest: Number(raw['open interest'] ?? raw.openInterest ?? raw.open_interest),
    volume: Number(raw.volume ?? raw.vol),
    change: Number(raw.change ?? raw.chg),
    percentChange: Number(raw.percentChange ?? raw.pctChange ?? raw.pct_change),
    iv: Number(raw.iv ?? raw.impliedVolatility ?? raw.implied_volatility),
    expiration: raw.expiration ?? raw.expiry ?? raw.expirationDate ?? null,
  }
}

export async function fetchOptionsChain(symbol){
  if (!RAPID_KEY) {
    const e = new Error('RAPIDAPI_KEY requerido para consultar opciones')
    e.code = 'NO_KEY'
    throw e
  }
  const url = `https://${RAPID_HOST}/options/${encodeURIComponent(symbol)}`
  const headers = {
    ...DEFAULT_HEADERS,
    'X-RapidAPI-Host': RAPID_HOST,
    'X-RapidAPI-Key': RAPID_KEY,
  }
  if (RAPID_PROXY_SECRET) headers['X-RapidAPI-Proxy-Secret'] = RAPID_PROXY_SECRET

  const data = await fetchJson(url, headers)

  // Intentar localizar arrays de calls/puts o un único array
  let calls = [], puts = []
  // Distintos posibles envoltorios
  const root = data?.data ?? data?.result ?? data
  const fromRoot = (root?.options || root?.chains || root?.chain || root)

  const arrCalls = fromRoot?.calls || fromRoot?.call || fromRoot?.Call || []
  const arrPuts = fromRoot?.puts || fromRoot?.put || fromRoot?.Put || []

  if (Array.isArray(arrCalls)) calls = arrCalls.map(normalizeOption).filter(Boolean)
  if (Array.isArray(arrPuts)) puts = arrPuts.map(normalizeOption).filter(Boolean)

  // Algunos proveedores devuelven una sola lista mixta
  if (!calls.length && !puts.length && Array.isArray(fromRoot)){
    const mixed = fromRoot.map(normalizeOption).filter(Boolean)
    // Heurística por símbolo
    for (const o of mixed){
      if (!o || !o.symbol) continue
      if (/C\d{8}/.test(o.symbol)) calls.push(o)
      else if (/P\d{8}/.test(o.symbol)) puts.push(o)
    }
    // Si sigue vacío, devolver como calls genéricas
    if (!calls.length && !puts.length) calls = mixed
  }

  return { symbol, calls, puts, provider: 'rapidapi:stock-and-options-trading-data-provider' }
}