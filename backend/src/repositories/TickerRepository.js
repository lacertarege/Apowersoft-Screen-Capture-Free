// Repositorio para manejo de tickers
export class TickerRepository {
  constructor(db) {
    this.db = db
  }

  /**
   * Buscar todos los tickers con filtros
   * @param {Object} filters - Filtros de búsqueda
   * @returns {Array} Lista de tickers
   */
  findAll(filters = {}) {
    const { q = '', page = 1, pageSize = 20, moneda } = filters
    const offset = (Number(page) - 1) * Number(pageSize)
    
    let whereClause = 'WHERE 1=1'
    const params = []
    
    if (q) {
      whereClause += ' AND (v.ticker LIKE ? OR v.nombre LIKE ?)'
      params.push(`%${q}%`, `%${q}%`)
    }
    
    if (moneda) {
      whereClause += ' AND v.moneda = ?'
      params.push(moneda)
    }
    
    params.push(Number(pageSize), offset)
    
    const query = `
      SELECT
        v.id,
        v.ticker,
        v.nombre,
        v.moneda,
        v.tipo_inversion_id,
        v.tipo_inversion_nombre,
        v.primera_compra,
        v.importe_total,
        v.cantidad_total,
        v.fecha,
        v.precio_reciente,
        v.balance,
        v.rendimiento,
        v.rentabilidad
      FROM v_resumen_empresas v
      ${whereClause}
      ORDER BY v.ticker
      LIMIT ? OFFSET ?
    `
    
    return this.db.prepare(query).all(...params)
  }

  /**
   * Contar total de tickers con filtros
   * @param {Object} filters - Filtros de búsqueda
   * @returns {number} Total de registros
   */
  count(filters = {}) {
    const { q = '', moneda } = filters
    
    let whereClause = 'WHERE 1=1'
    const params = []
    
    if (q) {
      whereClause += ' AND (v.ticker LIKE ? OR v.nombre LIKE ?)'
      params.push(`%${q}%`, `%${q}%`)
    }
    
    if (moneda) {
      whereClause += ' AND v.moneda = ?'
      params.push(moneda)
    }
    
    const query = `SELECT COUNT(*) as count FROM v_resumen_empresas v ${whereClause}`
    return this.db.prepare(query).get(...params).count
  }

  /**
   * Buscar ticker por ID
   * @param {number} id - ID del ticker
   * @returns {Object|null} Ticker encontrado
   */
  findById(id) {
    const query = `
      SELECT
        t.*,
        ph.precio as precio_reciente,
        ph.fecha as fecha_precio_reciente
      FROM tickers t
      LEFT JOIN (
        SELECT
          ticker_id,
          precio,
          fecha
        FROM precios_historicos
        WHERE (ticker_id, fecha) IN (
          SELECT ticker_id, MAX(fecha) FROM precios_historicos GROUP BY ticker_id
        )
      ) ph ON t.id = ph.ticker_id
      WHERE t.id = ?
    `
    return this.db.prepare(query).get(id)
  }

  /**
   * Crear nuevo ticker
   * @param {Object} tickerData - Datos del ticker
   * @returns {Object} Ticker creado
   */
  create(tickerData) {
    const { ticker, nombre, moneda, tipo_inversion_id } = tickerData

    // --- VALIDACION DE ENTRADA ---
    if (!ticker || typeof ticker !== 'string' || ticker.trim().length === 0) {
      throw new Error('El campo "ticker" es obligatorio y no puede estar vacío.')
    }
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
      throw new Error('El campo "nombre" es obligatorio y no puede estar vacío.')
    }
    if (!tipo_inversion_id || typeof tipo_inversion_id !== 'number') {
      throw new Error('El campo "tipo_inversion_id" es obligatorio y debe ser un número.')
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO tickers (ticker, nombre, moneda, tipo_inversion_id) 
      VALUES (UPPER(?), ?, ?, ?)
    `)
    
    const result = stmt.run(ticker.trim(), nombre.trim(), moneda.toUpperCase(), Number(tipo_inversion_id))
    return { id: result.lastInsertRowid, ...tickerData }
  }

  /**
   * Actualizar ticker
   * @param {number} id - ID del ticker
   * @param {Object} updateData - Datos a actualizar
   * @returns {Object} Resultado de la actualización
   */
  update(id, updateData) {
    const { moneda, tipo_inversion_id } = updateData
    const updates = []
    const values = []
    
    if (moneda) {
      updates.push('moneda = ?')
      values.push(moneda.toUpperCase())
    }
    
    if (tipo_inversion_id) {
      updates.push('tipo_inversion_id = ?')
      values.push(Number(tipo_inversion_id))
    }
    
    if (updates.length === 0) {
      return { changes: 0 }
    }
    
    values.push(id)
    
    const stmt = this.db.prepare(`UPDATE tickers SET ${updates.join(', ')} WHERE id = ?`)
    const result = stmt.run(...values)
    
    return { changes: result.changes }
  }

  /**
   * Eliminar ticker
   * @param {number} id - ID del ticker
   * @returns {boolean} True si se eliminó correctamente
   */
  delete(id) {
    // Verificar si tiene inversiones
    const invCount = this.db.prepare('SELECT COUNT(*) as count FROM inversiones WHERE ticker_id = ?').get(id).count
    if (invCount > 0) {
      throw new Error('No se puede eliminar: existen inversiones')
    }
    
    const stmt = this.db.prepare('DELETE FROM tickers WHERE id = ?')
    const result = stmt.run(id)
    
    return result.changes > 0
  }

  /**
   * Verificar si existe un ticker
   * @param {string} ticker - Símbolo del ticker
   * @returns {boolean} True si existe
   */
  exists(ticker) {
    const result = this.db.prepare('SELECT id FROM tickers WHERE ticker = UPPER(?)').get(ticker)
    return !!result
  }

  /**
   * Obtener inversiones de un ticker
   * @param {number} tickerId - ID del ticker
   * @returns {Array} Lista de inversiones
   */
  getInvestments(tickerId) {
    return this.db.prepare(`
      SELECT * FROM inversiones 
      WHERE ticker_id = ? 
      ORDER BY fecha DESC
    `).all(tickerId)
  }

  /**
   * Crear inversión para un ticker
   * @param {number} tickerId - ID del ticker
   * @param {Object} investmentData - Datos de la inversión
   * @returns {Object} Inversión creada
   */
  createInvestment(tickerId, investmentData) {
    const { fecha, importe, cantidad, plataforma } = investmentData
    const apertura = importe / cantidad
    
    const stmt = this.db.prepare(`
      INSERT INTO inversiones (ticker_id, fecha, importe, cantidad, apertura_guardada, plataforma) 
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(tickerId, fecha, importe, cantidad, apertura, plataforma || null)
    return { id: result.lastInsertRowid, ...investmentData, apertura_guardada: apertura }
  }
}
