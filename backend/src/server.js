import 'dotenv/config'
import express from 'express'
import cron from 'node-cron'
import { createDb } from './setup/db.js'
import { buildRoutes } from './setup/routes.js'
import { startJobs } from './setup/jobs.js'
import logger from './utils/logger.js'

async function startServer() {
  try {
    const app = express()
    app.use(express.json())

    // Crear conexión a la base de datos
    const dbPath = process.env.DB_PATH || './data/investments.db'
    const db = createDb(dbPath)
    logger.info('Base de datos conectada', { path: dbPath })
    
    // Configurar SQLite
    db.pragma('foreign_keys = ON')
    db.pragma('journal_mode = WAL')
    logger.info('Configuración SQLite aplicada')

    // Ejecutar migraciones solo si es necesario
    try {
      await (await import('./db/migrate.js')).default(db)
      logger.info('Migraciones ejecutadas')
    } catch (error) {
      logger.warn('Error en migraciones (puede ser normal si la DB ya existe):', error.message)
    }
    
    // NO ejecutar seed si ya hay datos - solo para bases de datos nuevas
    try {
      const existingData = db.prepare('SELECT COUNT(*) as count FROM tickers').get()
      if (existingData.count === 0) {
        await (await import('./db/seed.js')).default(db)
        logger.info('Datos iniciales cargados (base de datos nueva)')
      } else {
        logger.info('Base de datos existente detectada - preservando datos')
      }
    } catch (error) {
      logger.warn('Error verificando datos existentes:', error.message)
    }

    // Configurar rutas
    buildRoutes(app, db)
    logger.info('Rutas configuradas')

    // Verificación al iniciar: identificar fechas faltantes desde 2023-05-16 y en los últimos 7 días
    try {
      const missingRecent = db.prepare(`WITH RECURSIVE dates(d) AS (
        SELECT DATE('now','-7 day')
        UNION ALL
        SELECT DATE(d,'+1 day') FROM dates WHERE d < DATE('now')
      ) SELECT d FROM dates WHERE d NOT IN (SELECT fecha FROM tipos_cambio)`).all()
      if (missingRecent.length) {
        console.log(`Fechas recientes de tipo_cambio faltantes: ${missingRecent.length}. Iniciando backfill incremental...`)
        ;(async ()=>{
          const { backfillFxJob } = await import('./jobs/backfillFx.js')
          await backfillFxJob(db, false)
        })()
      }
    } catch (e) { 
      console.error('Error verificando tipos_cambio al iniciar', e) 
    }

    // Iniciar jobs programados
    startJobs(db)
    logger.info('Jobs programados iniciados')

    const port = process.env.PORT || 3001
    app.listen(port, () => {
      logger.info('Backend iniciado', { port, url: `http://localhost:${port}` })
      console.log(`✓ Backend escuchando en puerto ${port}`)
      console.log(`✓ API disponible en: http://localhost:${port}`)
    })
  } catch (error) {
    logger.error('Error al iniciar el servidor', { error: error.message, stack: error.stack })
    console.error('❌ Error al iniciar el servidor:', error)
    process.exit(1)
  }
}

startServer()