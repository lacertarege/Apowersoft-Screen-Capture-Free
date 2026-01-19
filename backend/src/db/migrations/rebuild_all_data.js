/**
 * Script de reconstrucción completa de datos del portfolio
 * Regenera todos los cálculos desde cero con la lógica corregida
 * 
 * USO: node src/db/migrations/rebuild_all_data.js
 */

import Database from 'better-sqlite3'
import { CacheService } from '../../services/CacheService.js'
import { updatePortfolioEvolutionJob } from '../../jobs/updatePortfolioEvolution.js'
import { updateBenchmarksJob } from '../../jobs/updateBenchmarks.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function rebuildAllData() {
    console.log('🔄 INICIANDO RECONSTRUCCIÓN COMPLETA DE DATOS')
    console.log('='.repeat(60))

    // Conectar a la base de datos
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/investments.db')
    console.log(`📁 Base de datos: ${dbPath}`)

    const db = new Database(dbPath)

    try {
        // 1. Crear backup de tablas actuales
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        console.log(`\n📦 Paso 1: Creando backup con timestamp ${timestamp}...`)

        const backupTableName = `portfolio_evolucion_diaria_backup_${timestamp.replace(/-/g, '_')}`
        db.prepare(`CREATE TABLE IF NOT EXISTS ${backupTableName} AS SELECT * FROM portfolio_evolucion_diaria`).run()

        const backupCount = db.prepare(`SELECT COUNT(*) as c FROM ${backupTableName}`).get().c
        console.log(`   ✓ Backup creado: ${backupCount} registros en ${backupTableName}`)

        // 2. Limpiar cache
        console.log('\n🗑️  Paso 2: Limpiando cache de portfolio...')
        db.prepare('DELETE FROM portfolio_evolucion_diaria').run()
        console.log('   ✓ Cache limpiado')

        // 3. Invalidar metadata
        console.log('\n🔄 Paso 3: Invalidando metadata de cache...')
        CacheService.invalidatePortfolioCache(db, 'full_rebuild')
        console.log('   ✓ Metadata invalidada')

        // 4. Ejecutar job completo de portfolio
        console.log('\n📊 Paso 4: Recalculando evolución del portfolio...')
        const portfolioResult = await updatePortfolioEvolutionJob(db, true)
        console.log(`   ✓ Portfolio: ${portfolioResult.insertados} nuevos, ${portfolioResult.actualizados} actualizados`)

        // 5. Actualizar benchmarks
        console.log('\n📈 Paso 5: Actualizando benchmarks...')
        await updateBenchmarksJob(db)
        console.log('   ✓ Benchmarks actualizados')

        // 6. Verificar integridad básica
        console.log('\n✅ Paso 6: Verificando integridad...')
        const stats = verifyIntegrity(db)
        console.log(`   - Total días en portfolio: ${stats.totalDays}`)
        console.log(`   - Rango: ${stats.minDate} a ${stats.maxDate}`)
        console.log(`   - Inversión actual USD: $${stats.currentInvestmentUsd.toFixed(2)}`)
        console.log(`   - Balance actual USD: $${stats.currentBalanceUsd.toFixed(2)}`)
        console.log(`   - Rendimiento: $${stats.currentYieldUsd.toFixed(2)} (${stats.currentYieldPct.toFixed(2)}%)`)

        console.log('\n' + '='.repeat(60))
        console.log('✅ RECONSTRUCCIÓN COMPLETA FINALIZADA EXITOSAMENTE')
        console.log('='.repeat(60))

        return { success: true, stats }

    } catch (error) {
        console.error('\n❌ ERROR durante la reconstrucción:', error.message)
        throw error
    } finally {
        db.close()
    }
}

function verifyIntegrity(db) {
    const stats = db.prepare(`
    SELECT 
      COUNT(*) as totalDays,
      MIN(fecha) as minDate,
      MAX(fecha) as maxDate
    FROM portfolio_evolucion_diaria
  `).get()

    const latest = db.prepare(`
    SELECT inversion_usd, balance_usd, rendimiento_usd, rentabilidad_porcentaje
    FROM portfolio_evolucion_diaria
    ORDER BY fecha DESC
    LIMIT 1
  `).get()

    return {
        totalDays: stats.totalDays,
        minDate: stats.minDate,
        maxDate: stats.maxDate,
        currentInvestmentUsd: latest?.inversion_usd || 0,
        currentBalanceUsd: latest?.balance_usd || 0,
        currentYieldUsd: latest?.rendimiento_usd || 0,
        currentYieldPct: latest?.rentabilidad_porcentaje || 0
    }
}

// Ejecutar si es el archivo principal
rebuildAllData().catch(e => {
    console.error(e)
    process.exit(1)
})
