import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Ruta a la base de datos
const dbPath = process.env.DB_PATH || join(__dirname, '..', '..', 'data', 'investments.db')

console.log('=== Migración: Crear tabla benchmark_cache ===')
console.log(`Base de datos: ${dbPath}`)

async function runMigration() {
    try {
        const db = new Database(dbPath)

        // Verificar si la tabla ya existe
        const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='benchmark_cache'
    `).get()

        if (tableExists) {
            console.log('⚠️  La tabla benchmark_cache ya existe. Migración omitida.')
            db.close()
            process.exit(0)
        }

        console.log('📋 Iniciando migración...')

        // Crear directorio de backup si no existe
        const backupDir = join(__dirname, '..', '..', 'backups')
        if (!existsSync(backupDir)) {
            mkdirSync(backupDir, { recursive: true })
            console.log(`📁 Directorio de backups creado: ${backupDir}`)
        }

        // Crear backup antes de modificar
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
        const backupPath = join(backupDir, `investments_pre_benchmark_cache_${timestamp}.db`)
        console.log(`📦 Creando backup en: ${backupPath}`)

        try {
            await db.backup(backupPath)
            console.log('✅ Backup creado exitosamente')
        } catch (err) {
            console.error('❌ Error creando backup:', err)
            throw err
        }

        // Iniciar transacción
        db.exec('BEGIN TRANSACTION')

        try {
            // Crear tabla benchmark_cache
            console.log('1️⃣  Creando tabla benchmark_cache...')
            db.exec(`
        CREATE TABLE benchmark_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticker TEXT NOT NULL,
          year INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          return_pct NUMERIC(10,4),
          cached_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(ticker, year)
        )
      `)

            // Crear índice compuesto para lookups rápidos
            console.log('2️⃣  Creando índice idx_benchmark_cache_ticker_year...')
            db.exec(`
        CREATE INDEX idx_benchmark_cache_ticker_year 
        ON benchmark_cache(ticker, year)
      `)

            // Crear índice para limpieza de caché expirado
            console.log('3️⃣  Creando índice idx_benchmark_cache_cached_at...')
            db.exec(`
        CREATE INDEX idx_benchmark_cache_cached_at 
        ON benchmark_cache(cached_at)
      `)

            // Commit transaction
            db.exec('COMMIT')
            console.log('✅ Transacción confirmada')

            // Verificar estructura de tabla
            console.log('\n📋 Verificación post-migración:')
            const tableInfo = db.prepare('PRAGMA table_info(benchmark_cache)').all()
            console.log(`   Columnas creadas: ${tableInfo.length}`)
            tableInfo.forEach(col => {
                console.log(`   - ${col.name} (${col.type})`)
            })

            // Verificar índices
            const indexes = db.prepare('PRAGMA index_list(benchmark_cache)').all()
            console.log(`\n   Índices creados: ${indexes.length}`)
            indexes.forEach(idx => {
                console.log(`   - ${idx.name}`)
            })

            console.log('\n🎉 Migración completada exitosamente!')

        } catch (error) {
            // Rollback en caso de error
            db.exec('ROLLBACK')
            console.error('\n❌ Error durante la migración. Transacción revertida.')
            throw error
        }

        db.close()

    } catch (error) {
        console.error('\n💥 Error fatal:', error)
        process.exit(1)
    }
}

// Ejecutar migración
runMigration()
