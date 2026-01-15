import express from 'express'

export function plataformasRouter(db) {
    const r = express.Router()

    // GET /plataformas - List all platforms
    r.get('/', (req, res) => {
        try {
            const { activo } = req.query
            let query = 'SELECT * FROM plataformas'
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

    // GET /plataformas/:id - Get platform by ID
    r.get('/:id', (req, res) => {
        try {
            const id = Number(req.params.id)
            const item = db.prepare('SELECT * FROM plataformas WHERE id = ?').get(id)
            if (!item) {
                return res.status(404).json({ error: 'Plataforma no encontrada' })
            }
            res.json(item)
        } catch (error) {
            res.status(500).json({ error: error.message })
        }
    })

    // POST /plataformas - Create new platform
    r.post('/', (req, res) => {
        try {
            const { nombre, exchange, moneda_principal, pais, url, activo } = req.body

            if (!nombre || nombre.trim() === '') {
                return res.status(400).json({ error: 'El nombre es requerido' })
            }

            // Check for duplicate
            const existing = db.prepare('SELECT id FROM plataformas WHERE nombre = ?').get(nombre.trim())
            if (existing) {
                return res.status(409).json({ error: 'Ya existe una plataforma con ese nombre' })
            }

            const result = db.prepare(`
        INSERT INTO plataformas (nombre, exchange, moneda_principal, pais, url, activo)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
                nombre.trim(),
                exchange || null,
                moneda_principal || 'USD',
                pais || null,
                url || null,
                activo !== undefined ? Number(activo) : 1
            )

            const newItem = db.prepare('SELECT * FROM plataformas WHERE id = ?').get(result.lastInsertRowid)
            res.status(201).json(newItem)
        } catch (error) {
            res.status(500).json({ error: error.message })
        }
    })

    // PUT /plataformas/:id - Update platform
    r.put('/:id', (req, res) => {
        try {
            const id = Number(req.params.id)
            const { nombre, exchange, moneda_principal, pais, url, activo } = req.body

            const existing = db.prepare('SELECT * FROM plataformas WHERE id = ?').get(id)
            if (!existing) {
                return res.status(404).json({ error: 'Plataforma no encontrada' })
            }

            // Check for duplicate name (excluding current)
            if (nombre && nombre.trim() !== existing.nombre) {
                const duplicate = db.prepare('SELECT id FROM plataformas WHERE nombre = ? AND id != ?').get(nombre.trim(), id)
                if (duplicate) {
                    return res.status(409).json({ error: 'Ya existe otra plataforma con ese nombre' })
                }
            }

            db.prepare(`
        UPDATE plataformas 
        SET nombre = ?, exchange = ?, moneda_principal = ?, pais = ?, url = ?, activo = ?
        WHERE id = ?
      `).run(
                nombre !== undefined ? nombre.trim() : existing.nombre,
                exchange !== undefined ? exchange : existing.exchange,
                moneda_principal !== undefined ? moneda_principal : existing.moneda_principal,
                pais !== undefined ? pais : existing.pais,
                url !== undefined ? url : existing.url,
                activo !== undefined ? Number(activo) : existing.activo,
                id
            )

            const updated = db.prepare('SELECT * FROM plataformas WHERE id = ?').get(id)
            res.json(updated)
        } catch (error) {
            res.status(500).json({ error: error.message })
        }
    })

    // DELETE /plataformas/:id - Soft delete platform (set activo = 0)
    r.delete('/:id', (req, res) => {
        try {
            const id = Number(req.params.id)
            const { hard } = req.query

            const existing = db.prepare('SELECT * FROM plataformas WHERE id = ?').get(id)
            if (!existing) {
                return res.status(404).json({ error: 'Plataforma no encontrada' })
            }

            // Check if platform is in use
            const inUse = db.prepare('SELECT COUNT(*) as cnt FROM inversiones WHERE plataforma = ?').get(existing.nombre)

            if (hard === 'true') {
                if (inUse.cnt > 0) {
                    return res.status(409).json({
                        error: `No se puede eliminar. La plataforma tiene ${inUse.cnt} inversiones asociadas.`
                    })
                }
                db.prepare('DELETE FROM plataformas WHERE id = ?').run(id)
                res.json({ message: 'Plataforma eliminada permanentemente', id })
            } else {
                // Soft delete
                db.prepare('UPDATE plataformas SET activo = 0 WHERE id = ?').run(id)
                res.json({ message: 'Plataforma desactivada', id, inversiones_asociadas: inUse.cnt })
            }
        } catch (error) {
            res.status(500).json({ error: error.message })
        }
    })

    // GET /plataformas/options - Get platforms for dropdown
    r.get('/select/options', (req, res) => {
        try {
            const items = db.prepare('SELECT id, nombre FROM plataformas WHERE activo = 1 ORDER BY nombre ASC').all()
            res.json(items.map(i => ({ value: i.nombre, label: i.nombre })))
        } catch (error) {
            res.status(500).json({ error: error.message })
        }
    })

    return r
}
