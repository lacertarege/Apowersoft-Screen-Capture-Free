
export class PriceRepository {
  constructor(db) {
    this.db = db
  }

  /**
   * Insertar o actualizar un precio histórico
   * @param {Object} priceData
   */
  upsert(priceData) {
    const { ticker_id, fecha, precio, fuente_api } = priceData
    
    // Validación básica (Clean Code: Fail Fast)
    if (!ticker_id || !fecha || precio === undefined) {
      throw new Error('PriceRepository.upsert: faltan datos obligatorios (ticker_id, fecha, precio)')
    }

    const stmt = this.db.prepare(`
      INSERT INTO precios_historicos (ticker_id, fecha, precio, fuente_api, updated_at)
      VALUES (@ticker_id, @fecha, @precio, @fuente_api, @updated_at)
      ON CONFLICT(ticker_id, fecha) DO UPDATE SET 
        precio=excluded.precio, 
        fuente_api=excluded.fuente_api, 
        updated_at=excluded.updated_at
    `)

    return stmt.run({
      ticker_id,
      fecha,
      precio,
      fuente_api: fuente_api || 'unknown',
      updated_at: new Date().toISOString()
    })
  }

  /**
   * Operación en lote para insertar múltiples precios (Performance)
   * @param {Array} pricesArray 
   */
  upsertBatch(pricesArray) {
    if (!Array.isArray(pricesArray) || pricesArray.length === 0) return

    const insert = this.db.prepare(`
      INSERT INTO precios_historicos (ticker_id, fecha, precio, fuente_api, updated_at)
      VALUES (@ticker_id, @fecha, @precio, @fuente_api, @updated_at)
      ON CONFLICT(ticker_id, fecha) DO UPDATE SET 
        precio=excluded.precio, 
        fuente_api=excluded.fuente_api, 
        updated_at=excluded.updated_at
    `)

    const nowIso = new Date().toISOString()
    
    // Transacción para consistencia y velocidad
    const tx = this.db.transaction((rows) => {
      for (const r of rows) {
        insert.run({
          ticker_id: r.ticker_id,
          fecha: r.fecha,
          precio: r.precio,
          fuente_api: r.fuente_api || 'unknown',
          updated_at: nowIso
        })
      }
    })

    tx(pricesArray)
    return pricesArray.length
  }
}
