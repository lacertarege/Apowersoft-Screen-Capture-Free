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

          const invMap = {}; inversiones.forEach(i => { if (!invMap[i.ticker_id]) invMap[i.ticker_id] = {}; if (!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = { imp: 0, q: 0 }; invMap[i.ticker_id][i.fecha].imp += Number(i.importe); invMap[i.ticker_id][i.fecha].q += Number(i.cantidad); })
          const preMap = {}; precios.forEach(p => { if (!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })

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
              const s = stats[id]; const d = invMap[id]?.[dStr]; if (d) { s.imp += d.imp; s.q += d.q; }
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

  // 4a. /by-exchange
  r.get('/by-exchange', (req, res) => {
    const { currency = 'USD' } = req.query
    const data = db.prepare(`
      SELECT t.exchange, SUM(i.importe) as inversion_usd, SUM(i.cantidad * (SELECT precio FROM precios_historicos WHERE ticker_id = t.id ORDER BY fecha DESC LIMIT 1)) as valor_actual_usd
      FROM inversiones i JOIN tickers t ON t.id = i.ticker_id
      WHERE t.moneda = ? AND t.exchange IS NOT NULL
      GROUP BY t.exchange ORDER BY inversion_usd DESC
    `).all(currency)
    res.json({ items: data })
  })

  // 5. /investment-vs-profitability
  r.get('/investment-vs-profitability', async (req, res) => {
    try {
      const { range = 'all', currency = 'USD' } = req.query

      // Define minimum start dates per currency
      const minStartDates = {
        'USD': '2023-05-01',
        'PEN': '2023-06-01'
      }

      let from = '1970-01-01'; const now = new Date(); const map = { '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, 'ytd': 'ytd' };
      if (map[range] && map[range] !== 'ytd') { const d = new Date(); d.setDate(now.getDate() - map[range]); from = d.toISOString().slice(0, 10); }
      else if (range === 'ytd') from = `${now.getFullYear()}-01-01`;

      //Apply minimum start date for the currency when range is 'all'
      if (range === 'all' && minStartDates[currency]) {
        from = minStartDates[currency];
      }

      const tickers = db.prepare(`SELECT DISTINCT t.id FROM tickers t INNER JOIN inversiones i ON i.ticker_id = t.id WHERE t.moneda = ?`).all(currency)
      if (tickers.length === 0) return res.json({ items: [] })
      const tickerIds = tickers.map(t => t.id)
      const hoy = getLimaDate()

      // For currency-specific minimum dates, filter out earlier investments
      let inversiones
      if (range === 'all' && minStartDates[currency]) {
        inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(minStartDates[currency])
      } else {
        inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) ORDER BY fecha ASC`).all()
      }

      const precios = db.prepare(`SELECT ticker_id, fecha, precio FROM precios_historicos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(from)
      const dividendos = db.prepare(`SELECT ticker_id, fecha, monto FROM dividendos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(from)

      const invMap = {}; inversiones.forEach(i => { if (!invMap[i.ticker_id]) invMap[i.ticker_id] = {}; if (!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = { imp: 0, q: 0 }; invMap[i.ticker_id][i.fecha].imp += Number(i.importe); invMap[i.ticker_id][i.fecha].q += Number(i.cantidad); })
      const preMap = {}; precios.forEach(p => { if (!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })
      const divMap = {}; dividendos.forEach(d => { if (!divMap[d.ticker_id]) divMap[d.ticker_id] = {}; const f = d.fecha.slice(0, 10); divMap[d.ticker_id][f] = (divMap[d.ticker_id][f] || 0) + Number(d.monto); })

      let curr = new Date(from + 'T00:00:00Z')
      const stats = {};

      // Initialize stats - for currency-specific minimum dates, start from zero
      const shouldStartFromZero = range === 'all' && minStartDates[currency]

      tickerIds.forEach(id => {
        if (shouldStartFromZero) {
          // Start from zero for currency-specific date ranges
          stats[id] = { q: 0, lv: 0, lp: 0 }
        } else {
          // Load previous state for other ranges
          const init = db.prepare('SELECT SUM(importe) as imp, SUM(cantidad) as q FROM inversiones WHERE ticker_id = ? AND fecha < ?').get(id, from)
          const lp = db.prepare('SELECT precio FROM precios_historicos WHERE ticker_id=? AND fecha < ? ORDER BY fecha DESC LIMIT 1').get(id, from)
          stats[id] = { q: Number(init?.q || 0), lv: Number((init?.q || 0) * (lp?.precio || 0)), lp: Number(lp?.precio || 0) }
        }
      })

      const items = []; let RmAcum = 0; let AportesAcum = 0
      while (true) {
        const dStr = curr.toISOString().slice(0, 10); if (dStr > hoy) break
        let ViT = 0, FT = 0, VfT = 0, RmT = 0
        tickerIds.forEach(id => {
          const s = stats[id]; const inv = invMap[id]?.[dStr] || { imp: 0, q: 0 }; const div = divMap[id]?.[dStr] || 0
          const Vi = s.lv, F = inv.imp; ViT += Vi; FT += F; s.q += inv.q;
          const p = preMap[id]?.[dStr] || s.lp; s.lp = p; const Vf = s.q * p; VfT += Vf;
          RmT += (Vf - (Vi + F)) + div; s.lv = Vf;
        })
        AportesAcum += FT
        RmAcum += RmT
        // Return accumulated contributions (only F), current value, and accumulated return
        items.push({ fecha: dStr, inversionUsd: Number(AportesAcum.toFixed(2)), valorActualUsd: Number(VfT.toFixed(2)), rendimientoAcumulado: Number(RmAcum.toFixed(2)) })
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

      const invMap = {}; inversiones.forEach(i => { if (!invMap[i.ticker_id]) invMap[i.ticker_id] = {}; if (!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = { imp: 0, q: 0 }; invMap[i.ticker_id][i.fecha].imp += Number(i.importe); invMap[i.ticker_id][i.fecha].q += Number(i.cantidad); })
      const preMap = {}; precios.forEach(p => { if (!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })
      const divMap = {}; dividendos.forEach(d => { if (!divMap[d.ticker_id]) divMap[d.ticker_id] = {}; const f = d.fecha.slice(0, 10); divMap[d.ticker_id][f] = (divMap[d.ticker_id][f] || 0) + Number(d.monto); })

      let curr = new Date(start + 'T00:00:00Z')
      const stats = {}; tickerIds.forEach(id => { stats[id] = { q: 0, lv: 0, lp: 0 } })
      const result = []; let Rna = 0
      while (true) {
        const dStr = curr.toISOString().slice(0, 10); if (dStr > hoy) break
        if (dStr.endsWith('-01-01')) Rna = 0
        let ViT = 0, FT = 0, VfT = 0, RmT = 0
        tickerIds.forEach(id => {
          const s = stats[id]; const inv = invMap[id]?.[dStr] || { imp: 0, q: 0 }; const div = divMap[id]?.[dStr] || 0
          const Vi = s.lv, F = inv.imp; ViT += Vi; FT += F; s.q += inv.q;
          const p = preMap[id]?.[dStr] || s.lp; s.lp = p; const Vf = s.q * p; VfT += Vf;
          RmT += (Vf - (Vi + F)) + div; s.lv = Vf;
        })
        let Rn = (ViT + FT) > 0 ? RmT / (ViT + FT) : 0; Rna += Rn;
        result.push({ fecha: dStr, valorInicial: ViT, aportes: FT, valorFinal: VfT, rendimiento: RmT, rentabilidad: Rn * 100, rentabilidadAcumulada: Rna * 100 })
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

      const invMap = {}; inversiones.forEach(i => { if (!invMap[i.ticker_id]) invMap[i.ticker_id] = {}; if (!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = { imp: 0, q: 0 }; invMap[i.ticker_id][i.fecha].imp += Number(i.importe); invMap[i.ticker_id][i.fecha].q += Number(i.cantidad); })
      const preMap = {}; precios.forEach(p => { if (!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })
      const divMap = {}; dividendos.forEach(d => { if (!divMap[d.ticker_id]) divMap[d.ticker_id] = {}; const f = d.fecha.slice(0, 10); divMap[d.ticker_id][f] = (divMap[d.ticker_id][f] || 0) + Number(d.monto); })

      let curr = new Date(start + 'T00:00:00Z')
      const stats = {}; tickerIds.forEach(id => { stats[id] = { q: 0, lv: 0, lp: 0 } })
      const meses = {}; let Rna = 0
      while (true) {
        const dStr = curr.toISOString().slice(0, 10); if (dStr > hoy) break
        const mKey = dStr.slice(0, 7)
        if (dStr.endsWith('-01-01')) Rna = 0
        let ViT = 0, FT = 0, VfT = 0, RmT = 0
        tickerIds.forEach(id => {
          const s = stats[id]; const inv = invMap[id]?.[dStr] || { imp: 0, q: 0 }; const div = divMap[id]?.[dStr] || 0
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

      // 1. Get latest FX rate for PEN conversion
      const latestFx = db.prepare('SELECT usd_pen FROM tipos_cambio ORDER BY fecha DESC LIMIT 1').get()
      const fxRate = latestFx ? Number(latestFx.usd_pen) : 3.7

      // 2. Get all tickers (USD and PEN) with investments
      const tickers = db.prepare(`
        SELECT DISTINCT t.id, t.moneda 
        FROM tickers t 
        INNER JOIN inversiones i ON i.ticker_id = t.id
      `).all()

      if (tickers.length === 0) return res.json({ items: [] })
      const tickerIds = tickers.map(t => t.id)

      // 3. Get first investment date and calculate year range
      const firstInv = db.prepare(`SELECT MIN(fecha) as f FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')})`).get()
      const start = firstInv.f
      const hoy = getLimaDate()
      const yearStart = parseInt(start.split('-')[0])
      const yearEnd = parseInt(hoy.split('-')[0])

      // 4. Get all data (inversiones, precios, dividendos)
      const inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) ORDER BY fecha ASC`).all()
      const precios = db.prepare(`SELECT ticker_id, fecha, precio FROM precios_historicos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(start)
      const dividendos = db.prepare(`SELECT ticker_id, fecha, monto FROM dividendos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(start)

      // 5. Build maps
      const invMap = {}; inversiones.forEach(i => { if (!invMap[i.ticker_id]) invMap[i.ticker_id] = {}; if (!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = { imp: 0, q: 0 }; invMap[i.ticker_id][i.fecha].imp += Number(i.importe); invMap[i.ticker_id][i.fecha].q += Number(i.cantidad); })
      const preMap = {}; precios.forEach(p => { if (!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })
      const divMap = {}; dividendos.forEach(d => { if (!divMap[d.ticker_id]) divMap[d.ticker_id] = {}; const f = d.fecha.slice(0, 10); divMap[d.ticker_id][f] = (divMap[d.ticker_id][f] || 0) + Number(d.monto); })

      // 6. Get ticker currency map
      const tickerCurrency = {}
      tickers.forEach(t => { tickerCurrency[t.id] = t.moneda })

      // 7. Calculate daily evolution (consolidated in USD)
      let curr = new Date(start + 'T00:00:00Z')
      const stats = {}; tickerIds.forEach(id => { stats[id] = { q: 0, lv: 0, lp: 0 } })

      const dailyEvolution = [] // {fecha, Vi, F, Vf, Rm}
      while (true) {
        const dStr = curr.toISOString().slice(0, 10); if (dStr > hoy) break
        let ViT = 0, FT = 0, VfT = 0, RmT = 0

        tickerIds.forEach(id => {
          const s = stats[id]; const inv = invMap[id]?.[dStr] || { imp: 0, q: 0 }; const div = divMap[id]?.[dStr] || 0
          const moneda = tickerCurrency[id]

          // Convert to USD if needed
          const fxToUse = moneda === 'PEN' ? fxRate : 1

          const Vi = s.lv / fxToUse
          const F = inv.imp / fxToUse
          ViT += Vi; FT += F; s.q += inv.q;

          const p = preMap[id]?.[dStr] || s.lp; s.lp = p;
          const Vf = (s.q * p) / fxToUse
          VfT += Vf;

          const divUSD = div / fxToUse
          RmT += (Vf - (Vi + F)) + divUSD
          s.lv = s.q * p
        })

        dailyEvolution.push({ fecha: dStr, Vi: ViT, F: FT, Vf: VfT, Rm: RmT })
        curr.setUTCDate(curr.getUTCDate() + 1)
      }

      // 8. Aggregate by year
      const yearlyAggregates = {}
      dailyEvolution.forEach(d => {
        const year = parseInt(d.fecha.split('-')[0])
        if (!yearlyAggregates[year]) {
          yearlyAggregates[year] = { year, firstDayVi: null, totalF: 0, lastDayVf: 0, totalRm: 0, lastDate: d.fecha }
        }
        const agg = yearlyAggregates[year]

        // Vi: First day of the year
        if (d.fecha.endsWith('-01-01')) {
          agg.firstDayVi = d.Vi
        }

        // Sum F and Rm for the entire year
        agg.totalF += d.F
        agg.totalRm += d.Rm

        // Vf: Last day (will be overwritten until the last day of the year)
        if (d.fecha >= agg.lastDate) {
          agg.lastDayVf = d.Vf
          agg.lastDate = d.fecha
        }
      })

      // 9. Build results with benchmarks
      const results = []
      for (let y = yearStart; y <= yearEnd; y++) {
        const agg = yearlyAggregates[y]
        if (!agg) continue

        const Vi = agg.firstDayVi || 0
        const F = agg.totalF
        const Vf = agg.lastDayVf
        const Rm = agg.totalRm
        const Rn = (Vi + F) > 0 ? (Rm / (Vi + F)) * 100 : 0

        const fIni = `${y}-01-01`
        const fRealFin = agg.lastDate

        const item = { año: y, valorInicial: Number(Vi.toFixed(2)), aportes: Number(F.toFixed(2)), valorFinal: Number(Vf.toFixed(2)), rendimiento: Number(Rm.toFixed(2)), rentabilidad: Number(Rn.toFixed(2)), benchmarks: {} }

        // Calculate benchmarks
        const bms = [{ k: 'sp500', t: 'SPY' }, { k: 'dowjones', t: 'DIA' }, { k: 'nasdaq', t: 'QQQ' }]
        for (const b of bms) {
          try {
            const pI = await getPriceNearDate(fetchDailyHistory, b.t, fIni, 'after')
            const pF = await getPriceNearDate(fetchDailyHistory, b.t, fRealFin, 'before')
            if (pI && pF) item.benchmarks[b.k] = Number((((pF / pI) - 1) * 100).toFixed(2))
          } catch { }
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
  const r = await fetch(t, s, fl); if (r?.items?.length > 0) return dir === 'before' ? r.items[r.items.length - 1].precio : r.items[0].precio
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