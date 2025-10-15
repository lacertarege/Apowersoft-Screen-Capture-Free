#!/usr/bin/env node

/**
 * Script para verificar calidad del código y detectar duplicaciones
 */

const fs = require('fs')
const path = require('path')

const ISSUES = []

function checkFile(filePath, content) {
  const lines = content.split('\n')
  
  // 1. Verificar logs de depuración
  lines.forEach((line, index) => {
    if (line.includes('console.log(') && !line.includes('console.error(')) {
      ISSUES.push({
        file: filePath,
        line: index + 1,
        type: 'DEBUG_LOG',
        message: 'console.log() encontrado - remover en producción',
        code: line.trim()
      })
    }
  })
  
  // 2. Verificar duplicaciones de setLoading
  const setLoadingCount = content.match(/setLoading\(/g)?.length || 0
  if (setLoadingCount > 3) {
    ISSUES.push({
      file: filePath,
      line: 0,
      type: 'DUPLICATE_LOADING',
      message: `${setLoadingCount} llamadas a setLoading - considerar consolidar`,
      code: 'setLoading patterns'
    })
  }
  
  // 3. Verificar mensajes de error duplicados
  const errorMessages = content.match(/error:\s*['"`]([^'"`]+)['"`]/gi) || []
  const uniqueErrors = new Set(errorMessages.map(msg => msg.toLowerCase()))
  if (errorMessages.length !== uniqueErrors.size) {
    ISSUES.push({
      file: filePath,
      line: 0,
      type: 'DUPLICATE_ERROR',
      message: 'Mensajes de error duplicados encontrados',
      code: 'error messages'
    })
  }
}

function scanDirectory(dir) {
  const files = fs.readdirSync(dir)
  
  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      scanDirectory(filePath)
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      try {
        const content = fs.readFileSync(filePath, 'utf8')
        checkFile(filePath, content)
      } catch (error) {
        console.error(`Error leyendo ${filePath}:`, error.message)
      }
    }
  })
}

function main() {
  console.log('🔍 Verificando calidad del código...\n')
  
  // Escanear directorios
  if (fs.existsSync('frontend/src')) {
    console.log('📁 Escaneando frontend/src/...')
    scanDirectory('frontend/src')
  }
  
  if (fs.existsSync('backend/src')) {
    console.log('📁 Escaneando backend/src/...')
    scanDirectory('backend/src')
  }
  
  // Mostrar resultados
  if (ISSUES.length === 0) {
    console.log('✅ No se encontraron problemas de calidad de código')
  } else {
    console.log(`❌ Se encontraron ${ISSUES.length} problemas:\n`)
    
    ISSUES.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.type} en ${issue.file}`)
      console.log(`   ${issue.message}`)
      if (issue.line > 0) {
        console.log(`   Línea ${issue.line}: ${issue.code}`)
      }
      console.log('')
    })
    
    console.log('💡 Recomendaciones:')
    console.log('   - Revisar CODE_STANDARDS.md')
    console.log('   - Remover console.log() innecesarios')
    console.log('   - Consolidar lógica duplicada')
    console.log('   - Usar hooks personalizados para código repetitivo')
  }
  
  process.exit(ISSUES.length > 0 ? 1 : 0)
}

if (require.main === module) {
  main()
}

module.exports = { checkFile, scanDirectory }
