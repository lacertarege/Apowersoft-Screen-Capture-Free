import fs from 'node:fs'
import path from 'node:path'
import { createDb } from '../setup/db.js'

export default function backup(sourceDb) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const backupName = `investments-backup-${timestamp}.db`
  const backupPath = path.join(process.cwd(), 'backups', backupName)

  // Crear directorio de backups si no existe
  const backupDir = path.dirname(backupPath)
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  // Crear backup usando SQLite backup API
  const backupDb = createDb(backupPath)
  
  try {
    sourceDb.backup(backupDb, { progress: ({ totalPages, remainingPages }) => {
      const percent = Math.round(((totalPages - remainingPages) / totalPages) * 100)
      if (percent % 10 === 0) {
        console.log(`Backup progress: ${percent}%`)
      }
    }})
    
    console.log(`✓ Backup creado exitosamente: ${backupPath}`)
    console.log(`  Tamaño: ${Math.round(fs.statSync(backupPath).size / 1024)} KB`)
    
    return backupPath
  } catch (error) {
    console.error('Error creando backup:', error)
    // Limpiar archivo parcial si hay error
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath)
    }
    throw error
  } finally {
    backupDb.close()
  }
}

// Script standalone para ejecutar desde línea de comandos
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbPath = process.env.DB_PATH || './data/investments.db'
  
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Base de datos no encontrada en ${dbPath}`)
    process.exit(1)
  }

  console.log(`Creando backup de: ${dbPath}`)
  
  try {
    const sourceDb = createDb(dbPath)
    const backupPath = backup(sourceDb)
    sourceDb.close()
    
    console.log('\n📁 Backup completado exitosamente')
    console.log(`   Archivo: ${path.basename(backupPath)}`)
    console.log(`   Ubicación: ${path.dirname(backupPath)}`)
  } catch (error) {
    console.error('\n❌ Error durante el backup:', error.message)
    process.exit(1)
  }
}