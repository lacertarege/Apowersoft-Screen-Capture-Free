// Script para probar los servicios externos de tipo de cambio
import { fetchUsdPenForDate } from './backend/src/sources/fx.js'

async function testFxServices() {
  console.log('🔄 Probando servicios externos de tipo de cambio...\n')
  
  // Fechas de prueba (últimos 5 días hábiles)
  const testDates = [
    '2025-10-04', // Viernes
    '2025-10-03', // Jueves
    '2025-10-02', // Miércoles
    '2025-10-01', // Martes
    '2025-09-30', // Lunes
  ]
  
  for (const date of testDates) {
    console.log(`📅 Probando fecha: ${date}`)
    console.log('─'.repeat(50))
    
    try {
      const startTime = Date.now()
      const rate = await fetchUsdPenForDate(date)
      const endTime = Date.now()
      const duration = endTime - startTime
      
      console.log(`✅ Éxito: ${rate} PEN por USD`)
      console.log(`⏱️  Tiempo: ${duration}ms`)
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`)
    }
    
    console.log('') // Línea en blanco
  }
  
  console.log('🏁 Prueba completada')
}

// Ejecutar la prueba
testFxServices().catch(console.error)

