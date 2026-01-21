import express from 'express'

export function sectoresRouter(db) {
    const r = express.Router()

    // GET /sectores
    r.get('/', (req, res) => {
        try {
            const sectores = db.prepare('SELECT * FROM sectores ORDER BY nombre').all()
            res.json({ items: sectores })
        } catch (e) {
            res.status(500).json({ error: e.message })
        }
    })

    // POST /sectores
    r.post('/', (req, res) => {
        const { nombre, descripcion } = req.body
        if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' })
        try {
            const stmt = db.prepare('INSERT INTO sectores (nombre, descripcion) VALUES (?, ?)')
            const result = stmt.run(nombre, descripcion || null)
            res.json({ ok: true, id: result.lastInsertRowid })
        } catch (e) {
            if (e.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'El nombre del sector ya existe' })
            }
            res.status(500).json({ error: e.message })
        }
    })

    // PUT /sectores/:id
    r.put('/:id', (req, res) => {
        const id = Number(req.params.id)
        const { nombre, descripcion } = req.body
        if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' })
        try {
            const stmt = db.prepare('UPDATE sectores SET nombre = ?, descripcion = ? WHERE id = ?')
            const result = stmt.run(nombre, descripcion || null, id)
            if (result.changes === 0) return res.status(404).json({ error: 'Sector no encontrado' })
            res.json({ ok: true })
        } catch (e) {
            if (e.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'El nombre del sector ya existe' })
            }
            res.status(500).json({ error: e.message })
        }
    })

    // DELETE /sectores/:id
    r.delete('/:id', (req, res) => {
        const id = Number(req.params.id)
        try {
            // Check for usage in tickers
            const usage = db.prepare('SELECT COUNT(*) as c FROM tickers WHERE sector_id = ?').get(id).c
            if (usage > 0) return res.status(400).json({ error: 'No se puede eliminar: el sector está asignado a una o más empresas' })

            const stmt = db.prepare('DELETE FROM sectores WHERE id = ?')
            const result = stmt.run(id)
            if (result.changes === 0) return res.status(404).json({ error: 'Sector no encontrado' })
            res.json({ ok: true })
        } catch (e) {
            res.status(500).json({ error: e.message })
        }
    })

    return r
}
