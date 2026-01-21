import express from 'express'

export function dividendosRouter(db) {
  const r = express.Router()

  // =========================================================================
  // GET /dividendos/resumen
  // Obtiene resumen de dividendos agrupados por ticker y año
  // =========================================================================
  r.get('/resumen', (req, res) => {
    try {
      // Obtener todos los tickers con inversiones (acciones y ETFs)
      const tickersConInversiones = db.prepare(`
        SELECT DISTINCT 
          t.id,
          t.ticker,
          t.nombre,
          t.moneda,
          t.moneda,
          t.pais,
          ti.nombre as tipo_inversion
        FROM tickers t
        INNER JOIN inversiones i ON t.id = i.ticker_id
        INNER JOIN tipos_inversion ti ON t.tipo_inversion_id = ti.id
        WHERE ti.nombre IN ('Acciones', 'ETFs')
        ORDER BY t.ticker
      `).all()

      // Para cada ticker, obtener dividendos con conversión a PEN
      const resumen = tickersConInversiones.map(ticker => {
        // Obtener todos los dividendos del ticker con tipo de cambio
        const dividendosDetalle = db.prepare(`
          SELECT 
            d.id,
            d.fecha,
            d.monto,
            d.moneda,
            e.nombre as mercado,
            d.mercado as mercado_legacy,
            strftime('%Y', d.fecha) as anio,
            tc.usd_pen as tipo_cambio
          FROM dividendos d
          LEFT JOIN exchanges e ON d.exchange_id = e.id
          LEFT JOIN tipos_cambio tc ON d.fecha = tc.fecha
          WHERE d.ticker_id = ?
          ORDER BY d.fecha
        `).all(ticker.id)

        // Agrupar por año con conversión a PEN
        const dividendosPorAnio = {}
        const totalPorMoneda = { USD: 0, PEN: 0 }
        // Agrupar por año y mercado
        const dividendosPorAnioMercado = {}

        dividendosDetalle.forEach(d => {
          const anio = d.anio
          // Clasificar por origen según el país del ticker
          let mercado = 'Empresas Extranjeras'
          const paisNormalizado = (ticker.pais || '').toLowerCase()
          if (paisNormalizado === 'perú' || paisNormalizado === 'peru' || paisNormalizado === 'pe') {
            mercado = 'Empresas Peruanas'
          }

          if (!dividendosPorAnio[anio]) {
            dividendosPorAnio[anio] = { USD: 0, PEN: 0 }
          }

          // Inicializar estructura por año 
          if (!dividendosPorAnioMercado[anio]) {
            dividendosPorAnioMercado[anio] = {}
          }

          // Inicializar mercado si no existe
          if (!dividendosPorAnioMercado[anio][mercado]) {
            dividendosPorAnioMercado[anio][mercado] = { USD: 0, PEN: 0 }
          }

          // Sumar USD original
          if (d.moneda === 'USD') {
            dividendosPorAnio[anio].USD += parseFloat(d.monto)
            totalPorMoneda.USD += parseFloat(d.monto)
            dividendosPorAnioMercado[anio][mercado].USD += parseFloat(d.monto)

            // Convertir a PEN si hay tipo de cambio
            if (d.tipo_cambio) {
              const montoEnPen = parseFloat(d.monto) * parseFloat(d.tipo_cambio)
              dividendosPorAnio[anio].PEN += montoEnPen
              totalPorMoneda.PEN += montoEnPen
              dividendosPorAnioMercado[anio][mercado].PEN += montoEnPen
            }
          } else if (d.moneda === 'PEN') {
            // Si ya está en PEN, sumarlo directamente
            dividendosPorAnio[anio].PEN += parseFloat(d.monto)
            totalPorMoneda.PEN += parseFloat(d.monto)
            dividendosPorAnioMercado[anio][mercado].PEN += parseFloat(d.monto)
          }
        })

        // Limpiar valores en 0 o muy pequeños
        Object.keys(dividendosPorAnio).forEach(anio => {
          if (dividendosPorAnio[anio].USD < 0.01) delete dividendosPorAnio[anio].USD
          if (dividendosPorAnio[anio].PEN < 0.01) delete dividendosPorAnio[anio].PEN
        })

        if (totalPorMoneda.USD < 0.01) delete totalPorMoneda.USD
        if (totalPorMoneda.PEN < 0.01) delete totalPorMoneda.PEN

        return {
          ticker_id: ticker.id,
          ticker: ticker.ticker,
          nombre: ticker.nombre,
          moneda: ticker.moneda,
          tipo: ticker.tipo_inversion,
          dividendos_por_anio: dividendosPorAnio,
          dividendos_por_anio_mercado: dividendosPorAnioMercado,
          total_por_moneda: totalPorMoneda
        }
      })

      res.json({ items: resumen })
    } catch (e) {
      console.error('GET /dividendos/resumen error', e)
      res.status(500).json({ error: e.message })
    }
  })

  // =========================================================================
  // GET /dividendos/ticker/:ticker_id
  // Obtiene todos los dividendos de un ticker específico
  // =========================================================================
  r.get('/ticker/:ticker_id', (req, res) => {
    try {
      const { ticker_id } = req.params

      // Obtener información del ticker
      const ticker = db.prepare(`
        SELECT t.id, t.ticker, t.nombre, t.moneda
        FROM tickers t
        WHERE t.id = ?
      `).get(ticker_id)

      if (!ticker) {
        return res.status(404).json({ error: 'Ticker no encontrado' })
      }

      // Obtener todos los dividendos con nombre de plataforma
      const dividendos = db.prepare(`
        SELECT 
          d.id,
          d.fecha,
          d.monto,
          d.moneda,
          d.mercado,
          d.plataforma_id,
          p.nombre as plataforma,
          d.created_at
        FROM dividendos d
        LEFT JOIN plataformas p ON d.plataforma_id = p.id
        WHERE d.ticker_id = ?
        ORDER BY d.fecha DESC
      `).all(ticker_id)

      // Calcular total
      const total = dividendos.reduce((sum, d) => sum + parseFloat(d.monto), 0)

      res.json({
        ticker: ticker,
        dividendos: dividendos,
        total: total
      })
    } catch (e) {
      console.error('GET /dividendos/ticker/:ticker_id error', e)
      res.status(500).json({ error: e.message })
    }
  })

  // =========================================================================
  // POST /dividendos
  // Registra un nuevo dividendo
  // =========================================================================
  r.post('/', (req, res) => {
    try {
      const { ticker_id, fecha, monto, moneda, mercado, plataforma_id } = req.body

      // Validaciones
      if (!ticker_id || !fecha || monto == null || !moneda) {
        return res.status(400).json({
          error: 'ticker_id, fecha, monto y moneda son requeridos'
        })
      }

      if (parseFloat(monto) < 0) {
        return res.status(400).json({ error: 'El monto debe ser positivo' })
      }

      // Verificar que el ticker existe
      const ticker = db.prepare('SELECT id FROM tickers WHERE id = ?').get(ticker_id)
      if (!ticker) {
        return res.status(404).json({ error: 'Ticker no encontrado' })
      }

      // Resolve exchange_id
      let exchange_id = null
      if (mercado) {
        const ex = db.prepare('SELECT id FROM exchanges WHERE nombre = ?').get(mercado)
        if (ex) exchange_id = ex.id
      }

      // Insertar dividendo
      const info = db.prepare(`
        INSERT INTO dividendos (ticker_id, fecha, monto, moneda, mercado, plataforma_id, exchange_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(ticker_id, fecha, parseFloat(monto), moneda, mercado || null, plataforma_id || null, exchange_id)

      res.status(201).json({
        ok: true,
        id: info.lastInsertRowid
      })
    } catch (e) {
      console.error('POST /dividendos error', e)

      // Manejar duplicados
      if (e.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({
          error: 'Ya existe un dividendo para este ticker en esta fecha'
        })
      }

      res.status(500).json({ error: e.message })
    }
  })

  // =========================================================================
  // PATCH /dividendos/:id
  // Actualiza un dividendo existente
  // =========================================================================
  r.patch('/:id', (req, res) => {
    try {
      const { id } = req.params
      const { fecha, monto, moneda, mercado, plataforma_id } = req.body

      // Verificar que el dividendo existe
      const dividendo = db.prepare('SELECT id FROM dividendos WHERE id = ?').get(id)
      if (!dividendo) {
        return res.status(404).json({ error: 'Dividendo no encontrado' })
      }

      // Construir actualización dinámica
      const updates = []
      const params = []

      if (fecha !== undefined) {
        updates.push('fecha = ?')
        params.push(fecha)
      }
      if (monto !== undefined) {
        if (parseFloat(monto) < 0) {
          return res.status(400).json({ error: 'El monto debe ser positivo' })
        }
        updates.push('monto = ?')
        params.push(parseFloat(monto))
      }
      if (moneda !== undefined) {
        updates.push('moneda = ?')
        params.push(moneda)
      }
      if (mercado !== undefined) {
        updates.push('mercado = ?')
        params.push(mercado || null)
      }
      if (plataforma_id !== undefined) {
        updates.push('plataforma_id = ?')
        params.push(plataforma_id || null)
      }
      if (mercado !== undefined) {
        const ex = db.prepare('SELECT id FROM exchanges WHERE nombre = ?').get(mercado)
        updates.push('exchange_id = ?')
        params.push(ex ? ex.id : null)
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' })
      }

      params.push(id)
      db.prepare(`UPDATE dividendos SET ${updates.join(', ')} WHERE id = ?`).run(...params)

      res.json({ ok: true })
    } catch (e) {
      console.error('PATCH /dividendos/:id error', e)

      if (e.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({
          error: 'Ya existe un dividendo para este ticker en esta fecha'
        })
      }

      res.status(500).json({ error: e.message })
    }
  })

  // =========================================================================
  // DELETE /dividendos/:id
  // Elimina un dividendo
  // =========================================================================
  r.delete('/:id', (req, res) => {
    try {
      const { id } = req.params

      const result = db.prepare('DELETE FROM dividendos WHERE id = ?').run(id)

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Dividendo no encontrado' })
      }

      res.json({ ok: true })
    } catch (e) {
      console.error('DELETE /dividendos/:id error', e)
      res.status(500).json({ error: e.message })
    }
  })

  return r
}

