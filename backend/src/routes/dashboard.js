import express from 'express'

export function dashboardRouter(db){
  const r = express.Router()
  
  r.get('/series', (req,res)=>{
    try {
      const range = (req.query.range || 'all')
      let from = '1970-01-01'
      const now = new Date()
      const map = { '1w':7, '1m':30, '3m':90, '6m':180, '1y':365, 'ytd':'ytd' }
      
      // Obtener la fecha de la inversión más antigua
      const primeraInversion = db.prepare('SELECT MIN(fecha) as fecha FROM inversiones').get()
      const fechaPrimeraInversion = primeraInversion?.fecha || '1970-01-01'
      
      if (map[range] && map[range] !== 'ytd'){
        const d = new Date(); d.setDate(now.getDate()-map[range]); 
        const fechaRango = d.toISOString().slice(0,10)
        // Usar la fecha más reciente entre el rango seleccionado y la primera inversión
        from = fechaRango > fechaPrimeraInversion ? fechaRango : fechaPrimeraInversion
      } else if (range === 'ytd'){
        const d = new Date(now.getFullYear(),0,1); 
        const fechaYtd = d.toISOString().slice(0,10)
        // Usar la fecha más reciente entre YTD y la primera inversión
        from = fechaYtd > fechaPrimeraInversion ? fechaYtd : fechaPrimeraInversion
      } else {
        // Para 'all', usar la fecha de la primera inversión
        from = fechaPrimeraInversion
      }

      // Consulta mejorada: usa el último precio conocido si no hay precio en la fecha exacta
      const data = db.prepare(`
        WITH fechas_validas AS (
          SELECT DISTINCT ph.fecha
          FROM precios_historicos ph
          INNER JOIN inversiones i ON i.ticker_id = ph.ticker_id
          WHERE ph.fecha >= ?
          AND ph.fecha >= (SELECT MIN(fecha) FROM inversiones)
          ORDER BY ph.fecha
        ),
        portfolio_por_fecha AS (
          SELECT 
            fv.fecha,
            t.id as ticker_id,
            t.moneda,
            SUM(CASE WHEN i.fecha <= fv.fecha THEN i.importe ELSE 0 END) as inversion_acumulada,
            SUM(CASE WHEN i.fecha <= fv.fecha THEN i.cantidad ELSE 0 END) as cantidad_acumulada,
            -- Usar el último precio conocido hasta esa fecha (no necesariamente de ese día)
            (SELECT ph2.precio 
             FROM precios_historicos ph2 
             WHERE ph2.ticker_id = t.id 
             AND ph2.fecha <= fv.fecha 
             ORDER BY ph2.fecha DESC 
             LIMIT 1) as precio
          FROM fechas_validas fv
          CROSS JOIN tickers t
          LEFT JOIN inversiones i ON i.ticker_id = t.id
          GROUP BY fv.fecha, t.id, t.moneda
          HAVING cantidad_acumulada > 0
        )
        SELECT 
          pdf.fecha,
          SUM(CASE 
            WHEN pdf.moneda = 'USD' THEN pdf.inversion_acumulada
            ELSE pdf.inversion_acumulada / COALESCE(tc.usd_pen, 3.5)
          END) as inversionUsd,
          SUM(CASE 
            WHEN pdf.moneda = 'USD' THEN pdf.cantidad_acumulada * COALESCE(pdf.precio, 0)
            ELSE (pdf.cantidad_acumulada * COALESCE(pdf.precio, 0)) / COALESCE(tc.usd_pen, 3.5)
          END) as balanceUsd
        FROM portfolio_por_fecha pdf
        LEFT JOIN tipos_cambio tc ON tc.fecha = (
          SELECT MAX(fecha) FROM tipos_cambio WHERE fecha <= pdf.fecha
        )
        GROUP BY pdf.fecha
        ORDER BY pdf.fecha
      `).all(from)

      res.json({ items: data })
    } catch (error) {
      console.error('Error en dashboard series:', error)
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  })

  // Endpoint para obtener información sobre la primera inversión
  r.get('/info', (req,res)=>{
    try {
      const primeraInversion = db.prepare('SELECT MIN(fecha) as fecha FROM inversiones').get()
      const ultimaInversion = db.prepare('SELECT MAX(fecha) as fecha FROM inversiones').get()
      const totalInversiones = db.prepare('SELECT COUNT(*) as count FROM inversiones').get()
      
      res.json({ 
        primeraInversion: primeraInversion?.fecha || null,
        ultimaInversion: ultimaInversion?.fecha || null,
        totalInversiones: totalInversiones?.count || 0
      })
    } catch (error) {
      console.error('Error en dashboard info:', error)
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  })
  
  return r
}