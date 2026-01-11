// Servicio de dominio para cálculos de inversiones
export class InvestmentService {
  /**
   * Calcula el rendimiento de una inversión
   * @param {number} cantidad - Cantidad de acciones/activos
   * @param {number} precioActual - Precio actual por unidad
   * @param {number} importeInvertido - Importe total invertido
   * @returns {number} Rendimiento en la moneda de la inversión
   */
  static calculateReturn(cantidad, precioActual, importeInvertido) {
    const valorActual = cantidad * precioActual
    return valorActual - importeInvertido
  }

  /**
   * Calcula la rentabilidad de una inversión
   * @param {number} rendimiento - Rendimiento calculado
   * @param {number} importeInvertido - Importe total invertido
   * @returns {number} Rentabilidad como porcentaje (0.1 = 10%)
   */
  static calculateReturnRate(rendimiento, importeInvertido) {
    if (importeInvertido === 0) return 0
    return rendimiento / importeInvertido
  }

  /**
   * Calcula el costo promedio de una inversión
   * @param {number} importeTotal - Importe total invertido
   * @param {number} cantidadTotal - Cantidad total de activos
   * @returns {number} Costo promedio por unidad
   */
  static calculateAverageCost(importeTotal, cantidadTotal) {
    if (cantidadTotal === 0) return 0
    return importeTotal / cantidadTotal
  }

  /**
   * Convierte moneda usando tipo de cambio
   * @param {number} amount - Cantidad a convertir
   * @param {string} fromCurrency - Moneda origen
   * @param {string} toCurrency - Moneda destino
   * @param {number} exchangeRate - Tipo de cambio
   * @returns {number} Cantidad convertida
   */
  static convertCurrency(amount, fromCurrency, toCurrency, exchangeRate) {
    if (fromCurrency === toCurrency) return amount

    if (fromCurrency === 'USD' && toCurrency === 'PEN') {
      return amount * exchangeRate
    }

    if (fromCurrency === 'PEN' && toCurrency === 'USD') {
      return amount / exchangeRate
    }

    return amount
  }

