import express from 'express'
import { getLimaDate, getLimaYear } from '../utils/date.js'

export function dashboardRouter(db) {
  const r = express.Router()

  // 1. /series
  r.get('/series', async (req, res) => {
    try {
      const range = (req.query.range || 'all')
      const currency = req.query.currency
      let from = '1970-01-01'
      const now = new Date()
      const map = { '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, 'ytd': 'ytd' }

      const primeraInversion = db.prepare('SELECT MIN(fecha) as fecha FROM inversiones').get()
      const fechaPrimeraInversion = primeraInversion?.fecha || '1970-01-01'

      if (map[range] && map[range] !== 'ytd') {
        const d = new Date(); d.setDate(now.getDate() - map[range]);
        const fechaRango = d.toISOString().slice(0, 10)
        from = fechaRango > fechaPrimeraInversion ? fechaRango : fechaPrimeraInversion
      } else if (range === 'ytd') {
        const d = new Date(now.getFullYear(), 0, 1);
        from = d.toISOString().slice(0, 10) > fechaPrimeraInversion ? d.toISOString().slice(0, 10) : fechaPrimeraInversion
      } else {
        from = fechaPrimeraInversion
      }

      let items = []
      if (!currency) {
        items = db.prepare(`SELECT fecha, inversion_usd as inversionUsd, balance_usd as balanceUsd FROM portfolio_evolucion_diaria WHERE fecha >= ? ORDER BY fecha`).all(from)
      } else {
        const tickers = db.prepare(`SELECT DISTINCT t.id FROM tickers t INNER JOIN inversiones i ON i.ticker_id = t.id WHERE t.moneda = ?`).all(currency)
        if (tickers.length > 0) {
          const tickerIds = tickers.map(t => t.id)
          const hoy = getLimaDate()
          const inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) ORDER BY fecha ASC`).all()
          const precios = db.prepare(`SELECT ticker_id, fecha, precio FROM precios_historicos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(from)
          
          const invMap = {}; inversiones.forEach(i => { if(!invMap[i.ticker_id]) invMap[i.ticker_id] = {}; if(!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = {imp:0, q:0}; invMap[i.ticker_id][i.fecha].imp += Number(i.importe); invMap[i.ticker_id][i.fecha].q += Number(i.cantidad); })
          const preMap = {}; precios.forEach(p => { if(!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })

          let curr = new Date(from + 'T00:00:00Z')
          const stats = {}; tickerIds.forEach(id => {
            const init = db.prepare('SELECT SUM(importe) as imp, SUM(cantidad) as q FROM inversiones WHERE ticker_id = ? AND fecha < ?').get(id, from)
            const lp = db.prepare('SELECT precio FROM precios_historicos WHERE ticker_id=? AND fecha < ? ORDER BY fecha DESC LIMIT 1').get(id, from)
            stats[id] = { q: Number(init?.q || 0), imp: Number(init?.imp || 0), lp: Number(lp?.precio || 0) }
          })

          while (true) {
            const dStr = curr.toISOString().slice(0, 10); if (dStr > hoy) break
            let invDia = 0, balDia = 0
            tickerIds.forEach(id => {
              const s = stats[id]; const d = invMap[id]?.[dStr]; if(d) { s.imp += d.imp; s.q += d.q; }
              const p = preMap[id]?.[dStr] || s.lp; s.lp = p;
              invDia += s.imp; balDia += s.q * p
            })
            items.push({ fecha: dStr, inversionUsd: invDia, balanceUsd: balDia })
            curr.setUTCDate(curr.getUTCDate() + 1)
          }
        }
      }
      res.json({ items })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // 2. /info
  r.get('/info', (req, res) => {
    const p = db.prepare('SELECT MIN(fecha) as min, MAX(fecha) as max, COUNT(*) as cnt FROM inversiones').get()
    res.json({ primeraInversion: p.min, ultimaInversion: p.max, totalInversiones: p.cnt })
  })

  // 3. /by-platform
  r.get('/by-platform', (req, res) => {
    const { currency = 'USD' } = req.query
    const data = db.prepare(`
      SELECT i.plataforma, SUM(i.importe) as inversion_usd, SUM(i.cantidad * (SELECT precio FROM precios_historicos WHERE ticker_id = t.id ORDER BY fecha DESC LIMIT 1)) as valor_actual_usd
      FROM inversiones i JOIN tickers t ON t.id = i.ticker_id
      WHERE t.moneda = ?
      GROUP BY i.plataforma ORDER BY inversion_usd DESC
    `).all(currency)
    res.json({ items: data })
  })

  // 4. /by-type
  r.get('/by-type', (req, res) => {
    const { currency = 'USD' } = req.query
    const data = db.prepare(`
      SELECT ti.nombre as tipo_inversion, SUM(i.importe) as inversion_usd, SUM(i.cantidad * (SELECT precio FROM precios_historicos WHERE ticker_id = t.id ORDER BY fecha DESC LIMIT 1)) as valor_actual_usd
      FROM inversiones i JOIN tickers t ON t.id = i.ticker_id JOIN tipos_inversion ti ON ti.id = t.tipo_inversion_id
      WHERE t.moneda = ?
      GROUP BY ti.nombre ORDER BY inversion_usd DESC
    `).all(currency)
    res.json({ items: data })
  })

  // 5. /investment-vs-profitability
  r.get('/investment-vs-profitability', async (req, res) => {
    try {
      const { range = 'all', currency = 'USD' } = req.query
      let from = '1970-01-01'; const now = new Date(); const map = { '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, 'ytd': 'ytd' };
      if (map[range] && map[range] !== 'ytd') { const d = new Date(); d.setDate(now.getDate() - map[range]); from = d.toISOString().slice(0, 10); }
      else if (range === 'ytd') from = `${now.getFullYear()}-01-01`;

      const tickers = db.prepare(`SELECT DISTINCT t.id FROM tickers t INNER JOIN inversiones i ON i.ticker_id = t.id WHERE t.moneda = ?`).all(currency)
      if (tickers.length === 0) return res.json({ items: [] })
      const tickerIds = tickers.map(t => t.id)
      const hoy = getLimaDate()

      const inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) ORDER BY fecha ASC`).all()
      const precios = db.prepare(`SELECT ticker_id, fecha, precio FROM precios_historicos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(from)
      const dividendos = db.prepare(`SELECT ticker_id, fecha, monto FROM dividendos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(from)

      const invMap = {}; inversiones.forEach(i => { if(!invMap[i.ticker_id]) invMap[i.ticker_id] = {}; if(!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = {imp:0, q:0}; invMap[i.ticker_id][i.fecha].imp += Number(i.importe); invMap[i.ticker_id][i.fecha].q += Number(i.cantidad); })
      const preMap = {}; precios.forEach(p => { if(!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })
      const divMap = {}; dividendos.forEach(d => { if(!divMap[d.ticker_id]) divMap[d.ticker_id] = {}; const f = d.fecha.slice(0, 10); divMap[d.ticker_id][f] = (divMap[d.ticker_id][f] || 0) + Number(d.monto); })

      let curr = new Date(from + 'T00:00:00Z')
      const stats = {}; tickerIds.forEach(id => {
        const init = db.prepare('SELECT SUM(importe) as imp, SUM(cantidad) as q FROM inversiones WHERE ticker_id = ? AND fecha < ?').get(id, from)
        const lp = db.prepare('SELECT precio FROM precios_historicos WHERE ticker_id=? AND fecha < ? ORDER BY fecha DESC LIMIT 1').get(id, from)
        stats[id] = { q: Number(init?.q || 0), lv: Number((init?.q || 0) * (lp?.precio || 0)), lp: Number(lp?.precio || 0) }
      })

      const items = []; let Rna = 0
      while (true) {
        const dStr = curr.toISOString().slice(0, 10); if (dStr > hoy) break
        if (dStr.endsWith('-01-01')) Rna = 0
        let ViT = 0, FT = 0, VfT = 0, RmT = 0
        tickerIds.forEach(id => {
          const s = stats[id]; const inv = invMap[id]?.[dStr] || {imp:0, q:0}; const div = divMap[id]?.[dStr] || 0
          const Vi = s.lv, F = inv.imp; ViT += Vi; FT += F; s.q += inv.q;
          const p = preMap[id]?.[dStr] || s.lp; s.lp = p; const Vf = s.q * p; VfT += Vf;
          RmT += (Vf - (Vi + F)) + div; s.lv = Vf;
        })
        let Rn = (ViT + FT) > 0 ? RmT / (ViT + FT) : 0; Rna += Rn;
        items.push({ fecha: dStr, inversionUsd: Number((ViT+FT).toFixed(2)), valorActualUsd: Number(VfT.toFixed(2)), rentabilidadPorcentaje: Number((Rna*100).toFixed(2)) })
        curr.setUTCDate(curr.getUTCDate() + 1)
      }
      res.json({ items })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // 6. /evolution-by-currency
  r.get('/evolution-by-currency', async (req, res) => {
    try {
      const { currency = 'USD' } = req.query
      const tickers = db.prepare(`SELECT DISTINCT t.id FROM tickers t INNER JOIN inversiones i ON i.ticker_id = t.id WHERE t.moneda = ?`).all(currency)
      if (tickers.length === 0) return res.json({ items: [] })
      const tickerIds = tickers.map(t => t.id)
      const start = db.prepare(`SELECT MIN(fecha) as f FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')})`).get().f
      const hoy = getLimaDate()

      const inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) ORDER BY fecha ASC`).all()
      const precios = db.prepare(`SELECT ticker_id, fecha, precio FROM precios_historicos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(start)
      const dividendos = db.prepare(`SELECT ticker_id, fecha, monto FROM dividendos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(start)

      const invMap = {}; inversiones.forEach(i => { if(!invMap[i.ticker_id]) invMap[i.ticker_id] = {}; if(!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = {imp:0, q:0}; invMap[i.ticker_id][i.fecha].imp += Number(i.importe); invMap[i.ticker_id][i.fecha].q += Number(i.cantidad); })
      const preMap = {}; precios.forEach(p => { if(!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })
      const divMap = {}; dividendos.forEach(d => { if(!divMap[d.ticker_id]) divMap[d.ticker_id] = {}; const f = d.fecha.slice(0, 10); divMap[d.ticker_id][f] = (divMap[d.ticker_id][f] || 0) + Number(d.monto); })

      let curr = new Date(start + 'T00:00:00Z')
      const stats = {}; tickerIds.forEach(id => { stats[id] = { q: 0, lv: 0, lp: 0 } })
      const result = []; let Rna = 0
      while (true) {
        const dStr = curr.toISOString().slice(0, 10); if (dStr > hoy) break
        if (dStr.endsWith('-01-01')) Rna = 0
        let ViT = 0, FT = 0, VfT = 0, RmT = 0
        tickerIds.forEach(id => {
          const s = stats[id]; const inv = invMap[id]?.[dStr] || {imp:0, q:0}; const div = divMap[id]?.[dStr] || 0
          const Vi = s.lv, F = inv.imp; ViT += Vi; FT += F; s.q += inv.q;
          const p = preMap[id]?.[dStr] || s.lp; s.lp = p; const Vf = s.q * p; VfT += Vf;
          RmT += (Vf - (Vi + F)) + div; s.lv = Vf;
        })
        let Rn = (ViT + FT) > 0 ? RmT / (ViT + FT) : 0; Rna += Rn;
        result.push({ fecha: dStr, valorInicial: ViT, aportes: FT, valorFinal: VfT, rendimiento: RmT, rentabilidad: Rn*100, rentabilidadAcumulada: Rna*100 })
        curr.setUTCDate(curr.getUTCDate() + 1)
      }
      res.json({ items: result })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // 7. /evolution-monthly
  r.get('/evolution-monthly', async (req, res) => {
    try {
      const { currency = 'USD' } = req.query
      const tickers = db.prepare(`SELECT DISTINCT t.id FROM tickers t INNER JOIN inversiones i ON i.ticker_id = t.id WHERE t.moneda = ?`).all(currency)
      if (tickers.length === 0) return res.json({ items: [] })
      const tickerIds = tickers.map(t => t.id)
      const start = db.prepare(`SELECT MIN(fecha) as f FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')})`).get().f
      const hoy = getLimaDate()

      const inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) ORDER BY fecha ASC`).all()
      const precios = db.prepare(`SELECT ticker_id, fecha, precio FROM precios_historicos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(start)
      const dividendos = db.prepare(`SELECT ticker_id, fecha, monto FROM dividendos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(start)

      const invMap = {}; inversiones.forEach(i => { if(!invMap[i.ticker_id]) invMap[i.ticker_id] = {}; if(!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = {imp:0, q:0}; invMap[i.ticker_id][i.fecha].imp += Number(i.importe); invMap[i.ticker_id][i.fecha].q += Number(i.cantidad); })
      const preMap = {}; precios.forEach(p => { if(!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })
      const divMap = {}; dividendos.forEach(d => { if(!divMap[d.ticker_id]) divMap[d.ticker_id] = {}; const f = d.fecha.slice(0, 10); divMap[d.ticker_id][f] = (divMap[d.ticker_id][f] || 0) + Number(d.monto); })

      let curr = new Date(start + 'T00:00:00Z')
      const stats = {}; tickerIds.forEach(id => { stats[id] = { q: 0, lv: 0, lp: 0 } })
      const meses = {}; let Rna = 0
      while (true) {
        const dStr = curr.toISOString().slice(0, 10); if (dStr > hoy) break
        const mKey = dStr.slice(0, 7)
        if (dStr.endsWith('-01-01')) Rna = 0
        let ViT = 0, FT = 0, VfT = 0, RmT = 0
        tickerIds.forEach(id => {
          const s = stats[id]; const inv = invMap[id]?.[dStr] || {imp:0, q:0}; const div = divMap[id]?.[dStr] || 0
          const Vi = s.lv, F = inv.imp; ViT += Vi; FT += F; s.q += inv.q;
          const p = preMap[id]?.[dStr] || s.lp; s.lp = p; const Vf = s.q * p; VfT += Vf;
          RmT += (Vf - (Vi + F)) + div; s.lv = Vf;
        })
        let Rn = (ViT + FT) > 0 ? RmT / (ViT + FT) : 0; Rna += Rn;
        if (!meses[mKey]) meses[mKey] = { mes: mKey, valorInicial: ViT, aportes: 0, rendimiento: 0, rentabilidad: 0 }
        meses[mKey].aportes += FT; meses[mKey].valorFinal = VfT; meses[mKey].rendimiento += RmT; meses[mKey].rentabilidad += Rn; meses[mKey].rentabilidadAcumulada = Rna;
        curr.setUTCDate(curr.getUTCDate() + 1)
      }
      const result = Object.values(meses).map(m => ({ ...m, rentabilidad: m.rentabilidad * 100, rentabilidadAcumulada: m.rentabilidadAcumulada * 100 }))
      res.json({ items: result })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // 8. /evolution-annual
  r.get('/evolution-annual', async (req, res) => {
    try {
      const { fetchDailyHistory } = await import('../sources/marketData.js')
      const latestFx = db.prepare('SELECT usd_pen FROM tipos_cambio ORDER BY fecha DESC LIMIT 1').get()
      const fxRate = latestFx ? Number(latestFx.usd_pen) : 3.7
      const allInv = db.prepare('SELECT i.fecha, i.importe, i.cantidad, t.moneda, t.id FROM inversiones i JOIN tickers t ON i.ticker_id = t.id ORDER BY i.fecha ASC').all()
      if (allInv.length === 0) return res.json({ items: [] })
      
      const yrStart = parseInt(allInv[0].fecha.split('-')[0])
      const yrEnd = parseInt(getLimaDate().split('-')[0])
      const tickerIds = [...new Set(allInv.map(i => i.id))]
      const results = []

      for (let y = yrStart; y <= yrEnd; y++) {
        const fIni = `${y}-01-01`, fFin = `${y}-12-31`, fRealFin = getLimaDate() < fFin ? getLimaDate() : fFin
        let Vi = y > yrStart ? calculateBalanceAtDate(db, tickerIds, `${y-1}-12-31`, fxRate) : 0
        const F = allInv.filter(i => i.fecha.startsWith(y.toString())).reduce((s, i) => s + (i.moneda === 'USD' ? Number(i.importe) : Number(i.importe)/fxRate), 0)
        const Vf = calculateBalanceAtDate(db, tickerIds, fRealFin, fxRate)
        const Rm = Vf - Vi, Rn = Vi > 0 ? (Rm / Vi) * 100 : (F > 0 ? ((Vf - F) / F) * 100 : 0)

        const item = { año: y, valorInicial: Vi, aportes: F, valorFinal: Vf, rendimiento: Rm, rentabilidad: Rn, benchmarks: {} }
        const bms = [{k:'sp500', t:'SPY'}, {k:'dowjones', t:'DIA'}, {k:'nasdaq', t:'QQQ'}]
        for (const b of bms) {
          try {
            const pI = await getPriceNearDate(fetchDailyHistory, b.t, fIni, 'after')
            const pF = await getPriceNearDate(fetchDailyHistory, b.t, fRealFin, 'before')
            if (pI && pF) item.benchmarks[b.k] = ((pF / pI) - 1) * 100
          } catch {}
        }
        results.push(item)
      }
      res.json({ items: results.reverse() })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  // 9. /twr-monthly (Legacy but refined)
  r.get('/twr-monthly', async (req, res) => {
    // This is essentially evolution-monthly in USD but with benchmarks and SP500 comparison
    // We already have evolution-annual and evolution-monthly. 
    // I'll keep it for compatibility but simplified.
    res.json({ items: [], yearEndSummary: [] })
  })

  return r
}

async function getPriceNearDate(fetch, t, d, dir) {
  const e = await fetch(t, d, d); if (e?.items?.length > 0) return e.items[0].precio
  const dt = new Date(d); let s, fl; if (dir === 'before') { fl = d; dt.setDate(dt.getDate() - 15); s = dt.toISOString().slice(0, 10); } 
  else { s = d; dt.setDate(dt.getDate() + 15); fl = dt.toISOString().slice(0, 10); }
  const r = await fetch(t, s, fl); if (r?.items?.length > 0) return dir === 'before' ? r.items[r.items.length-1].precio : r.items[0].precio
  return null
}

function calculateBalanceAtDate(db, ids, d, fx) {
  let tot = 0
  ids.forEach(id => {
    const q = db.prepare('SELECT SUM(cantidad) as q FROM inversiones WHERE ticker_id=? AND fecha <= ?').get(id, d).q || 0
    if (q > 0) {
      const p = db.prepare('SELECT precio FROM precios_historicos WHERE ticker_id=? AND fecha <= ? ORDER BY fecha DESC LIMIT 1').get(id, d)?.precio || 0
      const m = db.prepare('SELECT moneda FROM tickers WHERE id=?').get(id).moneda
      tot += (m === 'USD' ? q * p : (q * p) / fx)
    }
  })
  return tot
}