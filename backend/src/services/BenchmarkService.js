/**
 * BenchmarkService - Handles benchmark calculations and caching
 * Extracted from dashboard.js for Single Responsibility Principle
 */

/**
 * Get price near a specific date, searching before or after
 * @param {Function} fetchDailyHistory - Function to fetch price history
 * @param {string} ticker - Ticker symbol
 * @param {string} date - Target date
 * @param {string} direction - 'before' or 'after'
 * @returns {Promise<number|null>} - Price or null
 */
export async function getPriceNearDate(fetchDailyHistory, ticker, date, direction) {
    const exact = await fetchDailyHistory(ticker, date, date)
    if (exact?.items?.length > 0) return exact.items[0].precio

    const dt = new Date(date)
    let startDate, endDate

    if (direction === 'before') {
        endDate = date
        dt.setDate(dt.getDate() - 15)
        startDate = dt.toISOString().slice(0, 10)
    } else {
        startDate = date
        dt.setDate(dt.getDate() + 15)
        endDate = dt.toISOString().slice(0, 10)
    }

    const range = await fetchDailyHistory(ticker, startDate, endDate)
    if (range?.items?.length > 0) {
        return direction === 'before'
            ? range.items[range.items.length - 1].precio
            : range.items[0].precio
    }

    return null
}

/**
 * Get cached benchmark return or fetch and cache if not exists
 * @param {Database} db - SQLite database instance
 * @param {Function} fetchDailyHistory - Function to fetch price history
 * @param {string} ticker - Benchmark ticker (e.g., 'SPY', 'EPU')
 * @param {number} year - Year for the benchmark
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<number|null>} - Return percentage or null if not available
 */
export async function getCachedBenchmark(db, fetchDailyHistory, ticker, year, startDate, endDate) {
    try {
        // Check cache first (with 24h TTL)
        const cached = db.prepare(`
      SELECT return_pct, cached_at 
      FROM benchmark_cache 
      WHERE ticker = ? AND year = ?
    `).get(ticker, year)

        if (cached) {
            const cachedAt = new Date(cached.cached_at)
            const now = new Date()
            const ageHours = (now - cachedAt) / (1000 * 60 * 60)

            // If cache is less than 24h old, return cached value
            if (ageHours < 24) {
                return cached.return_pct
            }
        }

        // Cache miss or expired - fetch from API
        const priceStart = await getPriceNearDate(fetchDailyHistory, ticker, startDate, 'after')
        const priceEnd = await getPriceNearDate(fetchDailyHistory, ticker, endDate, 'before')

        if (!priceStart || !priceEnd) return null

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
    `).run(ticker, year, startDate, endDate, returnPct)

        return returnPct

    } catch (error) {
        console.error(`Error fetching benchmark ${ticker} for year ${year}:`, error)
        return null
    }
}

/**
 * Get all benchmarks for a year using cache
 * @param {Database} db - SQLite database instance
 * @param {Function} fetchDailyHistory - Function to fetch price history
 * @param {number} year - Year for benchmarks
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Object with benchmark keys and return percentages
 */
export async function getBenchmarksForYear(db, fetchDailyHistory, year, startDate, endDate) {
    const BENCHMARK_TICKERS = [
        { key: 'sp500', ticker: 'SPY' },
        { key: 'sp_bvl_gen', ticker: 'EPU' }
    ]

    // Fetch all benchmarks in parallel
    const results = await Promise.all(
        BENCHMARK_TICKERS.map(async (bm) => {
            const returnPct = await getCachedBenchmark(db, fetchDailyHistory, bm.ticker, year, startDate, endDate)
            return { key: bm.key, value: returnPct }
        })
    )

    // Build result object
    const benchmarks = {}
    results.forEach(r => {
        if (r.value !== null) {
            benchmarks[r.key] = r.value
        }
    })

    return benchmarks
}

/**
 * Calculate portfolio balance at a specific date
 * @param {Database} db - SQLite database instance
 * @param {number[]} tickerIds - Array of ticker IDs
 * @param {string} date - Date to calculate balance for
 * @param {number} fxRate - USD/PEN exchange rate
 * @returns {number} - Total balance in USD
 */
export function calculateBalanceAtDate(db, tickerIds, date, fxRate) {
    let total = 0

    tickerIds.forEach(id => {
        const result = db.prepare(`
      SELECT SUM(cantidad) as quantity 
      FROM inversiones 
      WHERE ticker_id = ? AND fecha <= ?
    `).get(id, date)

        const quantity = result?.quantity || 0

        if (quantity > 0) {
            const priceRow = db.prepare(`
        SELECT precio 
        FROM precios_historicos 
        WHERE ticker_id = ? AND fecha <= ? 
        ORDER BY fecha DESC 
        LIMIT 1
      `).get(id, date)

            const price = priceRow?.precio || 0
            const currency = db.prepare('SELECT moneda FROM tickers WHERE id = ?').get(id)?.moneda

            // Convert to USD if needed
            total += (currency === 'USD')
                ? quantity * price
                : (quantity * price) / fxRate
        }
    })

    return total
}
