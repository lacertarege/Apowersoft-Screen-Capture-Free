#!/usr/bin/env node

// Script para verificar que todas las mejoras estén aplicadas
import { existsSync, readFileSync } from 'fs'

console.log('🔍 Verificando mejoras aplicadas...\n')

const checks = [
  {
    name: 'Hooks personalizados creados',
    files: ['frontend/src/hooks/useTickers.js', 'frontend/src/hooks/useInvestments.js'],
    check: (contents) => contents.some(c => c.includes('useCallback') && c.includes('useState'))
  },
  {
    name: 'Servicios de dominio implementados',
    file: 'backend/src/services/InvestmentService.js',
    check: (content) => content.includes('calculateReturn') && content.includes('validateInvestment')
  },
  {
    name: 'Patrón Repository implementado',
    file: 'backend/src/repositories/TickerRepository.js',
    check: (content) => content.includes('findAll') && content.includes('create') && content.includes('update')
  },
  {
    name: 'Componentes reutilizables creados',
    files: ['frontend/src/components/TickerRow.jsx', 'frontend/src/components/PortfolioSummary.jsx'],
    check: (contents) => contents.some(c => c.includes('aria-label') && c.includes('role='))
  },
  {
    name: 'Sistema de caché implementado',
    file: 'backend/src/utils/cache.js',
    check: (content) => content.includes('MemoryCache') && content.includes('getOrSet')
  },
  {
    name: 'Tests unitarios agregados',
    file: 'backend/tests/InvestmentService.test.js',
    check: (content) => content.includes('InvestmentService.calculateReturn') && content.includes('console.assert')
  },
  {
    name: 'Vite config optimizado',
    file: 'frontend/vite.config.js',
    check: (content) => content.includes('manualChunks') && content.includes('terserOptions')
  },
  {
    name: 'EmpresasView refactorizado',
    file: 'frontend/src/ui/EmpresasView.jsx',
    check: (content) => content.includes('useTickers') && content.includes('useInvestments')
  }
]

let passed = 0
let failed = 0

for (const check of checks) {
  try {
    if (check.files) {
      // Verificar múltiples archivos
      const allExist = check.files.every(file => existsSync(file))
      if (!allExist) {
        console.log(`❌ ${check.name}: Algunos archivos no encontrados`)
        failed++
        continue
      }
      
      const contents = check.files.map(file => readFileSync(file, 'utf8'))
      const result = check.check(contents)
      
      if (result) {
        console.log(`✅ ${check.name}`)
        passed++
      } else {
        console.log(`❌ ${check.name}: Condición no cumplida`)
        failed++
      }
    } else {
      // Verificar archivo único
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
    }
  } catch (error) {
    console.log(`❌ ${check.name}: Error - ${error.message}`)
    failed++
  }
}

console.log(`\n📊 Resumen de mejoras:`)
console.log(`✅ Implementadas: ${passed}`)
console.log(`❌ Pendientes: ${failed}`)

if (failed === 0) {
  console.log('\n🎉 ¡Todas las mejoras han sido implementadas correctamente!')
  console.log('\n📈 Beneficios obtenidos:')
  console.log('  • Código más modular y reutilizable')
  console.log('  • Mejor separación de responsabilidades')
  console.log('  • Caché para mejor rendimiento')
  console.log('  • Tests para mayor confiabilidad')
  console.log('  • Accesibilidad mejorada')
  console.log('  • Bundle optimizado')
} else {
  console.log('\n⚠️  Algunas mejoras necesitan atención.')
}

process.exit(failed > 0 ? 1 : 0)
