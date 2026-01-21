import express from 'express'

export function exchangesRouter(db) {
    const r = express.Router()

    // GET /exchanges - List all exchanges
    r.get('/', (req, res) => {
        try {
            const { activo } = req.query
            let query = 'SELECT * FROM exchanges'
            const params = []

            if (activo !== undefined) {
                query += ' WHERE activo = ?'
                params.push(Number(activo))
            }

            query += ' ORDER BY nombre ASC'
            const items = db.prepare(query).all(...params)
            res.json({ items })
        } catch (error) {
            res.status(500).json({ error: error.message })
        }
    })

    // GET /exchanges/:id - Get exchange by ID
    r.get('/:id', (req, res) => {
        try {
            const id = Number(req.params.id)
            const item = db.prepare('SELECT * FROM exchanges WHERE id = ?').get(id)
            if (!item) {
                return res.status(404).json({ error: 'Exchange no encontrado' })
            }
            res.json(item)
        } catch (error) {
            res.status(500).json({ error: error.message })
        }
    })

    // POST /exchanges - Create new exchange
    r.post('/', (req, res) => {
        try {
            const { nombre, pais, moneda_principal, activo } = req.body

            if (!nombre || nombre.trim() === '') {
                return res.status(400).json({ error: 'El nombre es requerido' })
            }

            // Check for duplicate
            const existing = db.prepare('SELECT id FROM exchanges WHERE nombre = ?').get(nombre.trim())
            if (existing) {
                return res.status(409).json({ error: 'Ya existe un exchange con ese nombre' })
            }

            const result = db.prepare(`
        INSERT INTO exchanges (nombre, pais, moneda_principal, activo)
        VALUES (?, ?, ?, ?)
      `).run(
                nombre.trim(),
                pais || null,
                moneda_principal || 'USD',
                activo !== undefined ? Number(activo) : 1
            )

            const newItem = db.prepare('SELECT * FROM exchanges WHERE id = ?').get(result.lastInsertRowid)
            res.status(201).json(newItem)
        } catch (error) {
            res.status(500).json({ error: error.message })
        }
    })

    // PATCH /exchanges/:id - Update exchange
    r.patch('/:id', (req, res) => {
        try {
            const id = Number(req.params.id)
            const { nombre, pais, moneda_principal, activo } = req.body

            const existing = db.prepare('SELECT * FROM exchanges WHERE id = ?').get(id)
            if (!existing) {
                return res.status(404).json({ error: 'Exchange no encontrado' })
            }

            // Check for duplicate name
            if (nombre && nombre.trim() !== existing.nombre) {
                const duplicate = db.prepare('SELECT id FROM exchanges WHERE nombre = ? AND id != ?').get(nombre.trim(), id)
                if (duplicate) {
                    return res.status(409).json({ error: 'Ya existe otro exchange con ese nombre' })
                }
            }

            const updates = []
            const params = []

            if (nombre !== undefined) updates.push('nombre = ?'), params.push(nombre.trim())
            if (pais !== undefined) updates.push('pais = ?'), params.push(pais)
            if (moneda_principal !== undefined) updates.push('moneda_principal = ?'), params.push(moneda_principal)
            if (activo !== undefined) updates.push('activo = ?'), params.push(Number(activo))

            if (updates.length > 0) {
                params.push(id)
                db.prepare(`UPDATE exchanges SET ${updates.join(', ')} WHERE id = ?`).run(...params)
            }

            const updated = db.prepare('SELECT * FROM exchanges WHERE id = ?').get(id)
            res.json(updated)
        } catch (error) {
            res.status(500).json({ error: error.message })
        }
    })

    // DELETE /exchanges/:id
    r.delete('/:id', (req, res) => {
        try {
            const id = Number(req.params.id)
            const { hard } = req.query

            const existing = db.prepare('SELECT * FROM exchanges WHERE id = ?').get(id)
            if (!existing) return res.status(404).json({ error: 'Exchange no encontrado' })

            // Check usage
            const inUsePlatform = db.prepare('SELECT COUNT(*) as cnt FROM plataformas WHERE exchange_id = ?').get(id)
            const inUseInv = db.prepare('SELECT COUNT(*) as cnt FROM inversiones WHERE exchange_id = ?').get(id)

            const totalUse = inUsePlatform.cnt + inUseInv.cnt

            if (hard === 'true') {
                if (totalUse > 0) {
                    return res.status(409).json({ error: `No se puede eliminar. Tiene ${totalUse} registros asociados.` })
                }
                db.prepare('DELETE FROM exchanges WHERE id = ?').run(id)
                res.json({ message: 'Eliminado permanentemente', id })
            } else {
                db.prepare('UPDATE exchanges SET activo = 0 WHERE id = ?').run(id)
                res.json({ message: 'Desactivado', id })
            }
        } catch (error) {
            res.status(500).json({ error: error.message })
        }
    })

    // GET /exchanges/select/options
    r.get('/select/options', (req, res) => {
        try {
            const items = db.prepare('SELECT id, nombre, moneda_principal FROM exchanges WHERE activo = 1 ORDER BY nombre ASC').all()
            res.json(items.map(i => ({ value: i.id, label: i.nombre, moneda: i.moneda_principal })))
        } catch (error) {
            res.status(500).json({ error: error.message })
        }
    })

    return r
}
