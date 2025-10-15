#!/usr/bin/env node

// Script para probar la conexión del backend y las APIs externas
import 'dotenv/config'
import { createDb } from './backend/src/setup/db.js'
import { fetchPriceForSymbol, searchSymbols } from './backend/src/sources/marketData.js'
import { fetchUsdPenForDate } from './backend/src/sources/fx.js'

async function testDatabase() {
  console.log('🔍 Probando conexión a la base de datos...')
  try {
    const db = createDb('./data/investments.db')
    db.pragma('foreign_keys = ON')
    db.pragma('journal_mode = WAL')
    
    // Probar consulta básica
    const result = db.prepare('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"').get()
    console.log(`✅ Base de datos conectada. Tablas encontradas: ${result.count}`)
    
    // Probar vista de resumen
    const tickers = db.prepare('SELECT COUNT(*) as count FROM v_resumen_empresas').get()
    console.log(`✅ Vista de resumen funcionando. Tickers: ${tickers.count}`)
    
    return true
  } catch (error) {
    console.error('❌ Error con la base de datos:', error.message)
    return false
  }
}

async function testExternalAPIs() {
  console.log('\n🔍 Probando APIs externas...')
  
  // Probar búsqueda de símbolos
  try {
    console.log('  - Probando búsqueda de símbolos...')
    const searchResult = await searchSymbols('AAPL')
    console.log(`✅ Búsqueda funcionando. Resultados: ${searchResult.items.length}`)
  } catch (error) {
    console.error('❌ Error en búsqueda de símbolos:', error.message)
  }
  
  // Probar precio de símbolo
  try {
    console.log('  - Probando precio de símbolo...')
    const priceResult = await fetchPriceForSymbol('AAPL')
    console.log(`✅ Precio obtenido: $${priceResult.price} (fuente: ${priceResult.source})`)
  } catch (error) {
    console.error('❌ Error obteniendo precio:', error.message)
  }
  
  // Probar tipo de cambio
  try {
    console.log('  - Probando tipo de cambio...')
    const today = new Date().toISOString().slice(0, 10)
    const fxResult = await fetchUsdPenForDate(today)
    console.log(`✅ Tipo de cambio USD/PEN: ${fxResult}`)
  } catch (error) {
    console.error('❌ Error obteniendo tipo de cambio:', error.message)
  }
}

async function testBackendAPI() {
  console.log('\n🔍 Probando API del backend...')
  try {
    const response = await fetch('http://localhost:3001/health')
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Backend API funcionando:', data)
    } else {
      console.error('❌ Backend API no responde correctamente:', response.status)
    }
  } catch (error) {
    console.error('❌ Error conectando con backend:', error.message)
    console.log('💡 Asegúrate de que el backend esté ejecutándose en el puerto 3001')
  }
}

async function main() {
  console.log('🚀 Iniciando pruebas de conexión...\n')
  
  const dbOk = await testDatabase()
  await testExternalAPIs()
  await testBackendAPI()
  
  console.log('\n📊 Resumen de pruebas completado')
  if (dbOk) {
    console.log('✅ Base de datos: OK')
  } else {
    console.log('❌ Base de datos: ERROR')
  }
}

main().catch(console.error)

