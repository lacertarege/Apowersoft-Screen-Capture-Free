#!/usr/bin/env node

// Script de inicio que verifica todo antes de lanzar la aplicación
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

console.log('🚀 Iniciando aplicación de inversiones...\n')

// Verificar que los archivos necesarios existan
const requiredFiles = [
  'backend/package.json',
  'frontend/package.json',
  'docker-compose.yml',
  'backend/src/server.js'
]

console.log('📋 Verificando archivos necesarios...')
for (const file of requiredFiles) {
  if (existsSync(file)) {
    console.log(`  ✅ ${file}`)
  } else {
    console.log(`  ❌ ${file} - FALTANTE`)
    process.exit(1)
  }
}

// Verificar que la base de datos exista o pueda crearse
console.log('\n💾 Verificando base de datos...')
const dbPath = './data/investments.db'
const dataDir = path.dirname(dbPath)

if (!existsSync(dataDir)) {
  console.log(`  📁 Creando directorio de datos: ${dataDir}`)
  try {
    const fs = await import('fs')
    fs.mkdirSync(dataDir, { recursive: true })
    console.log('  ✅ Directorio creado')
  } catch (error) {
    console.log(`  ❌ Error creando directorio: ${error.message}`)
    process.exit(1)
  }
}

// Mostrar instrucciones
console.log('\n📖 Instrucciones de inicio:')
console.log('1. Para desarrollo:')
console.log('   - Backend: cd backend && npm run dev')
console.log('   - Frontend: cd frontend && npm run dev')
console.log('')
console.log('2. Para producción con Docker:')
console.log('   - docker-compose up -d')
console.log('')
console.log('3. Para verificar conexión:')
console.log('   - node test-connection.js')
console.log('')
console.log('4. Para verificar integridad de datos:')
console.log('   - node verify-data-integrity.js')
console.log('')

// Preguntar si quiere iniciar con Docker
console.log('🐳 ¿Quieres iniciar la aplicación con Docker? (y/n)')
process.stdin.setEncoding('utf8')
process.stdin.on('data', (data) => {
  const input = data.toString().trim().toLowerCase()
  
  if (input === 'y' || input === 'yes') {
    console.log('\n🐳 Iniciando con Docker Compose...')
    const docker = spawn('docker-compose', ['up', '--build'], {
      stdio: 'inherit',
      shell: true
    })
    
    docker.on('close', (code) => {
      console.log(`\n🐳 Docker Compose terminó con código ${code}`)
    })
  } else {
    console.log('\n💡 Para iniciar manualmente:')
    console.log('   Backend:  cd backend && npm run dev')
    console.log('   Frontend: cd frontend && npm run dev')
    process.exit(0)
  }
})

