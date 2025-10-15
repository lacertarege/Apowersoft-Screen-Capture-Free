// Script de inicio seguro que preserva los datos
import 'dotenv/config'
import Database from 'better-sqlite3'
import fs from 'node:fs'

async function startSafe() {
  const dbPath = process.env.DB_PATH || './data/investments.db'
  
  console.log('🔍 Verificando integridad de datos antes del inicio...')
  
  try {
    // Verificar que la base de datos existe
    if (!fs.existsSync(dbPath)) {
      console.log('❌ Base de datos no encontrada. Creando nueva...')
      const { createDb } = await import('./src/setup/db.js')
      const db = createDb(dbPath)
      db.close()
    }
    
    // Conectar y verificar datos existentes
    const db = new Database(dbPath)
    db.pragma('foreign_keys = ON')
    db.pragma('journal_mode = WAL')
    
    // Verificar que hay datos
    const tickerCount = db.prepare('SELECT COUNT(*) as count FROM tickers').get()
    const inversionCount = db.prepare('SELECT COUNT(*) as count FROM inversiones').get()
    
    console.log(`📊 Datos encontrados:`)
    console.log(`   - Tickers: ${tickerCount.count}`)
    console.log(`   - Inversiones: ${inversionCount.count}`)
    
    if (tickerCount.count > 0 || inversionCount.count > 0) {
      console.log('✅ Datos existentes detectados - iniciando servidor en modo preservación')
    } else {
      console.log('⚠️  Base de datos vacía - se cargarán datos iniciales')
    }
    
    db.close()
    
    // Iniciar el servidor principal
    console.log('🚀 Iniciando servidor principal...')
    await import('./src/server.js')
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error.message)
    process.exit(1)
  }
}

startSafe()
