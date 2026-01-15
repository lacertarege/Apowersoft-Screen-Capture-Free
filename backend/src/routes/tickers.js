import express from 'express'
import { fetchPriceForSymbol, searchSymbols } from '../sources/marketData.js'
import { importHistoryRange } from '../jobs/importHistoryRange.js'
import { getLimaDate } from '../utils/date.js'
import { InvestmentService } from '../services/InvestmentService.js'
import logger from '../utils/logger.js'

// Helpers de fecha: solo días hábiles (UTC)
function lastWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const wd = d.getUTCDay()
  if (wd === 6) d.setUTCDate(d.getUTCDate() - 1) // sábado -> viernes
  else if (wd === 0) d.setUTCDate(d.getUTCDate() - 2) // domingo -> viernes
  return d.toISOString().slice(0, 10)
}
function nextWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  // avanzar un día y saltar fines de semana
  do { d.setUTCDate(d.getUTCDate() + 1) } while ([0, 6].includes(d.getUTCDay()))
  return d.toISOString().slice(0, 10)
}

export function tickersRouter(db) {
  const r = express.Router()

  r.get('/', (req, res) => {
    const { q = '', page = 1, pageSize = 20 } = req.query
    const offset = (Number(page) - 1) * Number(pageSize)
    const rows = db.prepare(`
      SELECT
        v.id,
        v.ticker,
        v.nombre,
        v.moneda,
        v.tipo_inversion_id,
        v.tipo_inversion_nombre,
        v.primera_compra,
        v.fecha,
        v.precio_reciente,
        (SELECT COALESCE(SUM(monto), 0) FROM dividendos WHERE ticker_id = v.id) as total_dividends
      FROM v_resumen_empresas v
      WHERE v.ticker LIKE ? OR v.nombre LIKE ?
      ORDER BY v.ticker
      LIMIT ? OFFSET ?
    `).all(`%${q}%`, `%${q}%`, Number(pageSize), offset)

    // Recalculate positions dynamically using Iterative CPP (Weighted Average Cost)
    const processedRows = rows.map(row => {
      const stats = InvestmentService.calculatePositionStats(db, row.id)

      const cantidad_total = stats.cantidad
      const importe_total = stats.totalInvertido // Qty * CPP (Rule A)

      // 1. Ganancia No Realizada (Papel)
      const balance = cantidad_total * (row.precio_reciente || 0)
      const unrealizedGain = balance - importe_total

      // 2. Ganancia Realizada (Capital Gains from Sales)
      const realizedGain = stats.gananciaRealizada || 0

      // 3. Dividendos (from View)
      const dividends = row.total_dividends || 0

      // 4. Retorno Total Combinado
      const rendimiento = unrealizedGain + realizedGain + dividends

      // 5. Rentabilidad % (Combined ROI)
      // Denominator: Current Invested Capital (Rule A). If 0 (Closed), ROI is undefined/0.
      let rentabilidad = 0
      if (importe_total > 0) {
        rentabilidad = rendimiento / importe_total
      }

      return {
        ...row,
        cantidad_total,
        importe_total,
        balance,
        rendimiento,
        rentabilidad
      }
    }).filter(row => row.cantidad_total > 0.000001) // Solo posiciones abiertas

    const total = db.prepare(`SELECT COUNT(*) as c FROM v_resumen_empresas v WHERE v.ticker LIKE ? OR v.nombre LIKE ?`).get(`%${q}%`, `%${q}%`).c
    res.json({ items: processedRows, total })
  })

  r.get('/:id', (req, res) => {
    const id = Number(req.params.id)
    const row = db.prepare('SELECT * FROM tickers WHERE id = ?').get(id)
    if (!row) return res.status(404).json({ error: 'not found' })
    const precio = db.prepare(`SELECT fecha, precio FROM precios_historicos WHERE ticker_id=? ORDER BY fecha DESC LIMIT 1`).get(id)
    res.json({ ...row, precio })
  })

  r.get('/:id/inversiones', (req, res) => {
    const id = Number(req.params.id)

    // 1. Get Investments
    const investments = db.prepare('SELECT * FROM inversiones WHERE ticker_id = ?').all(id)

    // 2. Get Dividends
    const dividends = db.prepare('SELECT * FROM dividendos WHERE ticker_id = ?').all(id)

    // 3. Format Dividends to look like Investments
    const formattedDividends = dividends.map(d => ({
      id: `div_${d.id}`, // Unique ID string to avoid collision with numeric investment IDs
      original_id: d.id,
      ticker_id: d.ticker_id,
      fecha: d.fecha_pago || d.fecha, // Use payment date if available
      importe: d.monto,
      cantidad: 0, // No quantity change
      tipo_operacion: 'DIVIDENDO',
      plataforma: 'BVL', // Usually dividends come via broker but source is BVL/Company
      realized_return: d.monto, // The whole dividend amount is realized gain
      is_dividend: true
    }))

    // 4. Merge and Sort
    const combined = [...investments, ...formattedDividends].sort((a, b) => {
      // Sort by date DESC
      if (a.fecha < b.fecha) return 1
      if (a.fecha > b.fecha) return -1
      // If same date, Investments usually come before Dividends? Or doesn't matter much.
      return 0
    })

    res.json({ items: combined })
  })

  // Crear inversión para un ticker
  r.post('/:id/inversiones', (req, res) => {
    const id = Number(req.params.id)
    const { fecha, importe, cantidad, plataforma, tipo_operacion = 'INVERSION', origen_capital = 'FRESH_CASH' } = req.body || {}

    if (!id || !fecha || importe == null || cantidad == null) {
      return res.status(400).json({ error: 'fecha, importe y cantidad requeridos' })
    }

    const nImp = Number(importe)
    const nCant = Number(cantidad)

    if (!Number.isFinite(nImp) || !Number.isFinite(nCant) || nCant === 0) {
      return res.status(400).json({ error: 'importe/cantidad inválidos' })
    }

    const apertura = nImp / nCant

    //Calculate realized_return for DESINVERSION operations
    let realizedReturnValue = null
    if (tipo_operacion === 'DESINVERSION') {
      const cpp = InvestmentService.calculateWeightedAverageCost(db, id, fecha)
      const realizedReturn = InvestmentService.calculateRealizedReturn(nImp, nCant, cpp)
      realizedReturnValue = realizedReturn.amount
    }

    try {
      const stmt = db.prepare(
        'INSERT INTO inversiones (ticker_id, fecha, importe, cantidad, apertura_guardada, plataforma, tipo_operacion, origen_capital, realized_return) VALUES (?,?,?,?,?,?,?,?,?)'
      )
      const info = stmt.run(
        id,
        fecha,
        nImp,
        nCant,
        apertura,
        plataforma || null,
        tipo_operacion,
        tipo_operacion === 'INVERSION' ? origen_capital : null,
        realizedReturnValue
      )
      return res.status(201).json({ id: info.lastInsertRowid })
    } catch (e) {
      return res.status(400).json({ error: e.message })
    }
  })

  r.post('/', (req, res) => {
    const { ticker, nombre, moneda, tipo_inversion_id } = req.body

    // Validación de entrada
    if (!ticker || !nombre || !moneda || !tipo_inversion_id) {
      return res.status(400).json({ error: 'Campos requeridos: ticker, nombre, moneda, tipo_inversion_id' })
    }

    if (typeof ticker !== 'string' || ticker.trim().length === 0) {
      return res.status(400).json({ error: 'Ticker debe ser una cadena no vacía' })
    }

    if (typeof nombre !== 'string' || nombre.trim().length === 0) {
      return res.status(400).json({ error: 'Nombre debe ser una cadena no vacía' })
    }

    if (!['USD', 'PEN'].includes(moneda.toUpperCase())) {
      return res.status(400).json({ error: 'Moneda debe ser USD o PEN' })
    }

    if (!Number.isInteger(Number(tipo_inversion_id)) || Number(tipo_inversion_id) <= 0) {
      return res.status(400).json({ error: 'tipo_inversion_id debe ser un entero positivo' })
    }

    // Verificar que el tipo de inversión existe
    const tipoExists = db.prepare('SELECT id FROM tipos_inversion WHERE id=? AND activo=1').get(Number(tipo_inversion_id))
    if (!tipoExists) {
      return res.status(400).json({ error: 'Tipo de inversión no existe o está inactivo' })
    }

    if (!['USD', 'PEN'].includes(moneda.toUpperCase())) {
      return res.status(400).json({ error: 'Moneda debe ser USD o PEN' })
    }

    const tipoInvNum = Number(tipo_inversion_id)
    if (!Number.isFinite(tipoInvNum) || tipoInvNum <= 0) {
      return res.status(400).json({ error: 'tipo_inversion_id debe ser un número positivo' })
    }

    // Extraer exchange del body (opcional, default NYSE)
    const exchange = req.body.exchange || 'NYSE'

    try {
      // Si es BVL, intentar auto-vincular con datos BVL
      let rpjCode = req.body.rpj_code || null

      if (exchange === 'BVL' && !rpjCode) {
        // Buscar en caché local por ticker
        const bvlMatch = db.prepare(`
          SELECT rpj_code 
          FROM bvl_companies 
          WHERE stock LIKE ?
        `).get(`%"${ticker.toUpperCase()}"%`)

        if (bvlMatch) {
          rpjCode = bvlMatch.rpj_code
          logger.info('Auto-linked BVL ticker with RPJ', { ticker, rpjCode })
        } else {
          logger.warn('BVL ticker not found in cache', { ticker })
        }
      }

      // Insertar ticker con rpj_code si existe
      const stmt = db.prepare(`
        INSERT INTO tickers (ticker, nombre, moneda, tipo_inversion_id, exchange, rpj_code, estado) 
        VALUES (?, ?, ?, ?, ?, ?, 'activo')
      `)
      const info = stmt.run(
        ticker.toUpperCase(),
        nombre.trim(),
        moneda.toUpperCase(),
        tipoInvNum,
        exchange,
        rpjCode
      )

      const newId = info.lastInsertRowid
      const created = db.prepare('SELECT * FROM tickers WHERE id = ?').get(newId)

      return res.status(201).json({
        ...created,
        bvl_auto_linked: exchange === 'BVL' && rpjCode ? true : false
      })
    } catch (error) {
      console.error('Error creando ticker:', error)
      return res.status(400).json({ error: error.message })
    }
  })

  r.patch('/:id/precio', async (req, res) => {
    const id = Number(req.params.id)
    const { precio, fecha } = req.body
    if (!precio || !fecha) return res.status(400).json({ error: 'precio y fecha requeridos' })
    const tick = db.prepare('SELECT ticker FROM tickers WHERE id=?').get(id)
    if (!tick) return res.status(404).json({ error: 'not found' })
    db.prepare(`INSERT INTO precios_historicos (ticker_id, fecha, precio, fuente_api, updated_at)
      VALUES (?,?,?,?,?)
      ON CONFLICT(ticker_id, fecha) DO UPDATE SET precio=excluded.precio, fuente_api=excluded.fuente_api, updated_at=excluded.updated_at`
    ).run(id, fecha, precio, 'manual', new Date().toISOString())
    res.json({ ok: true })
  })

  r.post('/:id/refresh', async (req, res) => {
    try {
      const id = Number(req.params.id)
      const tick = db.prepare('SELECT id, ticker FROM tickers WHERE id=?').get(id)
      if (!tick) return res.status(404).json({ error: 'not found' })

      // Debug: Log del body recibido
      logger.debug('Refresh request received', { ticker: tick.ticker, id, body: req.body })

      // Obtener fecha de inicio: prioridad a from_date del body, luego última fecha de precios
      let from = '1970-01-01'
      if (req.body?.from_date) {
        // Usar la fecha de la primera inversión si se proporciona
        from = req.body.from_date
        logger.debug('Using from_date from body', { from })
      } else {
        // Comportamiento original: usar la última fecha de precios
        const last = db.prepare('SELECT fecha FROM precios_historicos WHERE ticker_id=? ORDER BY fecha DESC LIMIT 1').get(id)
        from = last?.fecha ? nextWeekday(last.fecha) : '1970-01-01'
        logger.debug('Using last price date', { from })
      }

      const to = lastWeekday(getLimaDate())

      // Verificar qué fechas ya existen en la base de datos
      const existingDates = db.prepare('SELECT fecha FROM precios_historicos WHERE ticker_id=? AND fecha >= ? AND fecha <= ? ORDER BY fecha').all(id, from, to)
      const existingDateSet = new Set(existingDates.map(row => row.fecha))

      // Generar todas las fechas que deberían existir (solo días laborables)
      const expectedDates = []
      const fromDate = new Date(from)
      const toDate = new Date(to)

      for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        // Saltar fines de semana
        if (d.getDay() !== 0 && d.getDay() !== 6) {
          const dateStr = d.toISOString().slice(0, 10)
          if (!existingDateSet.has(dateStr)) {
            expectedDates.push(dateStr)
          }
        }
      }

      logger.debug('Missing dates detected', { ticker: tick.ticker, count: expectedDates.length, from, to })

      const result = await importHistoryRange(db, tick.ticker, from, to)

      // Construir mensaje de resultado
      let message = ''
      if (result?.inserted > 0) {
        message = `Actualizado con ${result.inserted} día(s) vía ${result.source}`
      } else {
        if (expectedDates.length > 0) {
          message = `Se detectaron ${expectedDates.length} fechas faltantes, pero las APIs no devolvieron datos para este rango (${from} a ${to})`
        } else {
          message = 'No hay fechas faltantes: los precios ya están actualizados'
        }
      }

      res.json({ ok: true, from, to, ...result, message })
    } catch (e) {
      console.error('refresh error', e)
      res.status(500).json({ error: e.message })
    }
  })

  r.patch('/:id', (req, res) => {
    const id = Number(req.params.id)
    const { moneda, tipo_inversion_id } = req.body
    if (!moneda && !tipo_inversion_id) return res.status(400).json({ error: 'moneda o tipo_inversion_id requeridos' })

    const tick = db.prepare('SELECT * FROM tickers WHERE id=?').get(id)
    if (!tick) return res.status(404).json({ error: 'not found' })

    // Verificar que el tipo de inversión existe si se proporciona
    if (tipo_inversion_id) {
      const tipoExists = db.prepare('SELECT id FROM tipos_inversion WHERE id=?').get(tipo_inversion_id)
      if (!tipoExists) return res.status(400).json({ error: 'tipo_inversion_id no existe' })
    }

    // Validar moneda
    if (moneda && !['USD', 'PEN'].includes(moneda.toUpperCase())) {
      return res.status(400).json({ error: 'moneda debe ser USD o PEN' })
    }

    try {
      const updates = []
      const values = []

      if (moneda) {
        updates.push('moneda = ?')
        values.push(moneda.toUpperCase())
      }

      if (tipo_inversion_id) {
        updates.push('tipo_inversion_id = ?')
        values.push(Number(tipo_inversion_id))
      }

      values.push(id)

      const stmt = db.prepare(`UPDATE tickers SET ${updates.join(', ')} WHERE id = ?`)
      const info = stmt.run(...values)
      res.json({ ok: true, changes: info.changes })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // Eliminar ticker (bloqueado si existen inversiones)
  r.delete('/:id', (req, res) => {
    const id = Number(req.params.id)
    const exists = db.prepare('SELECT id FROM tickers WHERE id=?').get(id)
    if (!exists) return res.status(404).json({ error: 'not found' })
    const invCount = db.prepare('SELECT COUNT(*) as c FROM inversiones WHERE ticker_id=?').get(id).c
    if (invCount > 0) return res.status(400).json({ error: 'No se puede eliminar: existen inversiones' })
    db.prepare('DELETE FROM tickers WHERE id=?').run(id)
    res.json({ ok: true })
  })

  // Endpoint para obtener evolución diaria de un ticker
  r.get('/:id/evolucion', (req, res) => {
    try {
      const id = Number(req.params.id)

      const ticker = db.prepare(`
        SELECT t.*, ti.nombre as tipo_nombre
        FROM tickers t
        LEFT JOIN tipos_inversion ti ON t.tipo_inversion_id = ti.id
        WHERE t.id = ?
      `).get(id)
      if (!ticker) {
        return res.status(404).json({ error: 'Ticker no encontrado' })
      }

      const primeraInversion = db.prepare(`
        SELECT MIN(fecha) as fecha
        FROM inversiones
        WHERE ticker_id = ?
      `).get(id)

      if (!primeraInversion || !primeraInversion.fecha) {
        return res.json({ items: [], meses: [] })
      }

      const hoyLima = getLimaDate()
      const d = new Date(hoyLima)
      d.setUTCDate(d.getUTCDate() - 1)
      const fechaFin = d.toISOString().slice(0, 10)

      const fechaCalculoInicio = primeraInversion.fecha.slice(0, 10)
      const fechaVistaHasta = fechaFin

      const fechasCalculo = db.prepare(`
        WITH RECURSIVE fechas_dias AS (
          SELECT DATE(?) as fecha
          UNION ALL
          SELECT DATE(fecha, '+1 day')
          FROM fechas_dias
          WHERE fecha < DATE(?)
        )
        SELECT fecha FROM fechas_dias
      `).all(fechaCalculoInicio, fechaVistaHasta)

      const inversionesTotal = db.prepare(`
        SELECT fecha, SUM(importe) as aportes_total, SUM(cantidad) as cantidad_total
        FROM inversiones
        WHERE ticker_id = ? AND fecha <= ?
        GROUP BY fecha
      `).all(id, fechaVistaHasta)

      const aportesMap = {}
      const cantidadMap = {}
      inversionesTotal.forEach(inv => {
        const f = inv.fecha.slice(0, 10)
        aportesMap[f] = Number(inv.aportes_total || 0)
        cantidadMap[f] = Number(inv.cantidad_total || 0)
      })

      const preciosHistoricos = db.prepare(`
        SELECT fecha, precio
        FROM precios_historicos
        WHERE ticker_id = ? AND fecha <= ?
        ORDER BY fecha
      `).all(id, fechaVistaHasta)

      const preciosMap = {}
      preciosHistoricos.forEach(ph => {
        preciosMap[ph.fecha.slice(0, 10)] = Number(ph.precio || 0)
      })

      const evolucionResult = []
      let VfAnterior = 0
      let RnAcumulada = 0
      let cantidadAcumulada = 0
      let precioAnterior = 0

      for (const fechaObj of fechasCalculo) {
        const fecha = fechaObj.fecha

        // Reseteo anual cada 01 de enero
        if (fecha.endsWith('-01-01')) {
          RnAcumulada = 0
        }

        const Vi = VfAnterior
        const F = aportesMap[fecha] || 0
        const C = cantidadMap[fecha] || 0

        // Cantidad acumulada al finalizar el día
        cantidadAcumulada += C

        // Precio al cierre
        let precio = preciosMap[fecha]
        if (!precio) precio = precioAnterior
        if (!precio && precioAnterior === 0) {
          const p = db.prepare('SELECT precio FROM precios_historicos WHERE ticker_id=? AND fecha < ? ORDER BY fecha DESC LIMIT 1').get(id, fecha)
          precio = p ? Number(p.precio) : 0
        }

        const Vf = cantidadAcumulada * precio

        // Rendimiento monetario del día: Vf - (Vi + F)
        const Rm = Vf - (Vi + F)

        // Rentabilidad del día (Rn): Rm / (Vi + F)
        let Rn = 0
        const baseCalculo = Vi + F
        if (baseCalculo > 0) {
          Rn = Rm / baseCalculo
        }

        RnAcumulada += Rn

        evolucionResult.push({
          fecha,
          valorInicial: Number(Vi.toFixed(2)),
          aportes: Number(F.toFixed(2)),
          cantidad: Number(C.toFixed(4)),
          cantidadAcumulada: Number(cantidadAcumulada.toFixed(4)),
          precio: Number(precio.toFixed(4)),
          valorFinal: Number(Vf.toFixed(2)),
          rendimiento: Number(Rm.toFixed(2)),
          rentabilidad: Number((Rn * 100).toFixed(2)),
          rentabilidadAcumulada: Number((RnAcumulada * 100).toFixed(2))
        })

        // Actualizar estados para el siguiente día
        VfAnterior = Vf
        precioAnterior = precio
      }

      res.json({
        items: evolucionResult,
        ticker: { id: ticker.id, ticker: ticker.ticker, nombre: ticker.nombre, moneda: ticker.moneda, tipo: ticker.tipo_nombre }
      })
    } catch (error) {
      console.error('Error en evolucion:', error)
      res.status(500).json({ error: 'Error al calcular evolución' })
    }
  })

  return r
}