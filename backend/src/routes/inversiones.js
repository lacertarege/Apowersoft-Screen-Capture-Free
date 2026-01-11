import express from 'express'
import { InvestmentService } from '../services/InvestmentService.js'

// Helper: Verificar si la fecha corresponde al año actual (zona horaria Lima)
function isCurrentYear(dateStr) {
  const d = new Date(dateStr)
  const recordYear = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric'
  }).format(d)

  const currentYear = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric'
  }).format(new Date())

  return recordYear === currentYear
}

export function inversionesRouter(db) {
  const r = express.Router()

  // Crear nueva inversión o desinversión
  r.post('/', (req, res) => {
    const { ticker_id, fecha, importe, cantidad, plataforma, tipo_operacion = 'INVERSION', origen_capital = 'FRESH_CASH' } = req.body || {}

    // Validaciones básicas
    if (!ticker_id || !fecha || importe == null || cantidad == null) {
      return res.status(400).json({ error: 'ticker_id, fecha, importe y cantidad requeridos' })
    }

    const nImp = Number(importe)
    const nCant = Number(cantidad)
    if (!Number.isFinite(nImp) || !Number.isFinite(nCant) || nCant === 0) {
      return res.status(400).json({ error: 'importe/cantidad inválidos' })
    }

    // Validar tipo_operacion
    if (!['INVERSION', 'DESINVERSION'].includes(tipo_operacion)) {
      return res.status(400).json({ error: 'tipo_operacion debe ser INVERSION o DESINVERSION' })
    }

    // Validar origen_capital (solo para INVERSIONES)
    if (tipo_operacion === 'INVERSION' && !['FRESH_CASH', 'REINVERSION'].includes(origen_capital)) {
      return res.status(400).json({ error: 'origen_capital debe ser FRESH_CASH o REINVERSION' })
    }

    // Calcular apertura
    const apertura = nImp / nCant

    // Si es DESINVERSION, realizar validaciones y cálculos adicionales
    let responseData = {}

    if (tipo_operacion === 'DESINVERSION') {
      // Calcular stock disponible
      const currentStock = InvestmentService.calculateCurrentStock(db, ticker_id, fecha)

      // Validar desinversión
      const validation = InvestmentService.validateDivestment(
        { fecha, importe: nImp, cantidad: nCant, plataforma },
        currentStock
      )

      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validación de desinversión fallida',
          details: validation.errors
        })
      }

      // Calcular CPP y rendimiento realizado
      const cpp = InvestmentService.calculateWeightedAverageCost(db, ticker_id, fecha)
      const realizedReturn = InvestmentService.calculateRealizedReturn(nImp, nCant, cpp)

      responseData = {
        weighted_average_cost: cpp,
        realized_return: realizedReturn.amount,
        realized_return_rate: realizedReturn.rate,
        cost_basis: realizedReturn.costBasis,
        stock_before: currentStock,
        stock_after: currentStock - nCant
      }
    }

    // Verificar si ya existe una inversión idéntica
    const existing = db.prepare(`
      SELECT id FROM inversiones 
      WHERE ticker_id = ? AND fecha = ? AND importe = ? AND cantidad = ? AND plataforma = ? AND tipo_operacion = ?
    `).get(ticker_id, fecha, nImp, nCant, plataforma || null, tipo_operacion)

    if (existing) {
      return res.status(409).json({
        error: `Ya existe una ${tipo_operacion.toLowerCase()} idéntica para esta fecha`,
        existing_id: existing.id
      })
    }

    try {
      // Preparar valores para INSERT
      const realizedReturnValue = (tipo_operacion === 'DESINVERSION' && responseData.realized_return !== undefined)
        ? responseData.realized_return
        : null

      const stmt = db.prepare(
        'INSERT INTO inversiones (ticker_id, fecha, importe, cantidad, apertura_guardada, plataforma, tipo_operacion, origen_capital, realized_return) VALUES (?,?,?,?,?,?,?,?,?)'
      )
      const info = stmt.run(
        ticker_id,
        fecha,
        nImp,
        nCant,
        apertura,
        plataforma || null,
        tipo_operacion,
        tipo_operacion === 'INVERSION' ? origen_capital : null,
        realizedReturnValue
      )

      return res.status(201).json({
        id: info.lastInsertRowid,
        ...responseData
      })
    } catch (e) {
      return res.status(400).json({ error: e.message })
    }
  })

  // Actualizar inversión existente
  r.patch('/:id', (req, res) => {
    const id = Number(req.params.id)
    const { fecha, importe, cantidad, plataforma } = req.body || {}

    if (!id) return res.status(400).json({ error: 'ID requerido' })

    // Obtener el registro existente para validar el año
    const existing = db.prepare('SELECT fecha FROM inversiones WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Inversión no encontrada' })
    }

    // Validar que sea del año actual
    if (!isCurrentYear(existing.fecha)) {
      return res.status(403).json({
        error: 'No se pueden modificar registros de años anteriores',
        detail: 'Esta operación está restringida para preservar la integridad del historial'
      })
    }

    // Construir query dinámicamente basado en los campos proporcionados
    const updates = []
    const params = []

    if (fecha !== undefined) {
      updates.push('fecha = ?')
      params.push(fecha)
    }
    if (importe !== undefined) {
      updates.push('importe = ?')
      params.push(Number(importe))
    }
    if (cantidad !== undefined) {
      updates.push('cantidad = ?')
      params.push(Number(cantidad))
    }
    if (plataforma !== undefined) {
      updates.push('plataforma = ?')
      params.push(plataforma)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' })
    }

    // Si se actualiza importe o cantidad, recalcular apertura
    if (importe !== undefined || cantidad !== undefined) {
      const current = db.prepare('SELECT importe, cantidad FROM inversiones WHERE id = ?').get(id)

      const newImporte = importe !== undefined ? Number(importe) : current.importe
      const newCantidad = cantidad !== undefined ? Number(cantidad) : current.cantidad

      if (newCantidad === 0) {
        return res.status(400).json({ error: 'Cantidad no puede ser cero' })
      }

      const apertura = newImporte / newCantidad
      updates.push('apertura_guardada = ?')
      params.push(apertura)
    }

    params.push(id)

    try {
      const sql = `UPDATE inversiones SET ${updates.join(', ')} WHERE id = ?`
      const stmt = db.prepare(sql)
      const info = stmt.run(...params)

      if (info.changes === 0) {
        return res.status(404).json({ error: 'Inversión no encontrada' })
      }

      return res.json({ ok: true, changes: info.changes })
    } catch (e) {
      return res.status(400).json({ error: e.message })
    }
  })

  r.delete('/:id', (req, res) => {
    const id = Number(req.params.id)

    // Obtener el registro existente para validar el año
    const existing = db.prepare('SELECT fecha FROM inversiones WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Inversión no encontrada' })
    }

    // Validar que sea del año actual
    if (!isCurrentYear(existing.fecha)) {
      return res.status(403).json({
        error: 'No se pueden eliminar registros de años anteriores',
        detail: 'Esta operación está restringida para preservar la integridad del historial'
      })
    }

    const info = db.prepare('DELETE FROM inversiones WHERE id=?').run(id)
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Inversión no encontrada' })
    }
    res.json({ ok: true })
  })

  return r
}