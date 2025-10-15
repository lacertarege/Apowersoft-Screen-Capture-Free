/**
 * Script para eliminar la tabla presupuesto
 */

import { createDb } from './src/setup/db.js'

console.log('🗑️  ELIMINANDO TABLA PRESUPUESTO\n')
console.log('=' .repeat(60))

const dbPath = process.env.DB_PATH || './data/investments.db'
const db = createDb(dbPath)

// Verificar si la tabla existe
const tableExists = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name='presupuesto'
`).get()

if (!tableExists) {
  console.log('❌ La tabla presupuesto no existe')
  db.close()
  process.exit(0)
}

// Contar registros antes
const count = db.prepare('SELECT COUNT(*) as count FROM presupuesto').get()
console.log(`📊 Registros en la tabla: ${count.count}`)

if (count.count > 0) {
  console.log('\n⚠️  ADVERTENCIA: La tabla tiene datos')
  console.log('   ¿Estás seguro de que quieres eliminarla?')
} else {
  console.log('\n✓ La tabla está vacía, es seguro eliminarla')
}

// Eliminar la tabla
console.log('\n🗑️  Eliminando tabla presupuesto...')
db.prepare('DROP TABLE presupuesto').run()

console.log('✅ Tabla presupuesto eliminada exitosamente')

// Verificar que se eliminó
const stillExists = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name='presupuesto'
`).get()

if (!stillExists) {
  console.log('✓ Verificación: La tabla ya no existe')
} else {
  console.log('❌ Error: La tabla todavía existe')
}

// Listar tablas restantes
console.log('\n📋 Tablas restantes:')
const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' 
  AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all()

tables.forEach(t => console.log(`   - ${t.name}`))

db.close()

console.log('\n' + '=' .repeat(60))
console.log('✅ PROCESO COMPLETADO\n')

