/**
 * Job para actualizar el caché de benchmarks (SPY, EPU)
 * Pre-calcula los retornos anuales para evitar llamadas API lentas en runtime
 */

export async function updateBenchmarksJob(db) {
    console.log('Iniciando actualización de benchmarks...')

    try {
        const { fetchDailyHistory } = await import('../sources/marketData.js')

        // Get current year and year range from investments
        const currentYear = new Date().getFullYear()
        const firstInv = db.prepare('SELECT MIN(fecha) as f FROM inversiones').get()

        if (!firstInv || !firstInv.f) {
            console.log('No hay inversiones registradas, saltando actualización de benchmarks')
            return
        }

        const firstYear = parseInt(firstInv.f.split('-')[0])

        // Benchmarks to track
        const benchmarks = [
            { ticker: 'SPY', name: 'S&P 500' },
            { ticker: 'EPU', name: 'S&P/BVL Peru General' }
        ]

        let updated = 0
        let cached = 0
        let errors = 0

        // Update benchmarks for each year
        for (let year = firstYear; year <= currentYear; year++) {
            const startDate = `${year}-01-01`
            const endDate = year === currentYear
                ? new Date().toISOString().slice(0, 10) // Today if current year
                : `${year}-12-31`

            for (const bm of benchmarks) {
                try {
                    // Check if cache exists and is recent (less than 24h old)
                    const existing = db.prepare(`
            SELECT cached_at FROM benchmark_cache 
            WHERE ticker = ? AND year = ?
          `).get(bm.ticker, year)

                    if (existing) {
                        const cachedAt = new Date(existing.cached_at)
                        const now = new Date()
                        const ageHours = (now - cachedAt) / (1000 * 60 * 60)

                        // Skip if cached less than 23 hours ago (keep cache fresh but avoid excessive updates)
                        if (ageHours < 23) {
                            cached++
                            continue
                        }
                    }

                    // Fetch prices from API
                    const priceStart = await getPriceNearDate(fetchDailyHistory, bm.ticker, startDate, 'after')
                    const priceEnd = await getPriceNearDate(fetchDailyHistory, bm.ticker, endDate, 'before')

                    if (!priceStart || !priceEnd) {
                        console.log(`⚠️  No se pudo obtener precios para ${bm.ticker} ${year}`)
                        errors++
                        continue
                    }

                    const returnPct = Number((((priceEnd / priceStart) - 1) * 100).toFixed(2))

                    // Upsert cache
                    db.prepare(`
            INSERT INTO benchmark_cache (ticker, year, start_date, end_date, return_pct, cached_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(ticker, year) DO UPDATE SET
              start_date = excluded.start_date,
              end_date = excluded.end_date,
              return_pct = excluded.return_pct,
              cached_at = excluded.cached_at
          `).run(bm.ticker, year, startDate, endDate, returnPct)

                    console.log(`✓ ${bm.ticker} ${year}: ${returnPct}%`)
                    updated++

                } catch (error) {
                    console.error(`Error actualizando ${bm.ticker} ${year}:`, error.message)
                    errors++
                }
            }
        }

        console.log(`✓ Benchmarks actualizados: ${updated} nuevos, ${cached} en caché, ${errors} errores`)
        return { updated, cached, errors }

    } catch (error) {
        console.error('Error actualizando benchmarks:', error)
        throw error
    }
}

/**
 * Helper function to get price near a date
 * (Duplicated from dashboard.js to avoid circular dependency)
 */
async function getPriceNearDate(fetch, ticker, date, direction) {
    try {
        const exact = await fetch(ticker, date, date)
        if (exact?.items?.length > 0) return exact.items[0].precio

        const dt = new Date(date)
        let start, end

        if (direction === 'before') {
            end = date
            dt.setDate(dt.getDate() - 15)
            start = dt.toISOString().slice(0, 10)
        } else {
            start = date
            dt.setDate(dt.getDate() + 15)
            end = dt.toISOString().slice(0, 10)
        }

        const range = await fetch(ticker, start, end)
        if (range?.items?.length > 0) {
            return direction === 'before'
                ? range.items[range.items.length - 1].precio
                : range.items[0].precio
        }

        return null
    } catch (error) {
        console.error(`Error fetching price for ${ticker} near ${date}:`, error)
        return null
    }
}
