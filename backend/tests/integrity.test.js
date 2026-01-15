/**
 * Tests de Integridad de Datos
 * Valida consistencia entre diferentes vistas y cálculos del sistema
 * 
 * Ejecutar: npm run test:integrity
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { InvestmentService } from '../src/services/InvestmentService.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Integridad de Datos del Portfolio', () => {
    let db

    beforeAll(() => {
        const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/investments.db')
        db = new Database(dbPath, { readonly: true })
    })

    afterAll(() => {
        db.close()
    })

    describe('CPP (Costo Promedio Ponderado)', () => {
        it('CPP * Cantidad debe igualar Total Invertido para cada ticker', () => {
            const tickers = db.prepare('SELECT id, ticker FROM tickers').all()

            for (const { id, ticker } of tickers) {
                const stats = InvestmentService.calculatePositionStats(db, id)

                if (stats.cantidad > 0.000001) {
                    // Para posiciones abiertas, CPP * Qty ≈ totalInvertido
                    const calculated = stats.cpp * stats.cantidad
                    const diff = Math.abs(calculated - stats.totalInvertido)

                    expect(diff, `Ticker ${ticker}: CPP*Qty=${calculated.toFixed(2)}, totalInvertido=${stats.totalInvertido.toFixed(2)}`).toBeLessThan(0.01)
                }
            }
        })

        it('CPP debe ser positivo para posiciones abiertas', () => {
            const tickers = db.prepare('SELECT id, ticker FROM tickers').all()

            for (const { id, ticker } of tickers) {
                const stats = InvestmentService.calculatePositionStats(db, id)

                if (stats.cantidad > 0.000001) {
                    expect(stats.cpp, `Ticker ${ticker} tiene CPP negativo o cero`).toBeGreaterThan(0)
                }
            }
        })
    })

    describe('Flujos de Capital', () => {
        it('calculateCapitalFlows debe distinguir reinversiones de aportes externos', () => {
            // Verificar que el método existe y funciona
            const flows = InvestmentService.calculateCapitalFlows(db)

            expect(flows).toHaveProperty('externalInflows')
            expect(flows).toHaveProperty('reinvestmentInflows')
            expect(flows).toHaveProperty('outflows')
            expect(flows).toHaveProperty('netExternalFlow')

            // Los valores deben ser números no negativos
            expect(flows.externalInflows).toBeGreaterThanOrEqual(0)
            expect(flows.reinvestmentInflows).toBeGreaterThanOrEqual(0)
            expect(flows.outflows).toBeGreaterThanOrEqual(0)
        })

        it('NetExternalFlow debe igualar ExternalInflows - Outflows', () => {
            const flows = InvestmentService.calculateCapitalFlows(db)
            const expected = flows.externalInflows - flows.outflows

            expect(Math.abs(flows.netExternalFlow - expected)).toBeLessThan(0.01)
        })
    })

    describe('Conversión de Moneda (FX)', () => {
        it('Todas las transacciones PEN deben tener FX disponible', () => {
            // Obtener fechas únicas de transacciones PEN
            const penDates = db.prepare(`
        SELECT DISTINCT i.fecha
        FROM inversiones i
        JOIN tickers t ON t.id = i.ticker_id
        WHERE t.moneda = 'PEN'
        ORDER BY i.fecha
      `).all()

            // Para cada fecha, debe existir un FX (en esa fecha o una anterior)
            for (const { fecha } of penDates) {
                const fx = db.prepare(`
          SELECT usd_pen FROM tipos_cambio 
          WHERE fecha <= ? 
          ORDER BY fecha DESC 
          LIMIT 1
        `).get(fecha)

                expect(fx, `No hay FX disponible para fecha ${fecha}`).toBeDefined()
                expect(fx.usd_pen, `FX para ${fecha} es inválido`).toBeGreaterThan(0)
            }
        })

        it('No debe haber tipos de cambio con valores extremos', () => {
            // USD/PEN históricamente ha estado entre 2.5 y 4.5
            const fxOutOfRange = db.prepare(`
        SELECT fecha, usd_pen FROM tipos_cambio 
        WHERE usd_pen < 2.0 OR usd_pen > 5.0
      `).all()

            expect(fxOutOfRange.length, `Hay ${fxOutOfRange.length} registros FX fuera de rango`).toBe(0)
        })
    })

    describe('Cache de Portfolio', () => {
        it('portfolio_evolucion_diaria debe tener datos', () => {
            const count = db.prepare('SELECT COUNT(*) as c FROM portfolio_evolucion_diaria').get().c
            expect(count).toBeGreaterThan(0)
        })

        it('No debe haber días con inversión negativa', () => {
            const negative = db.prepare(`
        SELECT fecha, inversion_usd FROM portfolio_evolucion_diaria 
        WHERE inversion_usd < 0
      `).all()

            expect(negative.length, `Hay ${negative.length} días con inversión negativa`).toBe(0)
        })

        it('cache_metadata debe existir y tener datos', () => {
            const meta = db.prepare(`
        SELECT * FROM cache_metadata 
        WHERE cache_name = 'portfolio_evolucion_diaria'
      `).get()

            expect(meta).toBeDefined()
            expect(meta.last_invalidated_at).toBeDefined()
        })
    })

    describe('Consistencia de Datos', () => {
        it('Suma de posiciones abiertas debe ser mayor que 0', () => {
            const tickers = db.prepare('SELECT id FROM tickers').all()

            let totalInvested = 0
            for (const { id } of tickers) {
                const stats = InvestmentService.calculatePositionStats(db, id)
                totalInvested += stats.totalInvertido
            }

            expect(totalInvested).toBeGreaterThan(0)
        })

        it('Cada inversión debe tener ticker válido', () => {
            const orphans = db.prepare(`
        SELECT i.id, i.ticker_id 
        FROM inversiones i
        LEFT JOIN tickers t ON t.id = i.ticker_id
        WHERE t.id IS NULL
      `).all()

            expect(orphans.length, 'Hay inversiones huérfanas sin ticker').toBe(0)
        })

        it('Cada precio histórico debe tener ticker válido', () => {
            const orphans = db.prepare(`
        SELECT ph.id, ph.ticker_id 
        FROM precios_historicos ph
        LEFT JOIN tickers t ON t.id = ph.ticker_id
        WHERE t.id IS NULL
      `).all()

            expect(orphans.length, 'Hay precios históricos huérfanos').toBe(0)
        })
    })

    describe('Reglas de Negocio', () => {
        it('Desinversiones deben tener tipo_operacion correcto', () => {
            const invalid = db.prepare(`
        SELECT id, tipo_operacion FROM inversiones 
        WHERE tipo_operacion NOT IN ('INVERSION', 'DESINVERSION')
        AND tipo_operacion IS NOT NULL
      `).all()

            expect(invalid.length, `Hay ${invalid.length} transacciones con tipo inválido`).toBe(0)
        })

        it('origen_capital debe ser válido cuando está presente', () => {
            const validOrigins = ['FRESH_CASH', 'REINVERSION', 'DIVIDENDO']

            const invalid = db.prepare(`
        SELECT id, origen_capital FROM inversiones 
        WHERE origen_capital IS NOT NULL 
        AND origen_capital NOT IN ('FRESH_CASH', 'REINVERSION', 'DIVIDENDO', '')
      `).all()

            expect(invalid.length, `Hay ${invalid.length} transacciones con origen_capital inválido`).toBe(0)
        })
    })
})
