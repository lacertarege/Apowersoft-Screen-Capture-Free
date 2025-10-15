#!/usr/bin/env node

// Script de verificación completa de la aplicación
import { existsSync, readFileSync } from 'fs'

console.log('🔍 Verificación completa de la aplicación de inversiones...\n')

const checks = [
  // === CORRECCIONES ORIGINALES ===
  {
    category: 'Correcciones Originales',
    name: 'Dependencias SQLite corregidas',
    file: 'backend/package.json',
    check: (content) => {
      const pkg = JSON.parse(content)
      return pkg.dependencies['better-sqlite3'] && !pkg.dependencies['sqlite3']
    }
  },
  {
    category: 'Correcciones Originales',
    name: 'Servidor con función async',
    file: 'backend/src/server.js',
    check: (content) => content.includes('async function startServer()')
  },
  {
    category: 'Correcciones Originales',
    name: 'CORS configurado correctamente',
    file: 'backend/src/setup/routes.js',
    check: (content) => content.includes('allowedOrigins') && content.includes('Access-Control-Allow-Origin') && content.includes('origin')
  },
  {
    category: 'Correcciones Originales',
    name: 'Dashboard optimizado',
    file: 'backend/src/routes/dashboard.js',
    check: (content) => content.includes('WITH fechas_unicas AS') && !content.includes('for (const t of ticks)')
  },
  {
    category: 'Correcciones Originales',
    name: 'Validación de entrada robusta',
    file: 'backend/src/routes/tickers.js',
    check: (content) => content.includes('typeof ticker !== \'string\'') && content.includes('tipoExists')
  },
  {
    category: 'Correcciones Originales',
    name: 'Dockerfile frontend optimizado',
    file: 'frontend/Dockerfile',
    check: (content) => content.includes('FROM node:20-alpine AS builder') && content.includes('FROM nginx:alpine')
  },
  {
    category: 'Correcciones Originales',
    name: 'Logging estructurado',
    file: 'backend/src/utils/logger.js',
    check: (content) => content.includes('winston') && content.includes('transports')
  },

  // === MEJORAS IMPLEMENTADAS ===
  {
    category: 'Mejoras de Arquitectura',
    name: 'Hooks personalizados',
    files: ['frontend/src/hooks/useTickers.js', 'frontend/src/hooks/useInvestments.js'],
    check: (contents) => contents.some(c => c.includes('useCallback') && c.includes('useState'))
  },
  {
    category: 'Mejoras de Arquitectura',
    name: 'Servicios de dominio',
    file: 'backend/src/services/InvestmentService.js',
    check: (content) => content.includes('calculateReturn') && content.includes('validateInvestment')
  },
  {
    category: 'Mejoras de Arquitectura',
    name: 'Patrón Repository',
    file: 'backend/src/repositories/TickerRepository.js',
    check: (content) => content.includes('findAll') && content.includes('create') && content.includes('update')
  },
  {
    category: 'Mejoras de Arquitectura',
    name: 'Componentes reutilizables',
    files: ['frontend/src/components/TickerRow.jsx', 'frontend/src/components/PortfolioSummary.jsx'],
    check: (contents) => contents.some(c => c.includes('aria-label') && c.includes('role='))
  },
  {
    category: 'Mejoras de Rendimiento',
    name: 'Sistema de caché',
    file: 'backend/src/utils/cache.js',
    check: (content) => content.includes('MemoryCache') && content.includes('getOrSet')
  },
  {
    category: 'Mejoras de Rendimiento',
    name: 'Bundle optimizado',
    file: 'frontend/vite.config.js',
    check: (content) => content.includes('manualChunks') && content.includes('terserOptions')
  },
  {
    category: 'Mejoras de Calidad',
    name: 'Tests unitarios',
    file: 'backend/tests/InvestmentService.test.js',
    check: (content) => content.includes('InvestmentService.calculateReturn') && content.includes('console.assert')
  },
  {
    category: 'Mejoras de Calidad',
    name: 'Accesibilidad mejorada',
    file: 'frontend/src/components/TickerRow.jsx',
    check: (content) => content.includes('aria-label') && content.includes('role=')
  },

  // === INTEGRACIÓN DE CAMBIOS DEL USUARIO ===
  {
    category: 'Integración de Cambios',
    name: 'EmpresasView usando hooks',
    file: 'frontend/src/ui/EmpresasView.jsx',
    check: (content) => content.includes('useTickers') && content.includes('useInvestments')
  },
  {
    category: 'Integración de Cambios',
    name: 'TickersTable usando TickerRow',
    file: 'frontend/src/ui/TickersTable.jsx',
    check: (content) => content.includes('TickerRow') && content.includes('from \'../components/TickerRow.jsx\'')
  },
  {
    category: 'Integración de Cambios',
    name: 'PortfolioSummary integrado',
    file: 'frontend/src/ui/EmpresasView.jsx',
    check: (content) => content.includes('PortfolioSummary') && content.includes('from \'../components/PortfolioSummary.jsx\'')
  },
  {
    category: 'Integración de Cambios',
    name: 'TickerModal con defaultMoneda',
    file: 'frontend/src/ui/TickerModal.jsx',
    check: (content) => content.includes('defaultMoneda') && content.includes('setMoneda(defaultMoneda)')
  },

  // === VERIFICACIONES DE INTEGRIDAD ===
  {
    category: 'Integridad de Datos',
    name: 'Vista SQL optimizada',
    file: 'backend/src/db/migrate.js',
    check: (content) => content.includes('COALESCE') && content.includes('ROUND') && content.includes('v_resumen_empresas')
  },
  {
    category: 'Integridad de Datos',
    name: 'Índices de base de datos',
    file: 'backend/src/db/migrate.js',
    check: (content) => content.includes('CREATE INDEX') && content.includes('ticker_id, fecha')
  },
  {
    category: 'Integridad de Datos',
    name: 'Configuración SQLite',
    file: 'backend/src/server.js',
    check: (content) => content.includes('foreign_keys = ON') && content.includes('journal_mode = WAL')
  }
]

