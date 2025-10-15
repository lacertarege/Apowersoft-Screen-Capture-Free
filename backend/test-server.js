// Script de prueba simple para diagnosticar el problema
console.log('Iniciando prueba del servidor...')

try {
  console.log('1. Importando dotenv...')
  import('dotenv/config')
  
  console.log('2. Importando express...')
  const express = await import('express')
  
  console.log('3. Creando app...')
  const app = express.default()
  
  console.log('4. Configurando ruta básica...')
  app.get('/test', (req, res) => {
    res.json({ message: 'Servidor funcionando correctamente' })
  })
  
  console.log('5. Iniciando servidor en puerto 3001...')
  app.listen(3001, () => {
    console.log('✅ Servidor de prueba iniciado correctamente en puerto 3001')
    console.log('✅ Prueba completada exitosamente')
    process.exit(0)
  })
  
} catch (error) {
  console.error('❌ Error durante la prueba:', error.message)
  console.error('❌ Stack trace:', error.stack)
  process.exit(1)
}
