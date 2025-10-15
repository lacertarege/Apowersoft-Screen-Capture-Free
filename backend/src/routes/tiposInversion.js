import express from 'express'
import logger from '../utils/logger.js'

export function tiposInversionRouter(db) {
  const r = express.Router()

  // =========================================================================
  // GET /tipos-inversion
  // Obtiene todos los tipos de inversión
  // =========================================================================
  r.get('/', (req, res) => {
    try {
      const tiposInversion = db.prepare(`
        SELECT 
          ti.id,
          ti.nombre
        FROM tipos_inversion ti
        ORDER BY ti.nombre
      `).all()

      res.json({ items: tiposInversion })
    } catch (e) {
      logger.error('GET /tipos-inversion error', e)
      res.status(500).json({ error: e.message })
    }
  })

  // =========================================================================
  // GET /tipos-inversion/:id
  // Obtiene un tipo de inversión específico
  // =========================================================================
  r.get('/:id', (req, res) => {
    try {
      const { id } = req.params

      const tipoInversion = db.prepare(`
        SELECT id, nombre
        FROM tipos_inversion
        WHERE id = ?
      `).get(id)

      if (!tipoInversion) {
        return res.status(404).json({ error: 'Tipo de inversión no encontrado' })
      }

      res.json(tipoInversion)
    } catch (e) {
      logger.error(`GET /tipos-inversion/${req.params.id} error`, e)
      res.status(500).json({ error: e.message })
    }
  })

  // =========================================================================
  // POST /tipos-inversion
  // Crea un nuevo tipo de inversión
  // =========================================================================
  r.post('/', (req, res) => {
    try {
      const { nombre } = req.body

      // Validaciones
      if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre es requerido' })
      }

      // Verificar que no exista ya
      const existe = db.prepare('SELECT id FROM tipos_inversion WHERE nombre = ?').get(nombre.trim())
      if (existe) {
        return res.status(409).json({ error: 'Ya existe un tipo de inversión con ese nombre' })
      }

      // Insertar
      const info = db.prepare(`
        INSERT INTO tipos_inversion (nombre)
        VALUES (?)
      `).run(nombre.trim())

      res.status(201).json({ 
        ok: true, 
        id: info.lastInsertRowid,
        message: 'Tipo de inversión creado exitosamente'
      })
    } catch (e) {
      logger.error('POST /tipos-inversion error', e)
      res.status(500).json({ error: e.message })
    }
  })

  // =========================================================================
  // PATCH /tipos-inversion/:id
  // Actualiza un tipo de inversión existente
  // =========================================================================
  r.patch('/:id', (req, res) => {
    try {
      const { id } = req.params
      const { nombre } = req.body

      // Verificar que existe
      const existe = db.prepare('SELECT id FROM tipos_inversion WHERE id = ?').get(id)
      if (!existe) {
        return res.status(404).json({ error: 'Tipo de inversión no encontrado' })
      }

      // Validaciones
      if (nombre === undefined) {
        return res.status(400).json({ error: 'No hay campos para actualizar' })
      }

      if (nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre no puede estar vacío' })
      }

      // Verificar nombre duplicado (excepto el mismo registro)
      const duplicado = db.prepare('SELECT id FROM tipos_inversion WHERE nombre = ? AND id != ?').get(nombre.trim(), id)
      if (duplicado) {
        return res.status(409).json({ error: 'Ya existe un tipo de inversión con ese nombre' })
      }

      // Actualizar
      db.prepare('UPDATE tipos_inversion SET nombre = ? WHERE id = ?').run(nombre.trim(), id)

      res.json({ ok: true, message: 'Tipo de inversión actualizado exitosamente' })
    } catch (e) {
      logger.error(`PATCH /tipos-inversion/${req.params.id} error`, e)
      res.status(500).json({ error: e.message })
    }
  })

  // =========================================================================
  // DELETE /tipos-inversion/:id
  // Elimina un tipo de inversión (solo si no tiene tickers relacionados)
  // =========================================================================
  r.delete('/:id', (req, res) => {
    try {
      const { id } = req.params

      // Verificar que existe
      const tipoInversion = db.prepare('SELECT nombre FROM tipos_inversion WHERE id = ?').get(id)
      if (!tipoInversion) {
        return res.status(404).json({ error: 'Tipo de inversión no encontrado' })
      }

      // Verificar integridad referencial - contar tickers relacionados
      const tickersRelacionados = db.prepare(`
        SELECT COUNT(*) as count 
        FROM tickers 
        WHERE tipo_inversion_id = ?
      `).get(id)

      if (tickersRelacionados.count > 0) {
        return res.status(409).json({ 
          error: `No se puede eliminar "${tipoInversion.nombre}" porque tiene ${tickersRelacionados.count} ticker(s) relacionado(s)`,
          tickersRelacionados: tickersRelacionados.count
        })
      }

      // Eliminar
      const result = db.prepare('DELETE FROM tipos_inversion WHERE id = ?').run(id)

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Tipo de inversión no encontrado' })
      }

      res.json({ ok: true, message: 'Tipo de inversión eliminado exitosamente' })
    } catch (e) {
      logger.error(`DELETE /tipos-inversion/${req.params.id} error`, e)
      res.status(500).json({ error: e.message })
    }
  })

  return r
}

