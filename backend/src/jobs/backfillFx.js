import { fetchUsdPenForDate } from '../sources/fx.js'

// Helper para generar intervalo aleatorio entre llamadas API
function randomDelay(minMs = 500, maxMs = 3000) {
  return new Promise(resolve => {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
    setTimeout(resolve, delay)
  })
}

export async function backfillFxJob(db, fullMode = false){
  let dates
  
  if (fullMode) {
    // Modo completo: desde 2023-05-16 hasta hoy
    dates = db.prepare(`WITH RECURSIVE dates(d) AS (
      SELECT DATE('2023-05-16')
      UNION ALL
      SELECT DATE(d,'+1 day') FROM dates WHERE d < DATE('now')
    ) SELECT d FROM dates WHERE d NOT IN (SELECT fecha FROM tipos_cambio WHERE fuente_api IS NOT NULL)`).all().map(r=>r.d)
    
    console.log(`backfillFxJob fullMode: ${dates.length} fechas pendientes desde 2023-05-16`)
  } else {
    // Modo incremental: últimos 7 días
    dates = db.prepare(`WITH RECURSIVE dates(d) AS (
      SELECT DATE('now','-7 day')
      UNION ALL
      SELECT DATE(d,'+1 day') FROM dates WHERE d < DATE('now')
    ) SELECT d FROM dates WHERE d NOT IN (SELECT fecha FROM tipos_cambio WHERE fuente_api IS NOT NULL)`).all().map(r=>r.d)
    
    console.log(`backfillFxJob incremental: ${dates.length} fechas pendientes`)
  }
  
  for (const d of dates){
    try {
      // Intervalo aleatorio para evitar sobrecargar la API
      if (dates.indexOf(d) > 0) {
        await randomDelay(500, 2000)
      }
      
      const rate = await fetchUsdPenForDate(d)
      db.prepare(`INSERT INTO tipos_cambio (fecha, usd_pen, fuente_api) VALUES (?,?,?)
        ON CONFLICT(fecha) DO UPDATE SET usd_pen=excluded.usd_pen, fuente_api=excluded.fuente_api`).run(d, rate, 'api')
      
      console.log(`✓ Tipo de cambio actualizado: ${d} = ${rate}`)
    } catch (e) {
      console.error('backfillFx error', d, e.message)
    }
  }
  
  console.log(`backfillFxJob completado: ${dates.length} fechas procesadas`)
}