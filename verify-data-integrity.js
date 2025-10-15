#!/usr/bin/env node

// Script para verificar la integridad de los datos en la base de datos
import 'dotenv/config'
import { createDb } from './backend/src/setup/db.js'

async function verifyDataIntegrity() {
  console.log('🔍 Verificando integridad de datos...\n')
  
  try {
    const db = createDb('./data/investments.db')
    db.pragma('foreign_keys = ON')
    db.pragma('journal_mode = WAL')
    
    // 1. Verificar estructura de tablas
    console.log('📋 Verificando estructura de tablas...')
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all()
    
    const expectedTables = ['tipos_inversion', 'tickers', 'inversiones', 'precios_historicos', 'tipos_cambio', 'presupuesto']
    const existingTables = tables.map(t => t.name)
    
    for (const table of expectedTables) {
      if (existingTables.includes(table)) {
        console.log(`  ✅ Tabla ${table}: OK`)
      } else {
        console.log(`  ❌ Tabla ${table}: FALTANTE`)
      }
    }
    
    // 2. Verificar vista de resumen
    console.log('\n📊 Verificando vista de resumen...')
    try {
      const viewTest = db.prepare('SELECT COUNT(*) as count FROM v_resumen_empresas').get()
      console.log(`  ✅ Vista v_resumen_empresas: OK (${viewTest.count} registros)`)
    } catch (error) {
      console.log(`  ❌ Vista v_resumen_empresas: ERROR - ${error.message}`)
    }
    
    // 3. Verificar integridad referencial
    console.log('\n🔗 Verificando integridad referencial...')
    
    // Tickers sin tipo de inversión
    const orphanTickers = db.prepare(`
      SELECT COUNT(*) as count FROM tickers t 
      LEFT JOIN tipos_inversion ti ON t.tipo_inversion_id = ti.id 
      WHERE ti.id IS NULL
    `).get()
    console.log(`  ${orphanTickers.count === 0 ? '✅' : '❌'} Tickers huérfanos: ${orphanTickers.count}`)
    
    // Inversiones sin ticker
    const orphanInversiones = db.prepare(`
      SELECT COUNT(*) as count FROM inversiones i 
      LEFT JOIN tickers t ON i.ticker_id = t.id 
      WHERE t.id IS NULL
    `).get()
    console.log(`  ${orphanInversiones.count === 0 ? '✅' : '❌'} Inversiones huérfanas: ${orphanInversiones.count}`)
    
    // Precios sin ticker
    const orphanPrecios = db.prepare(`
      SELECT COUNT(*) as count FROM precios_historicos ph 
      LEFT JOIN tickers t ON ph.ticker_id = t.id 
      WHERE t.id IS NULL
    `).get()
    console.log(`  ${orphanPrecios.count === 0 ? '✅' : '❌'} Precios huérfanos: ${orphanPrecios.count}`)
    
    // 4. Verificar datos de ejemplo
    console.log('\n📈 Verificando datos de ejemplo...')
    
    const tickerCount = db.prepare('SELECT COUNT(*) as count FROM tickers').get()
    console.log(`  📊 Total tickers: ${tickerCount.count}`)
    
    const inversionCount = db.prepare('SELECT COUNT(*) as count FROM inversiones').get()
    console.log(`  💰 Total inversiones: ${inversionCount.count}`)
    
    const precioCount = db.prepare('SELECT COUNT(*) as count FROM precios_historicos').get()
    console.log(`  📈 Total precios históricos: ${precioCount.count}`)
    
    const tcCount = db.prepare('SELECT COUNT(*) as count FROM tipos_cambio').get()
    console.log(`  💱 Total tipos de cambio: ${tcCount.count}`)
    
    // 5. Verificar cálculos de la vista
    console.log('\n🧮 Verificando cálculos de la vista...')
    
    const resumenData = db.prepare(`
      SELECT 
        ticker, 
        importe_total, 
        cantidad_total, 
        precio_reciente, 
        balance, 
        rendimiento, 
        rentabilidad
      FROM v_resumen_empresas 
      WHERE importe_total > 0 
      LIMIT 5
    `).all()
    
    for (const row of resumenData) {
      const expectedBalance = row.cantidad_total * row.precio_reciente
      const expectedRendimiento = expectedBalance - row.importe_total
      const expectedRentabilidad = row.importe_total > 0 ? expectedRendimiento / row.importe_total : 0
      
      const balanceOk = Math.abs(row.balance - expectedBalance) < 0.01
      const rendimientoOk = Math.abs(row.rendimiento - expectedRendimiento) < 0.01
      const rentabilidadOk = Math.abs(row.rentabilidad - expectedRentabilidad) < 0.0001
      
      console.log(`  ${row.ticker}:`)
      console.log(`    Balance: ${balanceOk ? '✅' : '❌'} (esperado: ${expectedBalance.toFixed(2)}, actual: ${row.balance})`)
      console.log(`    Rendimiento: ${rendimientoOk ? '✅' : '❌'} (esperado: ${expectedRendimiento.toFixed(2)}, actual: ${row.rendimiento})`)
      console.log(`    Rentabilidad: ${rentabilidadOk ? '✅' : '❌'} (esperado: ${expectedRentabilidad.toFixed(4)}, actual: ${row.rentabilidad})`)
    }
    
    console.log('\n✅ Verificación de integridad completada')
    
  } catch (error) {
    console.error('❌ Error verificando integridad:', error.message)
    process.exit(1)
  }
}

verifyDataIntegrity().catch(console.error)

