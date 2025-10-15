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
}
