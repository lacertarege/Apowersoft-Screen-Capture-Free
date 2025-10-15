import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export function createDb(dbPath) {
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const db = new Database(dbPath)
  return db
}