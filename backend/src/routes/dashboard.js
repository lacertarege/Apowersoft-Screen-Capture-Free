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
      let dividends = []

      if (!currency) {
        // Legacy fallback (should ideally be removed or updated, but keeping simple for now)
        items = db.prepare(`SELECT fecha, inversion_usd as inversionUsd, balance_usd as balanceUsd FROM portfolio_evolucion_diaria WHERE fecha >= ? ORDER BY fecha`).all(from)
      } else {
        const tickers = db.prepare(`SELECT DISTINCT t.id FROM tickers t INNER JOIN inversiones i ON i.ticker_id = t.id WHERE t.moneda = ?`).all(currency)
        if (tickers.length > 0) {
          const tickerIds = tickers.map(t => t.id)
          const hoy = getLimaDate()

          // 1. Fetch Investments (including origen_capital to filter reinvestments)
          const inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad, origen_capital, tipo_operacion FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) ORDER BY fecha ASC`).all()

          // 2. Fetch Prices
          const precios = db.prepare(`SELECT ticker_id, fecha, precio FROM precios_historicos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(from)

          // 3. Fetch Dividends
          const dividendosRaw = db.prepare(`SELECT fecha, monto FROM dividendos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(from)

          // Process Dividends
          const divMap = {}
          dividendosRaw.forEach(d => {
            const f = d.fecha.slice(0, 10)
            divMap[f] = (divMap[f] || 0) + Number(d.monto)
          })
          dividends = Object.entries(divMap).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date))

          // Process Investments and Prices
          const invMap = {};
          inversiones.forEach(i => {
            if (!invMap[i.ticker_id]) invMap[i.ticker_id] = {};
            if (!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = { imp: 0, q: 0 };

            const isReinvestment = i.origen_capital === 'REINVERSION'
            const isDesinversion = i.tipo_operacion === 'DESINVERSION'

            // Logic:
            // Quantity always changes
            if (isDesinversion) {
              invMap[i.ticker_id][i.fecha].q -= Number(i.cantidad);
              invMap[i.ticker_id][i.fecha].imp -= Number(i.importe); // Withdrawals reduce capital
            } else {
              invMap[i.ticker_id][i.fecha].q += Number(i.cantidad);
              // Capital only increases if NOT reinvestment
              if (!isReinvestment) {
                invMap[i.ticker_id][i.fecha].imp += Number(i.importe);
              }
            }
          })

          const preMap = {}; precios.forEach(p => { if (!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })

          let curr = new Date(from + 'T00:00:00Z')
          const stats = {}; tickerIds.forEach(id => {
            // Need to calculate initial state correctly considering reinvestments?
            // Complex to do in SQL in one line. 
            // Better to iterate all investments from start to calculate initial state.
            const allInv = inversiones.filter(inv => inv.ticker_id === id && inv.fecha < from)
            let initImp = 0
            let initQ = 0
            allInv.forEach(inv => {
              const amt = Number(inv.importe)
              const qty = Number(inv.cantidad)
              const isReinv = inv.origen_capital === 'REINVERSION'
              const isDes = inv.tipo_operacion === 'DESINVERSION'

              if (isDes) {
                initQ -= qty
                initImp -= amt
              } else {
                initQ += qty
                if (!isReinv) initImp += amt
              }
            })

            const lp = db.prepare('SELECT precio FROM precios_historicos WHERE ticker_id=? AND fecha < ? ORDER BY fecha DESC LIMIT 1').get(id, from)
            stats[id] = { q: initQ, imp: initImp, lp: Number(lp?.precio || 0) }
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
      res.json({ items, dividends })
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
        inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad, origen_capital, tipo_operacion FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(minStartDates[currency])
      } else {
        inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad, origen_capital, tipo_operacion FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) ORDER BY fecha ASC`).all()
      }

      const precios = db.prepare(`SELECT ticker_id, fecha, precio FROM precios_historicos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(from)
      const dividendos = db.prepare(`SELECT ticker_id, fecha, monto FROM dividendos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(from)

      const invMap = {}; inversiones.forEach(i => {
        if (!invMap[i.ticker_id]) invMap[i.ticker_id] = {}; if (!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = { imp: 0, q: 0, netInv: 0 };
        invMap[i.ticker_id][i.fecha].imp += Number(i.importe);
        invMap[i.ticker_id][i.fecha].q += Number(i.cantidad);

        // Calculate Net External Investment (Exclude Reinvestments)
        const isReinvestment = i.origen_capital === 'REINVERSION'
        const isDesinversion = i.tipo_operacion === 'DESINVERSION'
        const amount = Number(i.importe)

        if (isDesinversion) {
          invMap[i.ticker_id][i.fecha].netInv -= amount;
        } else if (!isReinvestment) {
          // Fresh Capital
          invMap[i.ticker_id][i.fecha].netInv += amount;
        }
      })
      const preMap = {}; precios.forEach(p => { if (!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })
      const divMap = {};
      const dividendsRaw = [];

      dividendos.forEach(d => {
        if (!divMap[d.ticker_id]) divMap[d.ticker_id] = {};
        const f = d.fecha.slice(0, 10);
        divMap[d.ticker_id][f] = (divMap[d.ticker_id][f] || 0) + Number(d.monto);
        dividendsRaw.push({ date: f, amount: Number(d.monto) })
      })

      // Aggregate dividends by date for the chart markers
      const dividends = Object.entries(dividendsRaw.reduce((acc, curr) => {
        acc[curr.date] = (acc[curr.date] || 0) + curr.amount;
        return acc;
      }, {})).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));


      let curr = new Date(from + 'T00:00:00Z')
      const stats = {};

      // Initialize stats - for currency-specific minimum dates, start from zero
      const shouldStartFromZero = range === 'all' && minStartDates[currency]

      // We need accurate initial Net Investment if not starting from zero.
      // SQL Init Calculation:
      /*
         If not zero, calculate Init Net Inv from historic data.
      */

      tickerIds.forEach(id => {
        if (shouldStartFromZero) {
          stats[id] = { q: 0, lv: 0, lp: 0, netInvAcum: 0 }
        } else {
          // Load previous state
          const allInv = inversiones.filter(inv => inv.ticker_id === id && inv.fecha < from) // Since we fetched only >= minStart if applicable, this might be empty if loop logic holds.
          // Wait, line 198 fetches >= minStart. Line 200 fetches All.
          // If range is 'all' and minStart exists, we only fetched relevant investments.
          // But 'from' is derived from minStart.
          // So 'stats' init should be 0 if we assume the chart starts at minStart.
          // BUT, calculating correct Balance requires previous Quantity.
          // Re-fetching strictly previous data if we are clipping?
          // If minStart is used, we treat it as the "Beginning of History" for the chart.
          // So Init Q = 0 is correct relative to the Chart View.
          // But Profitability? Profitability is relative to the Investment made IN THAT PERIOD?
          // No, usually Profitability is Total.
          // For simplicity and consistency with previous logic, if we clip via minStart, we reset stats.

          if (!shouldStartFromZero) {
            // Standard range logic (1m, 1y, etc) - NEED initial state
            // Fetch prior investments from DB (since not in 'inversiones' array if filtered? No, line 200 fetches ALL).
            // Ah, line 200 fetches ALL. Line 198 fetches filtered. 
            // Logic check:
            // If range != 'all', line 200 executes. `inversiones` has ALL.
            // We can proceed to calc init from `inversiones`.

            // What if we fetched ALL `inversiones` but `from` is later?
            // Then we filter `inversiones` array.

            const priorInv = db.prepare('SELECT importe, cantidad, origen_capital, tipo_operacion FROM inversiones WHERE ticker_id = ? AND fecha < ?').all(id, from)
            let initQ = 0, initNetInv = 0
            priorInv.forEach(pi => {
              const amt = Number(pi.importe)
              const q = Number(pi.cantidad)
              if (pi.tipo_operacion === 'DESINVERSION') {
                initQ -= q
                initNetInv -= amt
              } else {
                initQ += q
                if (pi.origen_capital !== 'REINVERSION') initNetInv += amt
              }
            })

            const lp = db.prepare('SELECT precio FROM precios_historicos WHERE ticker_id=? AND fecha < ? ORDER BY fecha DESC LIMIT 1').get(id, from)
            const lastPrice = Number(lp?.precio || 0)
            stats[id] = { q: initQ, lv: initQ * lastPrice, lp: lastPrice, netInvAcum: initNetInv }
          } else {
            stats[id] = { q: 0, lv: 0, lp: 0, netInvAcum: 0 }
          }
        }
      })

      const items = [];

      // Re-implementing loop for clarity
      let accumulatedDividends = 0

      // Reset curr to start
      curr = new Date(from + 'T00:00:00Z')

      while (true) {
        const dStr = curr.toISOString().slice(0, 10); if (dStr > hoy) break

        let dailyVal = 0
        let dailyNetInv = 0

        const dayDivs = dividendos.filter(d => d.fecha.startsWith(dStr)).reduce((sum, d) => sum + Number(d.monto), 0)
        accumulatedDividends += dayDivs

        tickerIds.forEach(id => {
          const s = stats[id]
          const inv = invMap[id]?.[dStr]

          if (inv) {
            s.q += inv.q
            s.netInvAcum += inv.netInv
          }

          const p = preMap[id]?.[dStr] || s.lp
          s.lp = p

          dailyVal += (s.q * p)
          dailyNetInv += s.netInvAcum
        })

        const profit = (dailyVal + accumulatedDividends) - dailyNetInv

        items.push({
          fecha: dStr,
          inversionUsd: Number(dailyNetInv.toFixed(2)),
          valorActualUsd: Number(dailyVal.toFixed(2)),
          rendimientoAcumulado: Number(profit.toFixed(2))
        })

        curr.setUTCDate(curr.getUTCDate() + 1)
      }

      res.json({ items, dividends })
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

      // 1. Get all FX history for PEN conversion
      const fxHistory = db.prepare('SELECT fecha, usd_pen FROM tipos_cambio ORDER BY fecha ASC').all()
      // Create a map or sorted array for fast lookup. Since it's daily, map by date is good.
      const fxMap = {}
      let lastFx = 3.7 // Fallback default
      fxHistory.forEach(x => { fxMap[x.fecha] = x.usd_pen })

      // Helper to get FX for a date (using last known if missing)
      // Since we iterate daily, we can just update a 'currentFx' variable.

      // 2. Get all tickers (USD and PEN) with investments
      const tickers = db.prepare(`
        SELECT DISTINCT t.id, t.moneda 
        FROM tickers t 
        INNER JOIN inversiones i ON i.ticker_id = t.id
      `).all()

      if (tickers.length === 0) return res.json({ items: [] })
      const tickerIds = tickers.map(t => t.id)

      // 3. Get first investment date
      const firstInv = db.prepare(`SELECT MIN(fecha) as f FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')})`).get()
      const start = firstInv.f
      const hoy = getLimaDate()
      const yearStart = parseInt(start.split('-')[0])
      const yearEnd = parseInt(hoy.split('-')[0])

      // 4. Get all data (inversiones with type, precios, dividendos)
      // IMPORTANT: tipo_operacion is needed to distinguish Inversion vs Desinversion
      // Assuming 'tipo_operacion' column exists (INVERSION, DESINVERSION, REINVERSION, etc)
      // If not, we might need to rely on negative amounts? Standard is usually positive amounts with type.
      // Let's assume standard 'INVERSION', 'DESINVERSION'.
      const inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad, tipo_operacion FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) ORDER BY fecha ASC`).all()
      const precios = db.prepare(`SELECT ticker_id, fecha, precio FROM precios_historicos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(start)
      const dividendos = db.prepare(`SELECT ticker_id, fecha, monto FROM dividendos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(start)

      // 5. Build maps
      // invMap: { tickerId: { date: { netImp: 0, netQ: 0, inflows: 0, outflows: 0 } } }
      const invMap = {};
      inversiones.forEach(i => {
        if (!invMap[i.ticker_id]) invMap[i.ticker_id] = {};
        if (!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = { netImp: 0, netQ: 0, inflows: 0, outflows: 0 };

        let signedImp = Number(i.importe);
        // Desinversion: Cash OUT. Typically recorded as positive amount in DB? Or negative?
        // Let's check user summary: "Aportes Externos - Retiros".
        // If type is DESINVERSION, it's a withdrawal.
        // Logic: 
        //   INVERSION: F + (Amount)
        //   DESINVERSION: F - (Amount)
        //   REINVERSION (Internal): Should be Net 0? Or excluded from "Aportes"? 
        //   User said: "Reinversión... efecto neutro (S/ 0.00) en la columna de Aportes".
        //   If we simply ignore Reinversion for F, but track Quantity change?
        //   Actually, Reinversion usually involves Sell One -> Buy Other.
        //   Sell A: Cash In (Desinversion in A).
        //   Buy B: Cash Out (Inversion in B).
        //   Net effect on Portfolio F: -Sale + Purchase ~ 0 (if same day).
        //   So we just sum them up. Desinversion is negative Flow, Inversion is positive Flow.

        const type = (i.tipo_operacion || 'INVERSION').toUpperCase();

        if (type === 'DESINVERSION' || type === 'VENTA') {
          // It's a withdrawal of capital from that Asset.
          // Flow is negative.
          // Amount in DB usually positive for the transaction size.
          invMap[i.ticker_id][i.fecha].outflows += signedImp; // Track positive magnitude
          invMap[i.ticker_id][i.fecha].netImp -= signedImp;
          invMap[i.ticker_id][i.fecha].netQ -= Number(i.cantidad); // Decrease qty
        } else {
          // COMPRA / INVERSION
          invMap[i.ticker_id][i.fecha].inflows += signedImp;
          invMap[i.ticker_id][i.fecha].netImp += signedImp;
          invMap[i.ticker_id][i.fecha].netQ += Number(i.cantidad); // Increase qty
        }
      })

      const preMap = {}; precios.forEach(p => { if (!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })
      const divMap = {}; dividendos.forEach(d => { if (!divMap[d.ticker_id]) divMap[d.ticker_id] = {}; const f = d.fecha.slice(0, 10); divMap[d.ticker_id][f] = (divMap[d.ticker_id][f] || 0) + Number(d.monto); })

      // 6. Get ticker currency map
      const tickerCurrency = {}
      tickers.forEach(t => { tickerCurrency[t.id] = t.moneda })

      // 7. Calculate daily evolution
      let curr = new Date(start + 'T00:00:00Z')
      const stats = {}; tickerIds.forEach(id => { stats[id] = { q: 0, lv: 0, lp: 0 } }) // lv = Last Value (Local Currency)

      // Use a running FX rate that updates daily
      let currentFx = lastFx // Init with fallback
      // Try to find FX for start date
      if (fxMap[start]) currentFx = fxMap[start]

      const dailyEvolution = []

      while (true) {
        const dStr = curr.toISOString().slice(0, 10); if (dStr > hoy) break

        // Update FX if available for this day
        if (fxMap[dStr]) currentFx = fxMap[dStr]

        let ViT = 0, FT = 0, VfT = 0, RmT = 0
        let InflowsT = 0, OutflowsT = 0
        let OrganicRmT = 0 // In USD
        let DividendsT = 0 // In USD

        tickerIds.forEach(id => {
          const s = stats[id];
          const inv = invMap[id]?.[dStr] || { netImp: 0, netQ: 0, inflows: 0, outflows: 0 };
          const div = divMap[id]?.[dStr] || 0 // This is div in LC
          const moneda = tickerCurrency[id]
          const fxToUse = moneda === 'PEN' ? currentFx : 1

          // Logic in Local Currency (LC)
          // Vi_LC = Previous Value (s.lv)
          // F_LC = inv.netImp
          // Qty change
          s.q += inv.netQ

          // Get Price
          const p = preMap[id]?.[dStr] || s.lp; s.lp = p;

          // Vf_LC = Current Qty * Price
          const Vf_LC = s.q * p

          // Rm_LC = Vf_LC - (Vi_LC + F_LC) + Div_LC
          const Rm_LC = (Vf_LC - (s.lv + inv.netImp)) + div

          // --- CONVERSION TO USD ---
          // We convert the FLOWS and VALUES at the daily rate.

          const Vi_USD = s.lv / fxToUse
          const F_USD = inv.netImp / fxToUse
          const Vf_USD = Vf_LC / fxToUse
          const Div_USD = div / fxToUse // This is the dividend in USD for this ticker

          // Total Return in USD for this day
          // Rm_USD = Vf_USD - (Vi_USD + F_USD) + Div_USD
          const Rm_USD = (Vf_USD - (Vi_USD + F_USD)) + Div_USD

          // Organic Return (Return due to price change, excluding FX effect)
          // Organic Rm USD = Rm_LC / fxToUse
          const Rm_Organic_USD = Rm_LC / fxToUse

          // Accumulate
          ViT += Vi_USD
          FT += F_USD
          VfT += Vf_USD
          RmT += Rm_USD // Total Return (inc FX)
          OrganicRmT += Rm_Organic_USD
          DividendsT += Div_USD // Accumulate dividends in USD

          InflowsT += (inv.inflows / fxToUse)
          OutflowsT += (inv.outflows / fxToUse)

          // Update State
          s.lv = Vf_LC
        })

        dailyEvolution.push({
          fecha: dStr,
          Vi: ViT,
          F: FT,
          Vf: VfT,
          Rm: RmT,
          RmOrganic: OrganicRmT,
          Dividends: DividendsT, // Track daily dividends in USD
          Inflows: InflowsT,
          Outflows: OutflowsT
        })

        curr.setUTCDate(curr.getUTCDate() + 1)
      }

      // 8. Aggregate by year
      const yearlyAggregates = {}
      dailyEvolution.forEach(d => {
        const year = parseInt(d.fecha.split('-')[0])
        if (!yearlyAggregates[year]) {
          yearlyAggregates[year] = {
            year,
            firstDayVi: null,
            totalF: 0,
            totalInflows: 0,
            totalOutflows: 0,
            totalDividends: 0,
            lastDayVf: 0,
            totalRm: 0,
            totalRmOrganic: 0,
            lastDate: d.fecha,
            // Drawdown stats
            peakValue: 0,
            maxDrawdown: 0
          }
        }
        const agg = yearlyAggregates[year]

        // Vi: First day of the year Vi
        if (d.fecha.endsWith('-01-01')) {
          agg.firstDayVi = d.Vi
        }
        // If it's the very first day of data and not Jan 1st, set Vi
        if (agg.firstDayVi === null && d.fecha === start) {
          agg.firstDayVi = 0 // Start from 0 if it's the genesis
        }

        // Sum Flows and Returns
        agg.totalF += d.F
        agg.totalInflows += d.Inflows
        agg.totalOutflows += d.Outflows
        agg.totalDividends += d.Dividends
        agg.totalRm += d.Rm
        agg.totalRmOrganic += d.RmOrganic

        // Calculate Drawdown (Daily)
        // Peak is max(Vf) seen so far THIS year
        if (d.Vf > agg.peakValue) {
          agg.peakValue = d.Vf
        }

        // Drawdown relative to Peak
        if (agg.peakValue > 0) {
          const dd = (d.Vf - agg.peakValue) / agg.peakValue
          if (dd < agg.maxDrawdown) {
            agg.maxDrawdown = dd
          }
        }

        // Vf: Snapshot of Last Day
        if (d.fecha >= agg.lastDate) {
          agg.lastDayVf = d.Vf
          agg.lastDate = d.fecha
        }
      })

      // 9. Build results with benchmarks
      const results = []

      // We want to link years: Vi(Year) should equate Vf(Year-1).
      // However, our loop calculates Vi daily based on previous day's Vf.
      // So Sum(Vi_daily) is not what we want. We want Snapshot Vi at Jan 1.

      // FIX For First Day Vi logic in aggregation loop above:
      // If d.fecha is 'YYYY-01-01', then d.Vi IS the Vi for the Year.
      // But if the loop starts mid-year (e.g. 2023-05), the first record's Vi is 0 (or pre-seed).

      let previousYearVf = 0

      for (let y = yearStart; y <= yearEnd; y++) {
        const agg = yearlyAggregates[y]
        if (!agg) continue

        // Logic check: Vi of Year should be Vf of Year-1
        let Vi = agg.firstDayVi
        if (Vi === null || Vi === undefined) {
          // Case where year didn't start at Jan 1 loop hit?
          // Actually, daily loop runs continuously. Jan 1 is guaranteed if start < Year.
          // If start is in this year, Vi is 0.
          Vi = previousYearVf
        }

        // Actually, let's strictly force Vi = Previous Year Vf to avoid gap from Jan 1 Daily Logic nuances
        if (y > yearStart) {
          Vi = previousYearVf
        } else {
          // First year
          Vi = 0
        }

        const F = agg.totalF
        const Vf = agg.lastDayVf
        const Rm = agg.totalRm

        // Recalculate Rm to ensure integrity: Vf = Vi + F + Rm
        // Theoretical Rm = Vf - (Vi + F)
        // Our Aggregated totalRm should match this approx, but due to floating point and daily compounding logic...
        // Actually, since we sum daily Rm: Sum(Rm_d) = Sum(Vf_d - Vi_d - F_d)
        // And Vi_d = Vf_(d-1). Telescoping series.
        // Sum(Rm) = Vf_last - Vi_first - Sum(F).
        // So they should match perfectly.
        // Let's use the calculated Rm from loop for granular accuracy (Organic Breakdown), 
        // but maybe adjust 'Rm' total to balance the equation exactly for UI?
        const calibratedRm = Vf - (Vi + F)

        // Proportional adjustment for sub-components if needed
        const diff = calibratedRm - Rm
        const RmOrganic = agg.totalRmOrganic + (diff * (agg.totalRmOrganic / (agg.totalRm || 1)))
        const FXImpact = calibratedRm - RmOrganic

        const Rn = (Vi + F) > 0 ? (calibratedRm / (Vi + F)) * 100 : 0

        const fIni = `${y}-01-01`
        const fRealFin = agg.lastDate

        const item = {
          año: y,
          valorInicial: Number(Vi.toFixed(2)),
          aportes: Number(F.toFixed(2)),
          inflows: Number(agg.totalInflows.toFixed(2)),
          outflows: Number(agg.totalOutflows.toFixed(2)),
          dividendos: Number(agg.totalDividends.toFixed(2)),
          valorFinal: Number(Vf.toFixed(2)),
          rendimiento: Number(calibratedRm.toFixed(2)),
          rendimientoOrganico: Number(RmOrganic.toFixed(2)),
          efectoFx: Number(FXImpact.toFixed(2)),
          rentabilidad: Number(Rn.toFixed(2)),
          maxDrawdown: Number((agg.maxDrawdown * 100).toFixed(2)), // New field
          benchmarks: {}
        }

        // Calculate benchmarks using cache (OPTIMIZED)
        try {
          item.benchmarks = await getBenchmarksForYear(db, fetchDailyHistory, y, fIni, fRealFin)
        } catch (error) {
          console.error(`Error fetching benchmarks for year ${y}:`, error)
        }

        results.push(item)

        previousYearVf = Vf
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

/**
 * Get cached benchmark return or fetch and cache if not exists
 * @param {Database} db - SQLite database instance
 * @param {Function} fetchDailyHistory - Function to fetch price history
 * @param {string} ticker - Benchmark ticker (e.g., 'SPY', 'EPU')
 * @param {number} year - Year for the benchmark
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<number|null>} - Return percentage or null if not available
 */
async function getCachedBenchmark(db, fetchDailyHistory, ticker, year, startDate, endDate) {
  try {
    // Check cache first (with 24h TTL)
    const cached = db.prepare(`
      SELECT return_pct, cached_at 
      FROM benchmark_cache 
      WHERE ticker = ? AND year = ?
    `).get(ticker, year)

    if (cached) {
      const cachedAt = new Date(cached.cached_at)
      const now = new Date()
      const ageHours = (now - cachedAt) / (1000 * 60 * 60)

      // If cache is less than 24h old, return cached value
      if (ageHours < 24) {
        return cached.return_pct
      }
    }

    // Cache miss or expired - fetch from API
    const pI = await getPriceNearDate(fetchDailyHistory, ticker, startDate, 'after')
    const pF = await getPriceNearDate(fetchDailyHistory, ticker, endDate, 'before')

    if (!pI || !pF) return null

    const returnPct = Number((((pF / pI) - 1) * 100).toFixed(2))

    // Upsert cache
    db.prepare(`
      INSERT INTO benchmark_cache (ticker, year, start_date, end_date, return_pct, cached_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(ticker, year) DO UPDATE SET
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        return_pct = excluded.return_pct,
        cached_at = excluded.cached_at
    `).run(ticker, year, startDate, endDate, returnPct)

    return returnPct

  } catch (error) {
    console.error(`Error fetching benchmark ${ticker} for year ${year}:`, error)
    return null
  }
}

/**
 * Get all benchmarks for a year using cache
 * @param {Database} db - SQLite database instance
 * @param {Function} fetchDailyHistory - Function to fetch price history
 * @param {number} year - Year for benchmarks
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Object with benchmark keys and return percentages
 */
async function getBenchmarksForYear(db, fetchDailyHistory, year, startDate, endDate) {
  const benchmarks = {}
  const bms = [
    { k: 'sp500', t: 'SPY' },
    { k: 'sp_bvl_gen', t: 'EPU' }
  ]

  // Fetch all benchmarks in parallel
  const results = await Promise.all(
    bms.map(async (b) => {
      const returnPct = await getCachedBenchmark(db, fetchDailyHistory, b.t, year, startDate, endDate)
      return { key: b.k, value: returnPct }
    })
  )

  // Build result object
  results.forEach(r => {
    if (r.value !== null) {
      benchmarks[r.key] = r.value
    }
  })

  return benchmarks
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