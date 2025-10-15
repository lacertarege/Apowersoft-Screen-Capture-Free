// Script para limpiar duplicados en la tabla de inversiones
import Database from 'better-sqlite3'
import { join } from 'path'

export default function cleanupDuplicates() {
  const db = new Database(join(process.cwd(), 'data', 'investments.db'))
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')

  console.log('🔍 Buscando duplicados en inversiones...')

  // Encontrar duplicados
  const duplicates = db.prepare(`
    SELECT ticker_id, fecha, importe, cantidad, plataforma, COUNT(*) as count 
    FROM inversiones 
    GROUP BY ticker_id, fecha, importe, cantidad, plataforma 
    HAVING COUNT(*) > 1
  `).all()

  if (duplicates.length === 0) {
    console.log('✅ No se encontraron duplicados.')
    return
  }

  console.log(`❌ Se encontraron ${duplicates.length} grupos de duplicados:`)
  
  for (const dup of duplicates) {
    console.log(`  - Ticker ${dup.ticker_id}, Fecha: ${dup.fecha}, Cantidad: ${dup.count} duplicados`)
    
    // Obtener todos los registros duplicados para este grupo
    const records = db.prepare(`
      SELECT id FROM inversiones 
      WHERE ticker_id = ? AND fecha = ? AND importe = ? AND cantidad = ? AND plataforma = ?
      ORDER BY id
    `).all(dup.ticker_id, dup.fecha, dup.importe, dup.cantidad, dup.plataforma)
    
    // Mantener el primero (ID más bajo) y eliminar el resto
    const toDelete = records.slice(1)
    
    for (const record of toDelete) {
      const result = db.prepare('DELETE FROM inversiones WHERE id = ?').run(record.id)
      console.log(`    🗑️ Eliminado registro ID ${record.id}`)
    }
  }

  console.log('✅ Limpieza de duplicados completada.')
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDuplicates()
}
