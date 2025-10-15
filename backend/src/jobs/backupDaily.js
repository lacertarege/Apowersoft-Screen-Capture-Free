import Database from 'better-sqlite3'
import { join } from 'node:path'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'

const dbPath = join(process.cwd(), 'data', 'investments.db')
const backupsDir = join(process.cwd(), '..', 'backups')

// Crear directorio de backups si no existe
if (!existsSync(backupsDir)) {
  mkdirSync(backupsDir, { recursive: true })
}

const db = new Database(dbPath)

try {
  console.log('Iniciando backup diario...')
  
  // Crear timestamp para el nombre del archivo
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '-')
  const backupPath = join(backupsDir, `investments-backup-${timestamp}.db`)
  
  // Crear backup usando VACUUM INTO
  db.prepare(`VACUUM INTO '${backupPath}'`).run()
  
  console.log(`Backup diario creado: ${backupPath}`)
  
  // Limpiar backups antiguos (mantener solo los últimos 30 días)
  const files = require('fs').readdirSync(backupsDir)
    .filter(file => file.startsWith('investments-backup-') && file.endsWith('.db'))
    .map(file => ({
      name: file,
      path: join(backupsDir, file),
      time: require('fs').statSync(join(backupsDir, file)).mtime
    }))
    .sort((a, b) => b.time - a.time)
  
  // Eliminar backups más antiguos que 30 días
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const oldBackups = files.filter(file => file.time < thirtyDaysAgo)
  oldBackups.forEach(file => {
    try {
      require('fs').unlinkSync(file.path)
      console.log(`Backup antiguo eliminado: ${file.name}`)
    } catch (error) {
      console.warn(`Error eliminando backup antiguo ${file.name}:`, error.message)
    }
  })
  
  console.log('Backup diario completado exitosamente')
  
} catch (error) {
  console.error('Error en backup diario:', error)
  process.exit(1)
} finally {
  db.close()
}
