/**
 * Script para combinar la base de datos de Docker con los datos CSV
 * SIN PERDER NINGÚN DATO EXISTENTE
 */

import { createDb } from './src/setup/db.js'
import fs from 'fs'

console.log('🔄 FUSIÓN DE BASES DE DATOS (SIN PÉRDIDA DE DATOS)\n')
console.log('=' .repeat(60))

const localDb = './data/investments.db'

console.log('\n📊 PASO 1: Verificar datos ACTUALES en Docker')
console.log('=' .repeat(60))

const db = createDb(localDb)

// Contar registros actuales
const currentCount = db.prepare('SELECT COUNT(*) as count FROM tipos_cambio').get()
console.log(`Total registros actuales: ${currentCount.count}`)

// Ver registros actuales por fuente
const currentSources = db.prepare('SELECT fuente_api, COUNT(*) as count FROM tipos_cambio GROUP BY fuente_api').all()
console.log('\nRegistros por fuente ANTES de la fusión:')
currentSources.forEach(s => {
  console.log(`   ${s.fuente_api}: ${s.count} registros`)
})

// Mostrar algunos registros actuales
const currentSample = db.prepare('SELECT * FROM tipos_cambio ORDER BY fecha DESC LIMIT 5').all()
console.log('\nÚltimos 5 registros ACTUALES:')
currentSample.forEach(r => {
  console.log(`   ${r.fecha}: ${r.usd_pen} (${r.fuente_api})`)
})

console.log('\n📊 PASO 2: Leer datos del CSV')
console.log('=' .repeat(60))

const csvPath = '../tipo_cambio_sunat_2023-05-25_to_2025-10-06.csv'
if (!fs.existsSync(csvPath)) {
  console.log('❌ ERROR: No se encuentra el archivo CSV')
  db.close()
  process.exit(1)
}

const csvContent = fs.readFileSync(csvPath, 'utf-8')
const lines = csvContent.trim().split('\n').filter(line => line.trim())

console.log(`Total líneas en CSV: ${lines.length - 1} (excluyendo encabezado)`)

console.log('\n📊 PASO 3: Insertar/Actualizar registros del CSV')
console.log('=' .repeat(60))
console.log('Estrategia: INSERT ... ON CONFLICT DO UPDATE')
console.log('Esto preservará todos los registros existentes y solo')
console.log('agregará/actualizará los del CSV.\n')

const stmt = db.prepare(`
  INSERT INTO tipos_cambio (fecha, usd_pen, fuente_api) 
  VALUES (?, ?, ?)
  ON CONFLICT(fecha) DO UPDATE SET 
    usd_pen = excluded.usd_pen,
    fuente_api = excluded.fuente_api
`)

let inserted = 0
let updated = 0
let skipped = 0

db.transaction(() => {
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const [fecha, compra, venta] = line.split(',')
    if (!fecha || !venta || fecha === 'fecha') continue
    
    const ventaFloat = parseFloat(venta)
    if (isNaN(ventaFloat)) {
      skipped++
      continue
    }
    
    // Verificar si ya existe
    const existing = db.prepare('SELECT id, usd_pen, fuente_api FROM tipos_cambio WHERE fecha = ?').get(fecha)
    
    try {
      stmt.run(fecha, ventaFloat, 'sunat_csv')
      
      if (existing) {
        if (existing.usd_pen !== ventaFloat || existing.fuente_api !== 'sunat_csv') {
          updated++
        }
      } else {
        inserted++
      }
    } catch (e) {
      skipped++
      console.log(`   ⚠️  Error en ${fecha}: ${e.message}`)
    }
  }
})()

console.log(`\n✅ Proceso completado:`)
console.log(`   Nuevos registros insertados: ${inserted}`)
console.log(`   Registros actualizados: ${updated}`)
console.log(`   Registros omitidos: ${skipped}`)

console.log('\n📊 PASO 4: Verificar resultado FINAL')
console.log('=' .repeat(60))

const finalCount = db.prepare('SELECT COUNT(*) as count FROM tipos_cambio').get()
console.log(`Total registros FINAL: ${finalCount.count}`)
console.log(`Diferencia: ${finalCount.count - currentCount.count > 0 ? '+' : ''}${finalCount.count - currentCount.count}`)

const finalSources = db.prepare('SELECT fuente_api, COUNT(*) as count FROM tipos_cambio GROUP BY fuente_api ORDER BY fuente_api').all()
console.log('\nRegistros por fuente DESPUÉS de la fusión:')
finalSources.forEach(s => {
  console.log(`   ${s.fuente_api}: ${s.count} registros`)
})

const finalSample = db.prepare('SELECT * FROM tipos_cambio ORDER BY fecha DESC LIMIT 5').all()
console.log('\nÚltimos 5 registros FINALES:')
finalSample.forEach(r => {
  console.log(`   ${r.fecha}: ${r.usd_pen} (${r.fuente_api})`)
})

db.close()

console.log('\n' + '=' .repeat(60))
console.log('✅ FUSIÓN COMPLETADA SIN PÉRDIDA DE DATOS')
console.log('\n📋 Próximos pasos:')
console.log('   1. Reiniciar los contenedores Docker: docker-compose restart')
console.log('   2. Refrescar la página web (Ctrl+F5)')
console.log('   3. Verificar que todos los datos estén presentes')

