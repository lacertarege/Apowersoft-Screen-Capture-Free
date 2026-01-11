import cron from 'node-cron'
import { updateDailyPricesJob } from '../jobs/updateDailyPrices.js'
import { backfillFxJob } from '../jobs/backfillFx.js'
import { updatePortfolioEvolutionJob } from '../jobs/updatePortfolioEvolution.js'
import { updateBenchmarksJob } from '../jobs/updateBenchmarks.js'
import { spawn } from 'node:child_process'
import { getLimaDate } from '../utils/date.js'

export function startJobs(db) {
  // 20:00 Lima time (system TZ provided as TZ env var in docker-compose)
  cron.schedule('0 20 * * *', async () => {
    try {
      await updateDailyPricesJob(db)
      await backfillFxJob(db, false)
      // Actualizar evolución del portafolio después de actualizar precios y tipos de cambio
      await updatePortfolioEvolutionJob(db, false)
      console.log('Cron 20:00 executed: precios diarios, FX últimos días y evolución del portafolio')
    } catch (e) {
      console.error('Cron 20:00 error', e)
    }
  })

  // 06:00 Lima time: actualizar tipo de cambio del día anterior
  cron.schedule('0 6 * * *', async () => {
    try {
      const hoy = getLimaDate()
      const yesterdayObj = new Date(hoy)
      yesterdayObj.setUTCDate(yesterdayObj.getUTCDate() - 1)
      const d = yesterdayObj.toISOString().slice(0, 10)
      await backfillFxJob(db, false) // asegura últimos días incluido ayer
      console.log('Cron 06:00 executed: tipo de cambio día anterior')
    } catch (e) {
      console.error('Cron 06:00 error', e)
    }
  })

  // 03:00 Lima time: actualizar caché de benchmarks
  cron.schedule('0 3 * * *', async () => {
    try {
      await updateBenchmarksJob(db)
      console.log('Cron 03:00 executed: benchmarks actualizados')
    } catch (e) {
      console.error('Cron 03:00 error', e)
    }
  })

  // 02:30 Lima time: intentar rellenar históricos desde las compras más antiguas
  cron.schedule('30 2 * * *', async () => {
    try {
      const { backfillHistoricalPrices } = await import('../jobs/backfillHistoricalPrices.js')
      await backfillHistoricalPrices(db)
      console.log('Cron 02:30 executed: backfill de históricos de acciones/ETFs')
    } catch (e) {
      console.error('Cron 02:30 error', e)
    }
  })

  // 01:00 Lima time: backup diario de la base de datos
  cron.schedule('0 1 * * *', () => {
    try {
      const backupProcess = spawn('node', ['src/jobs/backupDaily.js'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: true
      })

      backupProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('Cron 01:00 executed: backup diario completado')
        } else {
          console.error('Cron 01:00 error: backup diario falló con código', code)
        }
      })
    } catch (e) {
      console.error('Cron 01:00 error', e)
    }
  })
}
