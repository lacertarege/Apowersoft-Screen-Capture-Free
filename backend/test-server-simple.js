console.log('🚀 Iniciando servidor de prueba...')

import express from 'express'

const app = express()
app.use(express.json())

// Endpoint básico de salud
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() })
})

// Endpoint de prueba para CSV
app.post('/test-csv', (req, res) => {
  console.log('📄 Endpoint CSV recibido:', req.body)
  res.json({ message: 'Endpoint CSV funcionando', received: req.body })
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
  console.log(`📄 CSV test: http://localhost:${PORT}/test-csv`)
})

console.log('🔧 Configuración completada')



