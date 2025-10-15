/**
 * Script para validar que todo el proyecto use la misma base de datos
 */

import { createDb } from './src/setup/db.js'
import fs from 'fs'
import path from 'path'

console.log('🔍 VALIDACIÓN DE CONSISTENCIA DE BASE DE DATOS\n')
console.log('=' .repeat(70))

// =============================================================================
// 1. VERIFICAR CONFIGURACIÓN
// =============================================================================
console.log('\n📋 PASO 1: VERIFICAR CONFIGURACIÓN\n')

const dbPath = process.env.DB_PATH || './data/investments.db'
console.log(`✓ Variable de entorno DB_PATH: ${dbPath}`)
console.log(`✓ Ruta absoluta: ${path.resolve(dbPath)}`)

// Verificar archivo .env
const envPath = '.env'
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const dbPathLine = envContent.split('\n').find(line => line.startsWith('DB_PATH'))
  console.log(`✓ Archivo .env: ${dbPathLine || 'DB_PATH no configurado'}`)
}

// Verificar docker-compose.yml
const dockerComposePath = '../docker-compose.yml'
if (fs.existsSync(dockerComposePath)) {
  const dockerContent = fs.readFileSync(dockerComposePath, 'utf-8')
  const dbPathMatch = dockerContent.match(/DB_PATH=([^\s]+)/)
  if (dbPathMatch) {
    console.log(`✓ Docker Compose DB_PATH: ${dbPathMatch[1]}`)
  }
  
  // Verificar volúmenes
  const volumeMatch = dockerContent.match(/- \.\/backend\/data:([^\s]+)/)
  if (volumeMatch) {
    console.log(`✓ Docker Volume mapeado: ./backend/data -> ${volumeMatch[1]}`)
  }
}

// =============================================================================
// 2. BUSCAR TODAS LAS BASES DE DATOS
// =============================================================================
console.log('\n📋 PASO 2: BUSCAR TODAS LAS BASES DE DATOS\n')

const potentialPaths = [
  './data/investments.db',
  '../investments.db',
  '../../investments.db',
  '../frontend/investments.db'
]

const foundDatabases = []

for (const testPath of potentialPaths) {
  if (fs.existsSync(testPath)) {
    const stats = fs.statSync(testPath)
    const absPath = path.resolve(testPath)
    
    foundDatabases.push({
      path: testPath,
      absolutePath: absPath,
      size: stats.size,
      modified: stats.mtime
    })
    
    console.log(`✓ Encontrada: ${testPath}`)
    console.log(`  Ruta absoluta: ${absPath}`)
    console.log(`  Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Modificada: ${stats.mtime.toLocaleString()}`)
    console.log()
  }
}

if (foundDatabases.length === 0) {
  console.log('❌ No se encontraron bases de datos')
  process.exit(1)
}

if (foundDatabases.length > 1) {
  console.log(`⚠️  ADVERTENCIA: Se encontraron ${foundDatabases.length} bases de datos`)
  console.log('   Esto podría causar inconsistencias.')
}

// =============================================================================
// 3. ANALIZAR CONTENIDO DE CADA BASE DE DATOS
// =============================================================================
console.log('\n📋 PASO 3: ANALIZAR CONTENIDO DE CADA BASE DE DATOS\n')

const databaseAnalysis = []

for (const dbInfo of foundDatabases) {
  try {
    const db = createDb(dbInfo.path)
    
    // Contar registros
    const tcCount = db.prepare('SELECT COUNT(*) as count FROM tipos_cambio').get()
    const invCount = db.prepare('SELECT COUNT(*) as count FROM inversiones').get()
    const tickCount = db.prepare('SELECT COUNT(*) as count FROM tickers').get()
    
    // Fuentes de tipos de cambio
    const sources = db.prepare('SELECT fuente_api, COUNT(*) as count FROM tipos_cambio GROUP BY fuente_api').all()
    
    // Último registro
    const lastTc = db.prepare('SELECT * FROM tipos_cambio ORDER BY fecha DESC LIMIT 1').get()
    
    const analysis = {
      path: dbInfo.path,
      absolutePath: dbInfo.absolutePath,
      tipos_cambio: tcCount.count,
      inversiones: invCount.count,
      tickers: tickCount.count,
      sources: sources,
      lastRecord: lastTc
    }
    
    databaseAnalysis.push(analysis)
    
    console.log(`📊 ${dbInfo.path}:`)
    console.log(`   Tipos de cambio: ${tcCount.count}`)
    console.log(`   Inversiones: ${invCount.count}`)
    console.log(`   Tickers: ${tickCount.count}`)
    console.log(`   Fuentes de TC: ${sources.map(s => `${s.fuente_api}(${s.count})`).join(', ')}`)
    if (lastTc) {
      console.log(`   Último TC: ${lastTc.fecha} = ${lastTc.usd_pen} (${lastTc.fuente_api})`)
    }
    console.log()
    
    db.close()
  } catch (e) {
    console.log(`❌ Error analizando ${dbInfo.path}: ${e.message}\n`)
  }
}

