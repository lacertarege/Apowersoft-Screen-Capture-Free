import express from 'express'

export function inversionesRouter(db){
  const r = express.Router()

  // Crear nueva inversión
  r.post('/', (req,res)=>{
    const { ticker_id, fecha, importe, cantidad, plataforma } = req.body || {}
    if (!ticker_id || !fecha || importe == null || cantidad == null) {
      return res.status(400).json({ error: 'ticker_id, fecha, importe y cantidad requeridos' })
    }
    const nImp = Number(importe)
    const nCant = Number(cantidad)
    if (!Number.isFinite(nImp) || !Number.isFinite(nCant) || nCant === 0) {
      return res.status(400).json({ error: 'importe/cantidad inválidos' })
    }
    const apertura = nImp / nCant
    
    // Verificar si ya existe una inversión idéntica
    const existing = db.prepare(`
      SELECT id FROM inversiones 
      WHERE ticker_id = ? AND fecha = ? AND importe = ? AND cantidad = ? AND plataforma = ?
    `).get(ticker_id, fecha, nImp, nCant, plataforma || null)
    
    if (existing) {
      return res.status(409).json({ 
        error: 'Ya existe una inversión idéntica para esta fecha',
        existing_id: existing.id
      })
    }
    
    try {
      const stmt = db.prepare('INSERT INTO inversiones (ticker_id, fecha, importe, cantidad, apertura_guardada, plataforma) VALUES (?,?,?,?,?,?)')
      const info = stmt.run(ticker_id, fecha, nImp, nCant, apertura, plataforma || null)
      return res.status(201).json({ id: info.lastInsertRowid })
    } catch (e) {
      // Si falla por constraint único, ya fue verificado arriba, así que es otro error
      return res.status(400).json({ error: e.message })
    }
  })

  // Actualizar inversión existente
  r.patch('/:id', (req,res)=>{
    const id = Number(req.params.id)
    const { fecha, importe, cantidad, plataforma } = req.body || {}
    
    if (!id) return res.status(400).json({ error: 'ID requerido' })
    
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
      // Primero obtener los valores actuales
      const current = db.prepare('SELECT importe, cantidad FROM inversiones WHERE id = ?').get(id)
      if (!current) return res.status(404).json({ error: 'Inversión no encontrada' })
      
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

  r.delete('/:id', (req,res)=>{
    const id = Number(req.params.id)
    const info = db.prepare('DELETE FROM inversiones WHERE id=?').run(id)
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Inversión no encontrada' })
    }
    res.json({ ok: true })
  })

  return r
}