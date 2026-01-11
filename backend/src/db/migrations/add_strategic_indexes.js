import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Ruta a la base de datos
const dbPath = process.env.DB_PATH || join(__dirname, '..', '..', 'data', 'investments.db')

console.log('=== Optimización: Agregar índices estratégicos ===')
console.log(`Base de datos: ${dbPath}`)

async function runOptimization() {
    try {
        const db = new Database(dbPath)

        console.log('📋 Agregando índices estratégicos...\n')

        // Lista de índices a crear
        const indexes = [
            {
                name: 'idx_tickers_moneda_id',
                sql: 'CREATE INDEX IF NOT EXISTS idx_tickers_moneda_id ON tickers(moneda, id)',
                description: 'Optimizar queries filtradas por moneda'
            },
            {
                name: 'idx_tipos_cambio_fecha_usd',
                sql: 'CREATE INDEX IF NOT EXISTS idx_tipos_cambio_fecha_usd ON tipos_cambio(fecha, usd_pen)',
                description: 'Acelerar lookups de FX por fecha'
            },
            {
                name: 'idx_inversiones_fecha_ticker',
                sql: 'CREATE INDEX IF NOT EXISTS idx_inversiones_fecha_ticker ON inversiones(fecha, ticker_id)',
                description: 'Optimizar queries ordenadas por fecha'
            },
            {
                name: 'idx_precios_fecha',
                sql: 'CREATE INDEX IF NOT EXISTS idx_precios_fecha ON precios_historicos(fecha)',
                description: 'Acelerar búsquedas de precios por rango de fechas'
            }
        ]

        let created = 0
        let existed = 0

        for (const idx of indexes) {
            try {
                // Verificar si el índice ya existe
                const existingIndex = db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='index' AND name=?
        `).get(idx.name)

                if (existingIndex) {
                    console.log(`⏭️  ${idx.name}: Ya existe`)
                    existed++
                } else {
                    db.exec(idx.sql)
                    console.log(`✅ ${idx.name}: Creado`)
                    console.log(`   ${idx.description}`)
                    created++
                }
            } catch (error) {
                console.error(`❌ Error creando ${idx.name}:`, error.message)
            }
        }

        console.log(`\n📊 Resumen:`)
        console.log(`   Índices creados: ${created}`)
        console.log(`   Índices existentes: ${existed}`)
        console.log(`   Total: ${created + existed}`)

        // Mostrar todos los índices actuales
        console.log('\n🔍 Índices actuales en la base de datos:')
        const allIndexes = db.prepare(`
      SELECT name, tbl_name 
      FROM sqlite_master 
      WHERE type='index' 
      ORDER BY tbl_name, name
    `).all()

        const byTable = {}
        allIndexes.forEach(idx => {
            if (!byTable[idx.tbl_name]) byTable[idx.tbl_name] = []
            byTable[idx.tbl_name].push(idx.name)
        })

        Object.entries(byTable).forEach(([table, indexes]) => {
            console.log(`\n   ${table}:`)
            indexes.forEach(idx => console.log(`     - ${idx}`))
        })

        console.log('\n🎉 Optimización completada!')

        db.close()

    } catch (error) {
        console.error('\n💥 Error fatal:', error)
        process.exit(1)
    }
}

// Ejecutar optimización
runOptimization()
