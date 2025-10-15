import express from 'express'
import { fetchPriceForSymbol, searchSymbols } from '../sources/marketData.js'
import { importHistoryRange } from '../jobs/importHistoryRange.js'

// Helpers de fecha: solo días hábiles (UTC)
function lastWeekday(dateStr){
  const d = new Date(dateStr + 'T00:00:00Z')
  const wd = d.getUTCDay()
  if (wd === 6) d.setUTCDate(d.getUTCDate() - 1) // sábado -> viernes
  else if (wd === 0) d.setUTCDate(d.getUTCDate() - 2) // domingo -> viernes
  return d.toISOString().slice(0,10)
}
function nextWeekday(dateStr){
  const d = new Date(dateStr + 'T00:00:00Z')
  // avanzar un día y saltar fines de semana
  do { d.setUTCDate(d.getUTCDate() + 1) } while ([0,6].includes(d.getUTCDay()))
  return d.toISOString().slice(0,10)
}

export function tickersRouter(db){
  const r = express.Router()

  r.get('/', (req,res)=>{
    const { q = '', page = 1, pageSize = 20 } = req.query
    const offset = (Number(page)-1) * Number(pageSize)
    const rows = db.prepare(`
      SELECT
        v.id,
        v.ticker,
        v.nombre,
        v.moneda,
        v.tipo_inversion_id,
        v.tipo_inversion_nombre,
        v.primera_compra,
        v.importe_total,
        v.cantidad_total,
        v.fecha,
        v.precio_reciente,
        v.balance,
        v.rendimiento,
        v.rentabilidad
      FROM v_resumen_empresas v
      WHERE v.ticker LIKE ? OR v.nombre LIKE ?
      ORDER BY v.ticker
      LIMIT ? OFFSET ?
    `).all(`%${q}%`,`%${q}%`, Number(pageSize), offset)
    const total = db.prepare(`SELECT COUNT(*) as c FROM v_resumen_empresas v WHERE v.ticker LIKE ? OR v.nombre LIKE ?`).get(`%${q}%`,`%${q}%`).c
    res.json({ items: rows, total })
  })

  r.get('/:id', (req,res)=>{
    const id = Number(req.params.id)
    const row = db.prepare('SELECT * FROM tickers WHERE id = ?').get(id)
    if (!row) return res.status(404).json({error:'not found'})
    const precio = db.prepare(`SELECT fecha, precio FROM precios_historicos WHERE ticker_id=? ORDER BY fecha DESC LIMIT 1`).get(id)
    res.json({ ...row, precio })
  })

  r.get('/:id/inversiones', (req,res)=>{
    const id = Number(req.params.id)
    const rows = db.prepare('SELECT * FROM inversiones WHERE ticker_id = ? ORDER BY fecha DESC').all(id)
    res.json({ items: rows })
  })

  // Crear inversión para un ticker
  r.post('/:id/inversiones', (req,res)=>{
    const id = Number(req.params.id)
    const { fecha, importe, cantidad, plataforma } = req.body || {}
    if (!id || !fecha || importe == null || cantidad == null) return res.status(400).json({ error: 'fecha, importe y cantidad requeridos' })
    const nImp = Number(importe); const nCant = Number(cantidad)
    if (!Number.isFinite(nImp) || !Number.isFinite(nCant) || nCant === 0) return res.status(400).json({ error: 'importe/cantidad inválidos' })
    const apertura = nImp / nCant
    try {
      const stmt = db.prepare('INSERT INTO inversiones (ticker_id, fecha, importe, cantidad, apertura_guardada, plataforma) VALUES (?,?,?,?,?,?)')
      const info = stmt.run(id, fecha, nImp, nCant, apertura, plataforma || null)
      return res.status(201).json({ id: info.lastInsertRowid })
    } catch (e) {
      return res.status(400).json({ error: e.message })
    }
  })

  r.post('/', (req,res)=>{
    const { ticker, nombre, moneda, tipo_inversion_id } = req.body
    
    // Validación de entrada
    if (!ticker || !nombre || !moneda || !tipo_inversion_id) {
      return res.status(400).json({error:'Campos requeridos: ticker, nombre, moneda, tipo_inversion_id'})
    }
    
    if (typeof ticker !== 'string' || ticker.trim().length === 0) {
      return res.status(400).json({error:'Ticker debe ser una cadena no vacía'})
    }
    
    if (typeof nombre !== 'string' || nombre.trim().length === 0) {
      return res.status(400).json({error:'Nombre debe ser una cadena no vacía'})
    }
    
    if (!['USD', 'PEN'].includes(moneda.toUpperCase())) {
      return res.status(400).json({error:'Moneda debe ser USD o PEN'})
    }
    
    if (!Number.isInteger(Number(tipo_inversion_id)) || Number(tipo_inversion_id) <= 0) {
      return res.status(400).json({error:'tipo_inversion_id debe ser un entero positivo'})
    }
    
    // Verificar que el tipo de inversión existe
    const tipoExists = db.prepare('SELECT id FROM tipos_inversion WHERE id=? AND activo=1').get(Number(tipo_inversion_id))
    if (!tipoExists) {
      return res.status(400).json({error:'Tipo de inversión no existe o está inactivo'})
    }
    
    try{
      const stmt = db.prepare('INSERT INTO tickers (ticker, nombre, moneda, tipo_inversion_id) VALUES (UPPER(?),?,?,?)')
      const info = stmt.run(ticker.trim(), nombre.trim(), moneda.toUpperCase(), Number(tipo_inversion_id))
      return res.status(201).json({ id: info.lastInsertRowid })
    } catch (e){
      if (e.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({error:'Ya existe un ticker con ese símbolo'})
      }
      return res.status(400).json({error: e.message})
    }
  })

  r.patch('/:id/precio', async (req,res)=>{
    const id = Number(req.params.id)
    const { precio, fecha } = req.body
    if (!precio || !fecha) return res.status(400).json({error:'precio y fecha requeridos'})
    const tick = db.prepare('SELECT ticker FROM tickers WHERE id=?').get(id)
    if (!tick) return res.status(404).json({error:'not found'})
    db.prepare(`INSERT INTO precios_historicos (ticker_id, fecha, precio, fuente_api, updated_at)
      VALUES (?,?,?,?,?)
      ON CONFLICT(ticker_id, fecha) DO UPDATE SET precio=excluded.precio, fuente_api=excluded.fuente_api, updated_at=excluded.updated_at`
    ).run(id, fecha, precio, 'manual', new Date().toISOString())
    res.json({ ok: true })
  })

  r.post('/:id/refresh', async (req,res)=>{
    try {
      const id = Number(req.params.id)
      const tick = db.prepare('SELECT id, ticker FROM tickers WHERE id=?').get(id)
      if (!tick) return res.status(404).json({ error: 'not found' })
      
      // Debug: Log del body recibido
      console.log(`Refresh request for ${tick.ticker} (id: ${id}):`, req.body)
      
      // Obtener fecha de inicio: prioridad a from_date del body, luego última fecha de precios
      let from = '1970-01-01'
      if (req.body?.from_date) {
        // Usar la fecha de la primera inversión si se proporciona
        from = req.body.from_date
        console.log(`Using from_date from body: ${from}`)
      } else {
        // Comportamiento original: usar la última fecha de precios
        const last = db.prepare('SELECT fecha FROM precios_historicos WHERE ticker_id=? ORDER BY fecha DESC LIMIT 1').get(id)
        from = last?.fecha ? nextWeekday(last.fecha) : '1970-01-01'
        console.log(`Using last price date: ${from}`)
      }
      
      const to = lastWeekday(new Date().toISOString().slice(0,10))
      
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
      
      console.log(`${tick.ticker}: Fechas faltantes detectadas: ${expectedDates.length} desde ${from} hasta ${to}`)
      
      const result = await importHistoryRange(db, tick.ticker, from, to)

      // Construir mensaje de resultado
      let message = ''
      if (result?.inserted > 0){
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

  r.patch('/:id', (req,res)=>{
    const id = Number(req.params.id)
    const { moneda, tipo_inversion_id } = req.body
    if (!moneda && !tipo_inversion_id) return res.status(400).json({error:'moneda o tipo_inversion_id requeridos'})
    
    const tick = db.prepare('SELECT * FROM tickers WHERE id=?').get(id)
    if (!tick) return res.status(404).json({error:'not found'})
    
    // Verificar que el tipo de inversión existe si se proporciona
    if (tipo_inversion_id) {
      const tipoExists = db.prepare('SELECT id FROM tipos_inversion WHERE id=?').get(tipo_inversion_id)
      if (!tipoExists) return res.status(400).json({error:'tipo_inversion_id no existe'})
    }
    
    // Validar moneda
    if (moneda && !['USD', 'PEN'].includes(moneda.toUpperCase())) {
      return res.status(400).json({error:'moneda debe ser USD o PEN'})
    }
    
    try{
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
    } catch (e){
      res.status(400).json({error: e.message})
    }
  })

  // Eliminar ticker (bloqueado si existen inversiones)
  r.delete('/:id', (req,res)=>{
    const id = Number(req.params.id)
    const exists = db.prepare('SELECT id FROM tickers WHERE id=?').get(id)
    if (!exists) return res.status(404).json({ error: 'not found' })
    const invCount = db.prepare('SELECT COUNT(*) as c FROM inversiones WHERE ticker_id=?').get(id).c
    if (invCount > 0) return res.status(400).json({ error: 'No se puede eliminar: existen inversiones' })
    db.prepare('DELETE FROM tickers WHERE id=?').run(id)
    res.json({ ok: true })
  })

  return r
}