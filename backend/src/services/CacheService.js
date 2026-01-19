/**
 * Servicio de gestión de cache con invalidación automática
 * Garantiza que los datos de cache se recalculen cuando hay cambios
 */

export class CacheService {
    /**
     * Invalida el cache de evolución del portfolio
     * @param {Database} db
     * @param {string} reason - Razón de la invalidación
     */
    static invalidatePortfolioCache(db, reason = 'data_change') {
        // Asegurar que la tabla de metadata existe
        db.prepare(`
      CREATE TABLE IF NOT EXISTS cache_metadata (
        cache_name TEXT PRIMARY KEY,
        last_invalidated_at TEXT NOT NULL,
        last_rebuilt_at TEXT,
        invalidation_reason TEXT
      )
    `).run()

        // Insertar o actualizar metadata
        db.prepare(`
      INSERT INTO cache_metadata (cache_name, last_invalidated_at, invalidation_reason)
      VALUES ('portfolio_evolucion_diaria', datetime('now'), ?)
      ON CONFLICT(cache_name) DO UPDATE SET
        last_invalidated_at = datetime('now'),
        invalidation_reason = excluded.invalidation_reason
    `).run(reason)
    }

    /**
     * Verifica si el cache es válido
     * @param {Database} db
     * @returns {boolean}
     */
    static isCacheValid(db) {
        try {
            const meta = db.prepare(`
        SELECT last_invalidated_at, last_rebuilt_at
        FROM cache_metadata
        WHERE cache_name = 'portfolio_evolucion_diaria'
      `).get()

            if (!meta) return false
            if (!meta.last_rebuilt_at) return false

            return meta.last_rebuilt_at > meta.last_invalidated_at
        } catch (e) {
            // Tabla no existe aún
            return false
        }
    }

    /**
     * Marca el cache como reconstruido
     * @param {Database} db
     */
    static markCacheRebuilt(db) {
        db.prepare(`
      UPDATE cache_metadata 
      SET last_rebuilt_at = datetime('now')
      WHERE cache_name = 'portfolio_evolucion_diaria'
    `).run()
    }

    /**
     * Obtiene el estado actual del cache
     * @param {Database} db
     * @returns {Object|null}
     */
    static getCacheStatus(db) {
        try {
            return db.prepare(`
        SELECT * FROM cache_metadata
        WHERE cache_name = 'portfolio_evolucion_diaria'
      `).get()
        } catch (e) {
            return null
        }
    }
}