// =============================================================================
// 4. VERIFICAR APIS
// =============================================================================
console.log('\n📋 PASO 4: VERIFICAR RESPUESTAS DE LAS APIS\n')

try {
  // API Backend
  const backendUrl = 'http://localhost:3001/config/tipo-cambio?limit=1'
  console.log(`🌐 Consultando: ${backendUrl}`)
  
  const response = await fetch(backendUrl)
  if (response.ok) {
    const data = await response.json()
    const count = data.items?.length || 0
    
    console.log(`   ✓ Backend respondió correctamente`)
    console.log(`   Registros en respuesta: ${count}`)
    
    if (data.items && data.items[0]) {
      const item = data.items[0]
      console.log(`   Último registro: ${item.fecha} = ${item.usd_pen} (${item.fuente_api})`)
    }
    
    // Obtener conteo total
    const countResponse = await fetch('http://localhost:3001/config/tipo-cambio?limit=10000')
    if (countResponse.ok) {
      const countData = await countResponse.json()
      console.log(`   Total en API: ${countData.items?.length || 0} registros`)
    }
  } else {
    console.log(`   ❌ Backend no respondió: ${response.status}`)
  }
} catch (e) {
  console.log(`   ⚠️  No se pudo conectar al backend: ${e.message}`)
}

console.log()

// =============================================================================
// 5. CONCLUSIONES
// =============================================================================
console.log('\n📋 PASO 5: CONCLUSIONES\n')
console.log('=' .repeat(70))

// Verificar si todas las BDs tienen el mismo contenido
const allSame = databaseAnalysis.every(db => 
  db.tipos_cambio === databaseAnalysis[0].tipos_cambio &&
  db.inversiones === databaseAnalysis[0].inversiones &&
  db.tickers === databaseAnalysis[0].tickers
)

if (allSame && databaseAnalysis.length === 1) {
  console.log('✅ EXCELENTE: Solo hay UNA base de datos en el sistema')
  console.log(`   Ubicación: ${databaseAnalysis[0].absolutePath}`)
  console.log(`   Registros de tipos de cambio: ${databaseAnalysis[0].tipos_cambio}`)
  console.log(`   Inversiones: ${databaseAnalysis[0].inversiones}`)
  console.log(`   Tickers: ${databaseAnalysis[0].tickers}`)
} else if (allSame && databaseAnalysis.length > 1) {
  console.log('⚠️  ADVERTENCIA: Hay múltiples bases de datos con el MISMO contenido')
  console.log('   Esto podría no ser un problema, pero es redundante.')
  console.log('   Bases de datos encontradas:')
  databaseAnalysis.forEach(db => console.log(`   - ${db.absolutePath}`))
} else {
  console.log('❌ PROBLEMA: Las bases de datos tienen CONTENIDO DIFERENTE')
  console.log('   Esto CAUSARÁ inconsistencias en la aplicación.')
  console.log('\n   Detalle:')
  databaseAnalysis.forEach(db => {
    console.log(`   ${db.path}:`)
    console.log(`     TC: ${db.tipos_cambio}, Inv: ${db.inversiones}, Tickers: ${db.tickers}`)
  })
  console.log('\n   💡 SOLUCIÓN: Eliminar bases de datos duplicadas y mantener solo:')
  console.log(`      ${dbPath}`)
}

console.log('\n' + '=' .repeat(70))
console.log('✅ VALIDACIÓN COMPLETADA')

