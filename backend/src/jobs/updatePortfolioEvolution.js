/**
 * Job para calcular y actualizar la evolución día a día del portafolio
 * Este job calcula el valor del portafolio para cada día desde la primera inversión hasta ayer
 */

import { getLimaDate } from '../utils/date.js'

export async function updatePortfolioEvolutionJob(db, forceFull = false) {
  console.log('Iniciando actualización de evolución del portafolio...')

  try {
    // Obtener fecha de primera inversión
    const primeraInversion = db.prepare('SELECT MIN(fecha) as fecha FROM inversiones').get()
    if (!primeraInversion || !primeraInversion.fecha) {
      console.log('No hay inversiones registradas, saltando actualización')
      return
    }

    const fechaPrimeraInversion = primeraInversion.fecha

    // Obtener fecha de ayer en Lima
    const hoyLima = getLimaDate()
    const d = new Date(hoyLima)
    d.setUTCDate(d.getUTCDate() - 1)
    const hasta = d.toISOString().slice(0, 10)

    // Determinar desde qué fecha actualizar
    let desde = fechaPrimeraInversion
    if (!forceFull) {
      // En modo incremental, actualizar solo desde la última fecha calculada
      const ultimaFecha = db.prepare('SELECT MAX(fecha) as fecha FROM portfolio_evolucion_diaria').get()
      if (ultimaFecha && ultimaFecha.fecha) {
        // Empezar desde el día siguiente a la última fecha calculada
        const fechaUltima = new Date(ultimaFecha.fecha)
        fechaUltima.setDate(fechaUltima.getDate() + 1)
        desde = fechaUltima.toISOString().slice(0, 10)

        // Si la última fecha es más reciente que ayer, no hay nada que actualizar
        if (desde > hasta) {
          console.log('Evolución del portafolio ya está actualizada hasta', hasta)
          return
        }
      }
    }

    console.log(`Calculando evolución desde ${desde} hasta ${hasta}`)

    // Preparar statement para insertar/actualizar
    const upsertStmt = db.prepare(`
      INSERT INTO portfolio_evolucion_diaria (fecha, inversion_usd, balance_usd, rendimiento_usd, rentabilidad_porcentaje, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(fecha) DO UPDATE SET
        inversion_usd = excluded.inversion_usd,
        balance_usd = excluded.balance_usd,
        rendimiento_usd = excluded.rendimiento_usd,
        rentabilidad_porcentaje = excluded.rentabilidad_porcentaje,
        updated_at = excluded.updated_at
    `)

    // Calcular evolución para cada fecha
    const data = db.prepare(`
      WITH RECURSIVE fechas_dias AS (
        SELECT DATE(?) as fecha
        UNION ALL
        SELECT DATE(fecha, '+1 day')
        FROM fechas_dias
        WHERE fecha < DATE(?)
      ),
      portfolio_por_fecha AS (
        SELECT 
          fd.fecha,
          t.id as ticker_id,
          t.moneda,
          SUM(CASE WHEN i.fecha <= fd.fecha THEN i.importe ELSE 0 END) as inversion_acumulada,
          SUM(CASE WHEN i.fecha <= fd.fecha THEN i.cantidad ELSE 0 END) as cantidad_acumulada,
          -- Usar el último precio conocido hasta esa fecha
          (SELECT ph2.precio 
           FROM precios_historicos ph2 
           WHERE ph2.ticker_id = t.id 
           AND ph2.fecha <= fd.fecha 
           ORDER BY ph2.fecha DESC 
           LIMIT 1) as precio
        FROM fechas_dias fd
        CROSS JOIN tickers t
        LEFT JOIN inversiones i ON i.ticker_id = t.id
        WHERE fd.fecha >= (SELECT MIN(fecha) FROM inversiones)
        GROUP BY fd.fecha, t.id, t.moneda
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
      WHERE pdf.fecha >= ?
      GROUP BY pdf.fecha
      ORDER BY pdf.fecha
    `).all(desde, hasta, desde)

    // Insertar/actualizar en la tabla
    let insertados = 0
    let actualizados = 0

    for (const row of data) {
      const inversionUsd = Number(row.inversionUsd || 0)
      const balanceUsd = Number(row.balanceUsd || 0)
      const rendimientoUsd = balanceUsd - inversionUsd
      const rentabilidadPorcentaje = inversionUsd > 0 ? (rendimientoUsd / inversionUsd) * 100 : 0

      // Verificar si ya existe
      const existe = db.prepare('SELECT fecha FROM portfolio_evolucion_diaria WHERE fecha = ?').get(row.fecha)

      upsertStmt.run(
        row.fecha,
        inversionUsd,
        balanceUsd,
        rendimientoUsd,
        rentabilidadPorcentaje,
        new Date().toISOString()
      )

      if (existe) {
        actualizados++
      } else {
        insertados++
      }
    }

    console.log(`✓ Evolución del portafolio actualizada: ${insertados} nuevos, ${actualizados} actualizados`)
    return { insertados, actualizados, total: data.length }
  } catch (error) {
    console.error('Error actualizando evolución del portafolio:', error)
    throw error
  }
}

