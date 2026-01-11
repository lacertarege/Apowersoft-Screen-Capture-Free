import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Ruta a la base de datos (usar la misma que el servidor)
const dbPath = process.env.DB_PATH || join(__dirname, '..', '..', 'data', 'investments.db')

console.log('=== Migración: Agregar origen_capital a inversiones ===')
console.log(`Base de datos: ${dbPath}`)

async function runMigration() {
    try {
        const db = new Database(dbPath)

        // Verificar si la columna ya existe
        const tableInfo = db.prepare('PRAGMA table_info(inversiones)').all()
        const columnExists = tableInfo.some(col => col.name === 'origen_capital')

        if (columnExists) {
            console.log('⚠️  La columna origen_capital ya existe. Migración omitida.')
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
        const backupPath = join(backupDir, `investments_pre_origen_capital_${timestamp}.db`)
        console.log(`📦 Creando backup en: ${backupPath}`)

        try {
            await db.backup(backupPath)
            console.log('✅ Backup creado exitosamente')
        } catch (err) {
            console.error('❌ Error creando backup:', err)
            throw err
        }

        // Contar registros actuales
        const count = db.prepare('SELECT COUNT(*) as total FROM inversiones').get()
        console.log(`📊 Registros actuales en inversiones: ${count.total}`)

        // Iniciar transacción
        db.exec('BEGIN TRANSACTION')

        try {
            // 1. Agregar columna origen_capital con CHECK constraint
            console.log('1️⃣  Agregando columna origen_capital...')
            db.exec(`
        ALTER TABLE inversiones 
        ADD COLUMN origen_capital TEXT DEFAULT 'FRESH_CASH' 
        CHECK(origen_capital IN ('FRESH_CASH', 'REINVERSION'))
      `)

            // 2. Actualizar registros existentes a 'FRESH_CASH'
            console.log('2️⃣  Marcando registros existentes como FRESH_CASH...')
            const updateResult = db.prepare(`
        UPDATE inversiones 
        SET origen_capital = 'FRESH_CASH' 
        WHERE origen_capital IS NULL OR origen_capital = ''
      `).run()
            console.log(`   ✓ ${updateResult.changes} registros actualizados`)

            // Commit transaction
            db.exec('COMMIT')
            console.log('✅ Transacción confirmada')

            // Verificar resultados
            console.log('\n📋 Verificación post-migración:')
            const verification = db.prepare(`
        SELECT origen_capital, COUNT(*) as total 
        FROM inversiones 
        GROUP BY origen_capital
      `).all()

            verification.forEach(row => {
                console.log(`   ${row.origen_capital}: ${row.total} registros`)
            })

            // Verificar estructura de tabla
            const newTableInfo = db.prepare('PRAGMA table_info(inversiones)').all()
            const origenCapitalCol = newTableInfo.find(col => col.name === 'origen_capital')

            if (origenCapitalCol) {
                console.log('\n✅ Columna origen_capital agregada exitosamente')
                console.log(`   Tipo: ${origenCapitalCol.type}`)
                console.log(`   Nullable: ${origenCapitalCol.notnull === 0 ? 'Sí' : 'No'}`)
                console.log(`   Default: ${origenCapitalCol.dflt_value}`)
            }

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
