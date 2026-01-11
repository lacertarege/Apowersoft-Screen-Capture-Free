import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Determinar la ruta de la base de datos
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../../data/investments.db')

console.log('Ruta de la base de datos:', dbPath)

// Verificar que la base de datos existe
if (!fs.existsSync(dbPath)) {
    console.error(`❌ La base de datos no existe en: ${dbPath}`)
    process.exit(1)
}

// Crear directorio de backups si no existe
const backupDir = path.join(__dirname, '../../../backups')
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
}

// Crear backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = path.join(backupDir, `investments_before_realized_return_${timestamp}.db`)

console.log('Creando backup en:', backupPath)
fs.copyFileSync(dbPath, backupPath)
console.log('✓ Backup creado exitosamente')

// Abrir base de datos
const db = new Database(dbPath)

try {
    console.log('\n📋 Iniciando migración: Agregar columna realized_return...')

    // Verificar si la columna ya existe
    const tableInfo = db.prepare('PRAGMA table_info(inversiones)').all()
    const hasColumn = tableInfo.some(col => col.name === 'realized_return')

    if (hasColumn) {
        console.log('⚠️  La columna realized_return ya existe. Migración no necesaria.')
        process.exit(0)
    }

    // Agregar la columna
    db.prepare(`
    ALTER TABLE inversiones 
    ADD COLUMN realized_return REAL DEFAULT NULL
  `).run()

    console.log('✓ Columna realized_return agregada exitosamente')

    // Verificar
    const updatedInfo = db.prepare('PRAGMA table_info(inversiones)').all()
    const columnAdded = updatedInfo.some(col => col.name === 'realized_return')

    if (columnAdded) {
        console.log('✓ Verificación exitosa: La columna existe en la tabla')

        // Mostrar información de la tabla
        console.log('\n📊 Estructura actualizada de la tabla inversiones:')
        updatedInfo.forEach(col => {
            console.log(`  - ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`)
        })

        console.log('\n✅ Migración completada exitosamente')
    } else {
        throw new Error('La columna no se agregó correctamente')
    }

} catch (error) {
    console.error('\n❌ Error durante la migración:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
} finally {
    db.close()
}
