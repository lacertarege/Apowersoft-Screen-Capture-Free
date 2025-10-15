#!/usr/bin/env node

// Script para verificar que todas las correcciones estén aplicadas
import { existsSync, readFileSync } from 'fs'

console.log('🔍 Verificando correcciones aplicadas...\n')

const checks = [
  {
    name: 'Dependencias frontend limpias',
    file: 'frontend/package.json',
    check: (content) => {
      const pkg = JSON.parse(content)
      const hasCors = pkg.devDependencies?.cors
      const hasExpress = pkg.devDependencies?.express
      return !hasCors && !hasExpress
    }
  },
  {
    name: 'Dockerfile frontend optimizado',
    file: 'frontend/Dockerfile',
    check: (content) => content.includes('FROM node:20-alpine AS builder') && content.includes('FROM nginx:alpine')
  },
  {
    name: 'Nginx config creado',
    file: 'frontend/nginx.conf',
    check: (content) => content.includes('proxy_pass http://backend:3001/')
  },
  {
    name: 'Docker-compose actualizado',
    file: 'docker-compose.yml',
    check: (content) => content.includes('"80:80"')
  },
  {
    name: 'Dashboard optimizado',
    file: 'backend/src/routes/dashboard.js',
    check: (content) => content.includes('WITH fechas_unicas AS') && !content.includes('for (const t of ticks)')
  },
  {
    name: 'Validación de entrada en tickers',
    file: 'backend/src/routes/tickers.js',
    check: (content) => content.includes('typeof ticker !== \'string\'') && content.includes('tipoExists')
  },
  {
    name: 'Logging estructurado',
    file: 'backend/src/utils/logger.js',
    check: (content) => content.includes('winston') && content.includes('transports')
  },
  {
    name: 'Manejo de errores mejorado',
    file: 'frontend/src/ui/EmpresasView.jsx',
    check: (content) => content.includes('console.error') && content.includes('Error:')
  },
  {
    name: 'Winston agregado a dependencias',
    file: 'backend/package.json',
    check: (content) => {
      const pkg = JSON.parse(content)
      return pkg.dependencies?.winston
    }
  },
  {
    name: 'Directorio de logs en Dockerfile',
    file: 'backend/Dockerfile',
    check: (content) => content.includes('/app/logs')
  }
]

let passed = 0
let failed = 0

for (const check of checks) {
  try {
    if (!existsSync(check.file)) {
      console.log(`❌ ${check.name}: Archivo no encontrado`)
      failed++
      continue
    }
    
    const content = readFileSync(check.file, 'utf8')
    const result = check.check(content)
    
    if (result) {
      console.log(`✅ ${check.name}`)
      passed++
    } else {
      console.log(`❌ ${check.name}: Condición no cumplida`)
      failed++
    }
  } catch (error) {
    console.log(`❌ ${check.name}: Error - ${error.message}`)
    failed++
  }
}

console.log(`\n📊 Resumen:`)
console.log(`✅ Pasaron: ${passed}`)
console.log(`❌ Fallaron: ${failed}`)

if (failed === 0) {
  console.log('\n🎉 ¡Todas las correcciones están aplicadas correctamente!')
} else {
  console.log('\n⚠️  Algunas correcciones necesitan atención.')
}

process.exit(failed > 0 ? 1 : 0)
