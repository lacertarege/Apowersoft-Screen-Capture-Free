import express from 'express'
import { getLimaDate, getLimaYear } from '../utils/date.js'
import {
  getPriceNearDate,
  getCachedBenchmark,
  getBenchmarksForYear,
  calculateBalanceAtDate
} from '../services/BenchmarkService.js'

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

          // Process Investments - Build a map of daily changes
          const invMap = {};
          inversiones.forEach(i => {
            if (!invMap[i.ticker_id]) invMap[i.ticker_id] = {};
            if (!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = { amt: 0, q: 0, ops: [] };

            const isDesinversion = i.tipo_operacion === 'DESINVERSION'
            const amount = Number(i.importe)
            const qty = Number(i.cantidad)

            // Store operations for CPP calculation
            invMap[i.ticker_id][i.fecha].ops.push({
              tipo: i.tipo_operacion,
              amount,
              qty
            })
          })

          const preMap = {}; precios.forEach(p => { if (!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })

          let curr = new Date(from + 'T00:00:00Z')

          // Initialize stats with CPP calculation for transactions BEFORE 'from'
          const stats = {};
          tickerIds.forEach(id => {
            // Get all investments before 'from' to calculate initial state
            const allInv = inversiones.filter(inv => inv.ticker_id === id && inv.fecha < from)
            let qty = 0
            let cpp = 0

            // Apply CPP rules
            allInv.forEach(inv => {
              const amt = Number(inv.importe)
              const q = Number(inv.cantidad)

              if (inv.tipo_operacion === 'DESINVERSION') {
                qty -= q
                if (qty < 0.01) { qty = 0; cpp = 0; }
              } else {
                // INVERSION - update CPP
                const prevCost = qty * cpp
                qty += q
                if (qty > 0) {
                  cpp = (prevCost + amt) / qty
                }
              }
            })

            const lp = db.prepare('SELECT precio FROM precios_historicos WHERE ticker_id=? AND fecha < ? ORDER BY fecha DESC LIMIT 1').get(id, from)
            stats[id] = { q: qty, cpp: cpp, lp: Number(lp?.precio || 0) }
          })

          while (true) {
            const dStr = curr.toISOString().slice(0, 10); if (dStr > hoy) break
            let invDia = 0, balDia = 0

            tickerIds.forEach(id => {
              const s = stats[id]
              const dayOps = invMap[id]?.[dStr]?.ops || []

              // Apply day's operations using CPP rules
              dayOps.forEach(op => {
                if (op.tipo === 'DESINVERSION') {
                  s.q -= op.qty
                  if (s.q < 0.01) { s.q = 0; s.cpp = 0; }
                } else {
                  // INVERSION - update CPP (includes reinvestments now!)
                  const prevCost = s.q * s.cpp
                  s.q += op.qty
                  if (s.q > 0) {
                    s.cpp = (prevCost + op.amount) / s.q
                  }
                }
              })

              const p = preMap[id]?.[dStr] || s.lp; s.lp = p;

              // Capital Invertido = Qty * CPP (same as Empresas!)
              invDia += (s.q * s.cpp)
              balDia += (s.q * p)
            })

            items.push({ fecha: dStr, inversionUsd: Number(invDia.toFixed(2)), balanceUsd: Number(balDia.toFixed(2)) })
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
      SELECT 
        COALESCE(p.nombre, i.plataforma, 'Otros') as plataforma, 
        SUM(
          CASE 
            WHEN i.tipo_operacion = 'INVERSION' THEN i.importe
            WHEN i.tipo_operacion = 'DESINVERSION' THEN -(i.importe - COALESCE(i.realized_return, 0))
            ELSE 0 
          END
        ) as inversion_usd, 
        SUM(
          (CASE 
            WHEN i.tipo_operacion = 'INVERSION' THEN i.cantidad
            WHEN i.tipo_operacion = 'DESINVERSION' THEN -i.cantidad
            ELSE 0 
          END) * COALESCE((SELECT precio FROM precios_historicos WHERE ticker_id = t.id ORDER BY fecha DESC LIMIT 1), 0)
        ) as valor_actual_usd
      FROM inversiones i 
      JOIN tickers t ON t.id = i.ticker_id
      LEFT JOIN plataformas p ON i.plataforma_id = p.id
      WHERE t.moneda = ?
      GROUP BY COALESCE(p.nombre, i.plataforma, 'Otros')
      HAVING inversion_usd > 1 OR valor_actual_usd > 1
      ORDER BY inversion_usd DESC
    `).all(currency)
    res.json({ items: data })
  })

  // 4. /by-type
  r.get('/by-type', (req, res) => {
    const { currency = 'USD' } = req.query
    const data = db.prepare(`
      SELECT 
        ti.nombre as tipo_inversion, 
        SUM(
          CASE 
            WHEN i.tipo_operacion = 'INVERSION' THEN i.importe
            WHEN i.tipo_operacion = 'DESINVERSION' THEN -(i.importe - COALESCE(i.realized_return, 0))
            ELSE 0 
          END
        ) as inversion_usd, 
        SUM(
          (CASE 
            WHEN i.tipo_operacion = 'INVERSION' THEN i.cantidad
            WHEN i.tipo_operacion = 'DESINVERSION' THEN -i.cantidad
            ELSE 0 
          END) * COALESCE((SELECT precio FROM precios_historicos WHERE ticker_id = t.id ORDER BY fecha DESC LIMIT 1), 0)
        ) as valor_actual_usd
      FROM inversiones i 
      JOIN tickers t ON t.id = i.ticker_id 
      JOIN tipos_inversion ti ON ti.id = t.tipo_inversion_id
      WHERE t.moneda = ?
      GROUP BY ti.nombre 
      HAVING inversion_usd > 1 OR valor_actual_usd > 1
      ORDER BY inversion_usd DESC
    `).all(currency)
    res.json({ items: data })
  })

  // 4a. /by-exchange
  r.get('/by-exchange', (req, res) => {
    const { currency = 'USD' } = req.query
    const data = db.prepare(`
      SELECT 
        CASE 
          WHEN LOWER(t.pais) IN ('peru', 'perú', 'pe') THEN 'Empresas Peruanas'
          ELSE 'Empresas Extranjeras'
        END as exchange, 
        SUM(
          CASE 
            WHEN i.tipo_operacion = 'INVERSION' THEN i.importe
            WHEN i.tipo_operacion = 'DESINVERSION' THEN -(i.importe - COALESCE(i.realized_return, 0))
            ELSE 0 
          END
        ) as inversion_usd, 
        SUM(
          (CASE 
            WHEN i.tipo_operacion = 'INVERSION' THEN i.cantidad
            WHEN i.tipo_operacion = 'DESINVERSION' THEN -i.cantidad
            ELSE 0 
          END) * COALESCE((SELECT precio FROM precios_historicos WHERE ticker_id = t.id ORDER BY fecha DESC LIMIT 1), 0)
        ) as valor_actual_usd
      FROM inversiones i 
      JOIN tickers t ON t.id = i.ticker_id
      LEFT JOIN exchanges e ON i.exchange_id = e.id
      WHERE t.moneda = ?
      GROUP BY 1
      HAVING inversion_usd > 1 OR valor_actual_usd > 1
      ORDER BY inversion_usd DESC
    `).all(currency)
    res.json({ items: data })
  })

  // 4b. /by-sector
  r.get('/by-sector', (req, res) => {
    const { currency = 'USD' } = req.query
    const data = db.prepare(`
      SELECT 
        COALESCE(s.nombre, 'Otros') as sector, 
        SUM(
          CASE 
            WHEN i.tipo_operacion = 'INVERSION' THEN i.importe
            WHEN i.tipo_operacion = 'DESINVERSION' THEN -(i.importe - COALESCE(i.realized_return, 0))
            ELSE 0 
          END
        ) as inversion_usd, 
        SUM(
          (CASE 
            WHEN i.tipo_operacion = 'INVERSION' THEN i.cantidad
            WHEN i.tipo_operacion = 'DESINVERSION' THEN -i.cantidad
            ELSE 0 
          END) * COALESCE((SELECT precio FROM precios_historicos WHERE ticker_id = t.id ORDER BY fecha DESC LIMIT 1), 0)
        ) as valor_actual_usd
      FROM inversiones i 
      JOIN tickers t ON t.id = i.ticker_id
      LEFT JOIN sectores s ON t.sector_id = s.id
      WHERE t.moneda = ?
      GROUP BY 1
      HAVING inversion_usd > 1 OR valor_actual_usd > 1
      ORDER BY valor_actual_usd DESC
    `).all(currency)
    res.json({ items: data })
  })

  // 4c. /portfolio-heatmap (Treemap)
  r.get('/portfolio-heatmap', (req, res) => {
    try {
      // 1. Get latest FX
      const fx = db.prepare('SELECT usd_pen FROM tipos_cambio ORDER BY fecha DESC LIMIT 1').get()
      const usdPen = fx ? fx.usd_pen : 3.75

      // 2. Get all active positions with Sector and Ticker info
      const positions = db.prepare(`
        SELECT 
          t.ticker,
          t.moneda,
          COALESCE(s.nombre, 'Otros') as sector,
          SUM(CASE WHEN i.tipo_operacion = 'INVERSION' THEN i.cantidad WHEN i.tipo_operacion = 'DESINVERSION' THEN -i.cantidad ELSE 0 END) as qty,
          SUM(CASE WHEN i.tipo_operacion = 'INVERSION' THEN i.importe WHEN i.tipo_operacion = 'DESINVERSION' THEN -(i.importe - COALESCE(i.realized_return, 0)) ELSE 0 END) as invested_capital
        FROM inversiones i
        JOIN tickers t ON t.id = i.ticker_id
        LEFT JOIN sectores s ON t.sector_id = s.id
        GROUP BY t.id
        HAVING qty > 0.0001
      `).all()

      // 3. Enrich with current price and Calculate USD values
      const items = positions.map(p => {
        // Fetch latest price
        const priceRow = db.prepare('SELECT precio FROM precios_historicos WHERE ticker_id = (SELECT id FROM tickers WHERE ticker = ?) ORDER BY fecha DESC LIMIT 1').get(p.ticker)
        const price = priceRow ? priceRow.precio : 0

        // Determine FX rate for this ticker
        const rate = p.moneda === 'PEN' ? usdPen : 1

        // Convert to USD
        // Market Value USD = Qty * Price / Rate (if PEN, price is in PEN, so divide by Rate? No. 
        // If Moneda is PEN, Price is in PEN. To get USD, we divide by USD/PEN rate.
        // Wait, standard convention: USD/PEN = 3.75 (1 USD = 3.75 PEN).
        // So 100 PEN = 100 / 3.75 USD. Correct.

        const marketValueUsd = (p.qty * price) / rate
        const investedCapitalUsd = p.invested_capital / rate

        const gainUsd = marketValueUsd - investedCapitalUsd
        const gainPercent = investedCapitalUsd !== 0 ? (gainUsd / investedCapitalUsd) * 100 : 0

        return {
          ticker: p.ticker,
          sector: p.sector,
          value: marketValueUsd,
          performance: gainPercent,
          price: price,
          change: 0 // Optional: Daily change if needed, but we use Total Return
        }
      })

      // 4. Group by Sector
      const tree = {}
      items.forEach(item => {
        if (!tree[item.sector]) {
          tree[item.sector] = { name: item.sector, value: 0, children: [] }
        }
        tree[item.sector].value += item.value
        tree[item.sector].children.push({
          name: item.ticker,
          value: item.value,
          performance: item.performance,
          price: item.price
        })
      })

      // Convert map to array and sort
      const result = Object.values(tree).sort((a, b) => b.value - a.value).map(sector => {
        sector.children.sort((a, b) => b.value - a.value)
        return sector
      })

      res.json(result)

    } catch (e) {
      console.error(e)
      res.status(500).json({ error: e.message })
    }
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

      // Apply minimum start date for the currency when range is 'all'
      if (range === 'all' && minStartDates[currency]) {
        from = minStartDates[currency];
      }

      const tickers = db.prepare(`SELECT DISTINCT t.id FROM tickers t INNER JOIN inversiones i ON i.ticker_id = t.id WHERE t.moneda = ?`).all(currency)
      if (tickers.length === 0) return res.json({ items: [] })
      const tickerIds = tickers.map(t => t.id)
      const hoy = getLimaDate()

      // Get TOTAL dividends for this currency (same as Empresas PortfolioSummary)
      const totalDividendsResult = db.prepare(`SELECT COALESCE(SUM(monto), 0) as total FROM dividendos WHERE ticker_id IN (${tickerIds.join(',')})`).get()
      const totalDividends = Number(totalDividendsResult?.total || 0)

      // Get TOTAL realized gains for this currency (same as InvestmentService.calculatePositionStats)
      const totalRealizedResult = db.prepare(`SELECT COALESCE(SUM(realized_return), 0) as total FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) AND tipo_operacion = 'DESINVERSION'`).get()
      const totalRealizedGains = Number(totalRealizedResult?.total || 0)

      // Fetch ALL investments (need full history for CPP calculation)
      const inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad, tipo_operacion FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) ORDER BY fecha ASC, id ASC`).all()

      const precios = db.prepare(`SELECT ticker_id, fecha, precio FROM precios_historicos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(from)
      const dividendos = db.prepare(`SELECT fecha, monto FROM dividendos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(from)

      // Build investment operations map
      const invMap = {}
      inversiones.forEach(i => {
        if (!invMap[i.ticker_id]) invMap[i.ticker_id] = {}
        if (!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = { ops: [] }

        invMap[i.ticker_id][i.fecha].ops.push({
          tipo: i.tipo_operacion,
          amount: Number(i.importe),
          qty: Number(i.cantidad)
        })
      })

      const preMap = {}; precios.forEach(p => { if (!preMap[p.ticker_id]) preMap[p.ticker_id] = {}; preMap[p.ticker_id][p.fecha] = Number(p.precio); })

      // Aggregate dividends by date (for chart markers only)
      const divByDate = {}
      dividendos.forEach(d => {
        const f = d.fecha.slice(0, 10)
        divByDate[f] = (divByDate[f] || 0) + Number(d.monto)
      })
      const dividends = Object.entries(divByDate).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date))

      // Initialize stats with CPP for transactions BEFORE 'from'
      const stats = {}
      tickerIds.forEach(id => {
        const allInv = inversiones.filter(inv => inv.ticker_id === id && inv.fecha < from)
        let qty = 0
        let cpp = 0

        allInv.forEach(inv => {
          const amt = Number(inv.importe)
          const q = Number(inv.cantidad)

          if (inv.tipo_operacion === 'DESINVERSION') {
            qty -= q
            if (qty < 0.01) { qty = 0; cpp = 0; }
          } else {
            const prevCost = qty * cpp
            qty += q
            if (qty > 0) {
              cpp = (prevCost + amt) / qty
            }
          }
        })

        const lp = db.prepare('SELECT precio FROM precios_historicos WHERE ticker_id=? AND fecha < ? ORDER BY fecha DESC LIMIT 1').get(id, from)
        stats[id] = { q: qty, cpp: cpp, lp: Number(lp?.precio || 0) }
      })

      const items = []
      let curr = new Date(from + 'T00:00:00Z')

      while (true) {
        const dStr = curr.toISOString().slice(0, 10)
        if (dStr > hoy) break

        let dailyInversion = 0
        let dailyValor = 0

        tickerIds.forEach(id => {
          const s = stats[id]
          const dayOps = invMap[id]?.[dStr]?.ops || []

          dayOps.forEach(op => {
            if (op.tipo === 'DESINVERSION') {
              s.q -= op.qty
              if (s.q < 0.01) { s.q = 0; s.cpp = 0; }
            } else {
              const prevCost = s.q * s.cpp
              s.q += op.qty
              if (s.q > 0) {
                s.cpp = (prevCost + op.amount) / s.q
              }
            }
          })

          const p = preMap[id]?.[dStr] || s.lp
          s.lp = p

          dailyInversion += (s.q * s.cpp)
          dailyValor += (s.q * p)
        })

        // Rendimiento = (Valor - Inversión) + Realized Gains TOTAL + Dividends TOTAL
        // This matches Empresas exactly: unrealizedGain + realizedGain + dividends
        const unrealizedGain = dailyValor - dailyInversion
        const rendimiento = unrealizedGain + totalRealizedGains + totalDividends

        items.push({
          fecha: dStr,
          inversionUsd: Number(dailyInversion.toFixed(2)),
          valorActualUsd: Number(dailyValor.toFixed(2)),
          rendimientoAcumulado: Number(rendimiento.toFixed(2))
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
      const inversiones = db.prepare(`SELECT ticker_id, fecha, importe, cantidad, tipo_operacion, origen_capital FROM inversiones WHERE ticker_id IN (${tickerIds.join(',')}) ORDER BY fecha ASC`).all()
      const precios = db.prepare(`SELECT ticker_id, fecha, precio FROM precios_historicos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(start)
      const dividendos = db.prepare(`SELECT ticker_id, fecha, monto FROM dividendos WHERE ticker_id IN (${tickerIds.join(',')}) AND fecha >= ? ORDER BY fecha ASC`).all(start)

      // 5. Build maps
      // invMap: { tickerId: { date: { netImp: 0, netQ: 0, inflows: 0, outflows: 0 } } }
      const invMap = {};
      inversiones.forEach(i => {
        if (!invMap[i.ticker_id]) invMap[i.ticker_id] = {};
        if (!invMap[i.ticker_id][i.fecha]) invMap[i.ticker_id][i.fecha] = {
          netImp: 0, netQ: 0,
          externalInflows: 0,  // Aportes frescos + dividendos reinvertidos
          reinvestInflows: 0,  // Reinversiones de capital (neutras)
          outflows: 0
        };

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
        const origen = (i.origen_capital || 'FRESH_CASH').toUpperCase();

        if (type === 'DESINVERSION' || type === 'VENTA') {
          // Retiro de capital
          invMap[i.ticker_id][i.fecha].outflows += signedImp;
          invMap[i.ticker_id][i.fecha].netImp -= signedImp;
          invMap[i.ticker_id][i.fecha].netQ -= Number(i.cantidad);
        } else {
          // COMPRA / INVERSION
          if (origen === 'REINVERSION') {
            // Reinversión de capital: NEUTRA en aportes externos
            invMap[i.ticker_id][i.fecha].reinvestInflows += signedImp;
          } else {
            // FRESH_CASH o DIVIDENDO: Cuenta como aporte externo
            // (Dividendos reinvertidos son ganancia realizada, SÍ suman)
            invMap[i.ticker_id][i.fecha].externalInflows += signedImp;
          }
          invMap[i.ticker_id][i.fecha].netImp += signedImp;
          invMap[i.ticker_id][i.fecha].netQ += Number(i.cantidad);
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
          const inv = invMap[id]?.[dStr] || { netImp: 0, netQ: 0, externalInflows: 0, reinvestInflows: 0, outflows: 0 };
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

          InflowsT += (inv.externalInflows / fxToUse)  // Solo aportes externos (no reinversiones)
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
    // Legacy endpoint stub
    res.json({ items: [], yearEndSummary: [] })
  })

  return r
}