  /**
   * Valida datos de inversión
   * @param {Object} investmentData - Datos de la inversión
   * @returns {Object} Resultado de validación
   */
  static validateInvestment(investmentData) {
    const { fecha, importe, cantidad, plataforma } = investmentData
    const errors = []

    if (!fecha) {
      errors.push('Fecha es requerida')
    } else {
      const fechaObj = new Date(fecha)
      const hoy = new Date()
      hoy.setHours(23, 59, 59, 999) // Fin del día

      if (isNaN(fechaObj.getTime())) {
        errors.push('Fecha inválida')
      } else if (fechaObj > hoy) {
        errors.push('La fecha no puede ser futura')
      }
    }

    if (!importe || typeof importe !== 'number' || importe <= 0) {
      errors.push('Importe debe ser un número positivo')
    }

    if (!cantidad || typeof cantidad !== 'number' || cantidad <= 0) {
      errors.push('Cantidad debe ser un número positivo')
    }

    if (plataforma && typeof plataforma !== 'string') {
      errors.push('Plataforma debe ser una cadena de texto')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Valida datos de ticker
   * @param {Object} tickerData - Datos del ticker
   * @returns {Object} Resultado de validación
   */
  static validateTicker(tickerData) {
    const { ticker, nombre, moneda, tipo_inversion_id } = tickerData
    const errors = []

    if (!ticker || typeof ticker !== 'string' || ticker.trim().length === 0) {
      errors.push('Ticker es requerido y debe ser una cadena no vacía')
    }

    if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
      errors.push('Nombre es requerido y debe ser una cadena no vacía')
    }

    if (!moneda || !['USD', 'PEN'].includes(moneda.toUpperCase())) {
      errors.push('Moneda debe ser USD o PEN')
    }

    if (!tipo_inversion_id || !Number.isInteger(Number(tipo_inversion_id)) || Number(tipo_inversion_id) <= 0) {
      errors.push('Tipo de inversión debe ser un entero positivo')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Calcula estadísticas de portfolio
   * @param {Array} investments - Array de inversiones
   * @param {string} currency - Moneda base para cálculos
   * @param {number} exchangeRate - Tipo de cambio si es necesario
   * @returns {Object} Estadísticas del portfolio
   */
  static calculatePortfolioStats(investments, currency = 'USD', exchangeRate = 1) {
    let totalInvested = 0
    let totalValue = 0
    let totalReturn = 0

    for (const inv of investments) {
      const invested = inv.importe_total || 0
      const value = inv.balance || 0
      const returnAmount = inv.rendimiento || 0

      // Convertir a moneda base si es necesario
      const convertedInvested = this.convertCurrency(invested, inv.moneda, currency, exchangeRate)
      const convertedValue = this.convertCurrency(value, inv.moneda, currency, exchangeRate)
      const convertedReturn = this.convertCurrency(returnAmount, inv.moneda, currency, exchangeRate)

      totalInvested += convertedInvested
      totalValue += convertedValue
      totalReturn += convertedReturn
    }

    const returnRate = totalInvested > 0 ? totalReturn / totalInvested : 0

    return {
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalValue: Math.round(totalValue * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      returnRate: Math.round(returnRate * 10000) / 10000, // 4 decimales
      currency
    }
  }

  /**
   * Calcula el stock actual (neto) de un activo hasta una fecha específica
   * @param {object} db - Instancia de base de datos
   * @param {number} tickerId - ID del ticker
   * @param {string} upToDate - Fecha hasta la cual calcular (YYYY-MM-DD)
   * @returns {number} Stock neto (INVERSIONES - DESINVERSIONES)
   */
  static calculateCurrentStock(db, tickerId, upToDate) {
    const result = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo_operacion = 'INVERSION' THEN cantidad ELSE 0 END), 0) as inversiones,
        COALESCE(SUM(CASE WHEN tipo_operacion = 'DESINVERSION' THEN cantidad ELSE 0 END), 0) as desinversiones
      FROM inversiones
      WHERE ticker_id = ? AND fecha <= ?
    `).get(tickerId, upToDate)

    return result.inversiones - result.desinversiones
  }

  /**
   * Calcula el Costo Promedio Ponderado (CPP) de las inversiones
   * @param {object} db - Instancia de base de datos
   * @param {number} tickerId - ID del ticker
   * @param {string} upToDate - Fecha hasta la cual calcular (YYYY-MM-DD)
   * @returns {number} Costo promedio ponderado
   */
  static calculateWeightedAverageCost(db, tickerId, upToDate) {
    const result = db.prepare(`
      SELECT 
        SUM(importe) as total_invertido,
        SUM(cantidad) as total_cantidad
      FROM inversiones
      WHERE ticker_id = ? AND tipo_operacion = 'INVERSION' AND fecha <= ?
    `).get(tickerId, upToDate)

    if (!result.total_cantidad || result.total_cantidad === 0) {
      return 0
    }

    return result.total_invertido / result.total_cantidad
  }

  /**
   * Calcula el rendimiento y rentabilidad realizados de una desinversión
   * @param {number} amountReceived - Importe recibido por la venta
   * @param {number} quantitySold - Cantidad vendida
   * @param {number} weightedAverageCost - Costo promedio ponderado
   * @returns {object} { amount: número, rate: porcentaje }
   */
  static calculateRealizedReturn(amountReceived, quantitySold, weightedAverageCost) {
    const costBasis = weightedAverageCost * quantitySold
    const realizedAmount = amountReceived - costBasis

    let realizedRate = 0
    if (costBasis > 0) {
      realizedRate = (realizedAmount / costBasis) * 100
    }

    return {
      amount: Math.round(realizedAmount * 100) / 100,
      rate: Math.round(realizedRate * 100) / 100,
      costBasis: Math.round(costBasis * 100) / 100
    }
  }

  /**
   * Calcula estadísticas de posición precisas (CPP iterativo)
   * @param {object} db - Instancia de base de datos
   * @param {number} tickerId - ID del ticker
   * @param {string} [upToDate] - Fecha de corte (opcional)
   * @returns {object} { cantidad, cpp, totalInvertido, gananciaRealizada }
   */
  static calculatePositionStats(db, tickerId, upToDate = null) {
    let query = `SELECT * FROM inversiones WHERE ticker_id = ?`
    const params = [tickerId]

    if (upToDate) {
      query += ` AND fecha <= ?`
      params.push(upToDate)
    }

    query += ` ORDER BY fecha ASC, id ASC`

    const transactions = db.prepare(query).all(...params)

    let currentQty = 0
    let currentCpp = 0
    let totalRealizedGain = 0

    for (const tx of transactions) {
      const qty = Number(tx.cantidad)
      const amount = Number(tx.importe)
      const price = qty !== 0 ? amount / qty : 0

      if (tx.tipo_operacion === 'INVERSION') {
        const prevCost = currentQty * currentCpp
        const newCost = amount // INVERSION amount is cost
        currentQty += qty

        // Regla 1: CPP se actualiza en COMPRA
        // Regla 3: Si se estaba en 0 (o negativo/muy bajo por float), el nuevo CPP es simplemente el precio de compra
        if (currentQty > 0.000001) {
          currentCpp = (prevCost + newCost) / currentQty
        } else {
          currentCpp = 0
        }

      } else if (tx.tipo_operacion === 'DESINVERSION') {
        // Regla 2: CPP se mantiene en VENTA
        const soldQty = qty
        // Ganancia realizada en esta venta = (Precio Venta - CPP) * Cantidad
        const costBasis = soldQty * currentCpp
        const saleProceeds = amount // DESINVERSION amount is proceeds
        totalRealizedGain += (saleProceeds - costBasis)

        currentQty -= soldQty

        // Regla 3: Reset si llega a 0
        if (currentQty <= 0.000001) {
          currentQty = 0
          currentCpp = 0
        }
      }
    }

    return {
      cantidad: currentQty,
      cpp: currentCpp,
      totalInvertido: currentQty * currentCpp,
      gananciaRealizada: totalRealizedGain
    }
  }

  /**
   * Valida una operación de desinversión
   * @param {object} investmentData - Datos de la desinversión
   * @param {number} currentStock - Stock actual disponible
   * @returns {object} Resultado de validación
   */
  static validateDivestment(investmentData, currentStock) {
    const { fecha, importe, cantidad } = investmentData
    const errors = []

    // Validaciones básicas heredadas
    const basicValidation = this.validateInvestment(investmentData)
    if (!basicValidation.isValid) {
      errors.push(...basicValidation.errors)
    }

    // Validación específica: stock disponible
    if (cantidad > currentStock + 0.000001) { // Error margin for logic check
      errors.push(`Stock insuficiente. Disponible: ${currentStock}, intentando retirar: ${cantidad}`)
    }

    // Validación: cantidad debe ser positiva (desinversión negativa no tiene sentido)
    if (cantidad < 0) {
      errors.push('La cantidad a desinvertir debe ser positiva')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}
