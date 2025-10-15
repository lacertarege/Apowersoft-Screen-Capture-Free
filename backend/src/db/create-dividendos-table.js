/**
 * Script para crear la tabla de dividendos
 */

import { createDb } from '../setup/db.js'

console.log('📊 CREANDO TABLA DE DIVIDENDOS\n')
console.log('=' .repeat(60))

const dbPath = process.env.DB_PATH || './data/investments.db'
const db = createDb(dbPath)

try {
  // Crear tabla dividendos
  db.prepare(`
    CREATE TABLE IF NOT EXISTS dividendos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      monto NUMERIC(14,6) NOT NULL,
      moneda TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticker_id) REFERENCES tickers(id) ON DELETE CASCADE,
      UNIQUE(ticker_id, fecha)
    )
  `).run()

  console.log('✅ Tabla "dividendos" creada exitosamente')

  // Crear índices para mejorar el rendimiento
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dividendos_ticker_id 
    ON dividendos(ticker_id)
  `).run()

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dividendos_fecha 
    ON dividendos(fecha)
  `).run()

  console.log('✅ Índices creados exitosamente')

  // Verificar estructura
  const columns = db.prepare('PRAGMA table_info(dividendos)').all()
  console.log('\n📋 Estructura de la tabla:')
  columns.forEach(col => {
    const pk = col.pk ? ' [PK]' : ''
    const notNull = col.notnull ? ' NOT NULL' : ''
    console.log(`   - ${col.name} (${col.type})${pk}${notNull}`)
  })

  // Insertar datos de ejemplo (opcional)
  console.log('\n💡 Tabla lista para recibir dividendos')
  console.log('   Estructura: ticker_id, fecha, monto, moneda')

} catch (e) {
  console.error('❌ Error:', e.message)
  process.exit(1)
} finally {
  db.close()
}

console.log('\n' + '=' .repeat(60))
console.log('✅ PROCESO COMPLETADO\n')

