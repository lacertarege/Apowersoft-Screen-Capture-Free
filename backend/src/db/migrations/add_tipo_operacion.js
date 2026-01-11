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

console.log('=== Migración: Agregar tipo_operacion a inversiones ===')
console.log(`Base de datos: ${dbPath}`)

async function runMigration() {
    try {
        const db = new Database(dbPath)

        // Verificar si la columna ya existe
        const tableInfo = db.prepare('PRAGMA table_info(inversiones)').all()
        const columnExists = tableInfo.some(col => col.name === 'tipo_operacion')

        if (columnExists) {
            console.log('⚠️  La columna tipo_operacion ya existe. Migración omitida.')
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
        const backupPath = join(backupDir, `investments_pre_tipo_operacion_${timestamp}.db`)
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
            // 1. Agregar columna tipo_operacion con CHECK constraint
            console.log('1️⃣  Agregando columna tipo_operacion...')
            db.exec(`
        ALTER TABLE inversiones 
        ADD COLUMN tipo_operacion TEXT DEFAULT 'INVERSION' 
        CHECK(tipo_operacion IN ('INVERSION', 'DESINVERSION'))
      `)

            // 2. Actualizar registros existentes a 'INVERSION'
            console.log('2️⃣  Marcando registros existentes como INVERSION...')
            const updateResult = db.prepare(`
        UPDATE inversiones 
        SET tipo_operacion = 'INVERSION' 
        WHERE tipo_operacion IS NULL OR tipo_operacion = ''
      `).run()
            console.log(`   ✓ ${updateResult.changes} registros actualizados`)

            // 3. Crear índice compuesto para optimizar queries
            console.log('3️⃣  Creando índice idx_inversiones_tipo_fecha...')
            db.exec(`
        CREATE INDEX IF NOT EXISTS idx_inversiones_tipo_fecha 
        ON inversiones(ticker_id, tipo_operacion, fecha)
      `)

            // Commit transaction
            db.exec('COMMIT')
            console.log('✅ Transacción confirmada')

            // Verificar resultados
            console.log('\n📋 Verificación post-migración:')
            const verification = db.prepare(`
        SELECT tipo_operacion, COUNT(*) as total 
        FROM inversiones 
        GROUP BY tipo_operacion
      `).all()

            verification.forEach(row => {
                console.log(`   ${row.tipo_operacion}: ${row.total} registros`)
            })

            // Verificar estructura de tabla
            const newTableInfo = db.prepare('PRAGMA table_info(inversiones)').all()
            const tipoOperacionCol = newTableInfo.find(col => col.name === 'tipo_operacion')

            if (tipoOperacionCol) {
                console.log('\n✅ Columna tipo_operacion agregada exitosamente')
                console.log(`   Tipo: ${tipoOperacionCol.type}`)
                console.log(`   Nullable: ${tipoOperacionCol.notnull === 0 ? 'Sí' : 'No'}`)
                console.log(`   Default: ${tipoOperacionCol.dflt_value}`)
            }

            // Verificar índice
            const indexes = db.prepare(`PRAGMA index_list(inversiones)`).all()
            const newIndex = indexes.find(idx => idx.name === 'idx_inversiones_tipo_fecha')
            if (newIndex) {
                console.log('\n✅ Índice idx_inversiones_tipo_fecha creado exitosamente')
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
