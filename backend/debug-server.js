// Script de diagnóstico paso a paso
console.log('🔍 Iniciando diagnóstico del servidor...')

async function diagnosticarServidor() {
  try {
    console.log('1. ✅ Importando dotenv...')
    await import('dotenv/config')
    
    console.log('2. ✅ Importando express...')
    const express = await import('express')
    
    console.log('3. ✅ Importando node-cron...')
    const cron = await import('node-cron')
    
    console.log('4. ✅ Importando createDb...')
    const { createDb } = await import('./src/setup/db.js')
    
    console.log('5. ✅ Creando base de datos...')
    const db = await createDb('./data/investments.db')
    
    console.log('6. ✅ Importando buildRoutes...')
    const { buildRoutes } = await import('./src/setup/routes.js')
    
    console.log('7. ✅ Creando app Express...')
    const app = express.default()
    
    console.log('8. ✅ Configurando rutas...')
    buildRoutes(app, db)
    
    console.log('9. ✅ Iniciando servidor...')
    const PORT = process.env.PORT || 3001
    app.listen(PORT, () => {
      console.log(`✅ Servidor iniciado correctamente en puerto ${PORT}`)
      console.log('✅ Diagnóstico completado exitosamente')
      process.exit(0)
    })
    
  } catch (error) {
    console.error('❌ Error en el paso:', error.message)
    console.error('❌ Stack trace:', error.stack)
    process.exit(1)
  }
}

diagnosticarServidor()
