import express from 'express'

export function configRouter(db){
  const r = express.Router()

  r.get('/tipos-inversion', (req,res)=>{
    const rows = db.prepare('SELECT * FROM tipos_inversion').all()
    res.json({ items: rows })
  })
  r.post('/tipos-inversion', (req,res)=>{
    const { nombre, activo = true } = req.body
    if (!nombre) return res.status(400).json({error:'nombre requerido'})
    const info = db.prepare('INSERT INTO tipos_inversion (nombre, activo) VALUES (?,?)').run(nombre, activo?1:0)
    res.status(201).json({ id: info.lastInsertRowid })
  })

  // Listado de tipos de cambio con filtros opcionales
  r.get('/tipo-cambio', (req,res)=>{
    try {
      const { fecha, from, to, limit, verify } = req.query

      // DEBUG: Verificar estado de la base de datos
      const totalCount = db.prepare('SELECT COUNT(*) as count FROM tipos_cambio').get()
      console.log(`[DEBUG] Total registros en tipos_cambio: ${totalCount.count}`)

      // Disparar verificación de días recientes (no bloqueante) si verify=1
      if (verify === '1') {
        ;(async ()=>{
          try {
            const { backfillFxJob } = await import('../jobs/backfillFx.js')
            await backfillFxJob(db, false)
          } catch (e) { console.error('verify tipo-cambio error', e) }
        })()
      }

      let sql = 'SELECT * FROM tipos_cambio'
      const params = []
      const where = []
      if (fecha) { where.push('fecha = ?'); params.push(fecha) }
      if (from) { where.push('fecha >= ?'); params.push(from) }
      if (to) { where.push('fecha <= ?'); params.push(to) }
      if (where.length) sql += ' WHERE ' + where.join(' AND ')
      sql += ' ORDER BY fecha DESC'
      const lim = Number(limit)||365
      sql += ' LIMIT ' + lim
      
      console.log(`[DEBUG] SQL: ${sql}`)
      console.log(`[DEBUG] Parámetros:`, params)
      
      const rows = db.prepare(sql).all(...params)
      console.log(`[DEBUG] Registros devueltos: ${rows.length}`)
      
      res.json({ items: rows })
    } catch (e) {
      console.error('GET /config/tipo-cambio error', e)
      res.status(500).json({ error: 'Error obteniendo tipos de cambio' })
    }
  })

  // Upsert de tipo de cambio (manual o desde API)
  r.post('/tipo-cambio', (req,res)=>{
    const { fecha, usd_pen, fuente_api='manual' } = req.body
    if (!fecha || usd_pen==null) return res.status(400).json({error:'fecha y usd_pen requeridos'})
    db.prepare(`INSERT INTO tipos_cambio (fecha, usd_pen, fuente_api) VALUES (?,?,?)
      ON CONFLICT(fecha) DO UPDATE SET usd_pen=excluded.usd_pen, fuente_api=excluded.fuente_api`).run(fecha, usd_pen, fuente_api)
    res.json({ ok: true })
  })

  // Actualizar tipo de cambio por fecha
  r.patch('/tipo-cambio/:fecha', (req,res)=>{
    try {
      const { fecha } = req.params
      const { usd_pen, fuente_api } = req.body
      
      if (usd_pen == null) return res.status(400).json({error:'usd_pen requerido'})
      
      const result = db.prepare(`UPDATE tipos_cambio SET usd_pen = ?, fuente_api = ? WHERE fecha = ?`)
        .run(usd_pen, fuente_api || 'manual', fecha)
      
      if (result.changes === 0) {
        return res.status(404).json({error:'Tipo de cambio no encontrado'})
      }
      
      res.json({ ok: true })
    } catch (e) {
      console.error('PATCH /config/tipo-cambio/:fecha error', e)
      res.status(500).json({ error: e.message })
    }
  })

  // Eliminar tipo de cambio por fecha
  r.delete('/tipo-cambio/:fecha', (req,res)=>{
    try {
      const { fecha } = req.params
      
      const result = db.prepare('DELETE FROM tipos_cambio WHERE fecha = ?').run(fecha)
      
      if (result.changes === 0) {
        return res.status(404).json({error:'Tipo de cambio no encontrado'})
      }
      
      res.json({ ok: true, deleted: result.changes })
    } catch (e) {
      console.error('DELETE /config/tipo-cambio/:fecha error', e)
      res.status(500).json({ error: e.message })
    }
  })

  // Disparar backfill (full o reciente)
  r.post('/tipo-cambio/backfill', async (req,res)=>{
    try {
      const mode = (req.body?.mode||'recent')
      const fullMode = mode === 'full'
      const { backfillFxJob } = await import('../jobs/backfillFx.js')
      // Ejecutar en segundo plano para no bloquear la petición
      ;(async ()=>{ try { await backfillFxJob(db, fullMode) } catch(e){ console.error('backfill API error', e) } })()
      res.json({ started: true, mode })
    } catch (e) {
      console.error('POST /config/tipo-cambio/backfill error', e)
      res.status(500).json({ error: 'No se pudo iniciar el backfill' })
    }
  })

  // Presupuesto: leer o establecer (id fijo = 1)
  r.get('/presupuesto', (req,res)=>{
    const row = db.prepare('SELECT id, nombre, version, created_at FROM presupuesto WHERE id=1').get()
    res.json({ item: row || null })
  })
  r.post('/presupuesto', (req,res)=>{
    const { nombre, version } = req.body
    if (!nombre || !version) return res.status(400).json({error:'nombre y version requeridos'})
    db.prepare(`INSERT INTO presupuesto (id, nombre, version, created_at) VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, version=excluded.version`).run(nombre, version, new Date().toISOString())
    res.json({ ok: true })
  })

  return r
}