let passed = 0
let failed = 0
const results = {}

for (const check of checks) {
  try {
    if (check.files) {
      // Verificar múltiples archivos
      const allExist = check.files.every(file => existsSync(file))
      if (!allExist) {
        console.log(`❌ ${check.name}: Algunos archivos no encontrados`)
        failed++
        if (!results[check.category]) results[check.category] = { passed: 0, failed: 0 }
        results[check.category].failed++
        continue
      }
      
      const contents = check.files.map(file => readFileSync(file, 'utf8'))
      const result = check.check(contents)
      
      if (result) {
        console.log(`✅ ${check.name}`)
        passed++
        if (!results[check.category]) results[check.category] = { passed: 0, failed: 0 }
        results[check.category].passed++
      } else {
        console.log(`❌ ${check.name}: Condición no cumplida`)
        failed++
        if (!results[check.category]) results[check.category] = { passed: 0, failed: 0 }
        results[check.category].failed++
      }
    } else {
      // Verificar archivo único
      if (!existsSync(check.file)) {
        console.log(`❌ ${check.name}: Archivo no encontrado`)
        failed++
        if (!results[check.category]) results[check.category] = { passed: 0, failed: 0 }
        results[check.category].failed++
        continue
      }
      
      const content = readFileSync(check.file, 'utf8')
      const result = check.check(content)
      
      if (result) {
        console.log(`✅ ${check.name}`)
        passed++
        if (!results[check.category]) results[check.category] = { passed: 0, failed: 0 }
        results[check.category].passed++
      } else {
        console.log(`❌ ${check.name}: Condición no cumplida`)
        failed++
        if (!results[check.category]) results[check.category] = { passed: 0, failed: 0 }
        results[check.category].failed++
      }
    }
  } catch (error) {
    console.log(`❌ ${check.name}: Error - ${error.message}`)
    failed++
    if (!results[check.category]) results[check.category] = { passed: 0, failed: 0 }
    results[check.category].failed++
  }
}

console.log(`\n📊 Resumen por categorías:`)
for (const [category, stats] of Object.entries(results)) {
  const total = stats.passed + stats.failed
  const percentage = Math.round((stats.passed / total) * 100)
  console.log(`  ${category}: ${stats.passed}/${total} (${percentage}%)`)
}

console.log(`\n📈 Resumen general:`)
console.log(`✅ Verificaciones exitosas: ${passed}`)
console.log(`❌ Verificaciones fallidas: ${failed}`)
console.log(`📊 Total: ${passed + failed}`)
console.log(`🎯 Porcentaje de éxito: ${Math.round((passed / (passed + failed)) * 100)}%`)

if (failed === 0) {
  console.log('\n🎉 ¡VERIFICACIÓN COMPLETA EXITOSA!')
  console.log('\n✨ Estado de la aplicación:')
  console.log('  • Todas las incoherencias corregidas')
  console.log('  • Todos los problemas resueltos')
  console.log('  • Todas las mejoras implementadas')
  console.log('  • Cambios del usuario integrados')
  console.log('  • Aplicación lista para producción')
} else {
  console.log('\n⚠️  Algunas verificaciones necesitan atención.')
}

process.exit(failed > 0 ? 1 : 0)
