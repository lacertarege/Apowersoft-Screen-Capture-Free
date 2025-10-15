// Sistema de caché en memoria simple
class MemoryCache {
  constructor() {
    this.cache = new Map()
    this.timers = new Map()
  }

  /**
   * Obtener valor del caché
   * @param {string} key - Clave del caché
   * @returns {any} Valor almacenado o null
   */
  get(key) {
    const item = this.cache.get(key)
    if (!item) return null

    // Verificar si ha expirado
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.delete(key)
      return null
    }

    return item.value
  }

  /**
   * Establecer valor en el caché
   * @param {string} key - Clave del caché
   * @param {any} value - Valor a almacenar
   * @param {number} ttl - Tiempo de vida en milisegundos
   */
  set(key, value, ttl = 300000) { // 5 minutos por defecto
    // Limpiar timer existente si hay uno
    const existingTimer = this.timers.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Establecer valor
    this.cache.set(key, {
      value,
      expiresAt: ttl > 0 ? Date.now() + ttl : null
    })

    // Configurar limpieza automática
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(key)
      }, ttl)
      this.timers.set(key, timer)
    }
  }

  /**
   * Eliminar valor del caché
   * @param {string} key - Clave del caché
   */
  delete(key) {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
    this.cache.delete(key)
  }

  /**
   * Limpiar todo el caché
   */
  clear() {
    // Limpiar todos los timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.cache.clear()
  }

  /**
   * Obtener o establecer valor (patrón cache-aside)
   * @param {string} key - Clave del caché
   * @param {Function} factory - Función para generar el valor si no existe
   * @param {number} ttl - Tiempo de vida en milisegundos
   * @returns {any} Valor del caché o generado
   */
  async getOrSet(key, factory, ttl = 300000) {
    let value = this.get(key)
    if (value !== null) {
      return value
    }

    // Generar valor usando la factory
    value = await factory()
    this.set(key, value, ttl)
    return value
  }

  /**
   * Invalidar caché por patrón
   * @param {string} pattern - Patrón de claves a invalidar
   */
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern)
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key)
      }
    }
  }

  /**
   * Obtener estadísticas del caché
   * @returns {Object} Estadísticas del caché
   */
  getStats() {
    const now = Date.now()
    let expired = 0
    let active = 0

    for (const item of this.cache.values()) {
      if (item.expiresAt && item.expiresAt <= now) {
        expired++
      } else {
        active++
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
      timers: this.timers.size
    }
  }
}

// Instancia global del caché
export const cache = new MemoryCache()

// Función helper para memoización con caché
export function memoizeAsync(fn, ttl = 300000) {
  return async (...args) => {
    const key = `${fn.name}:${JSON.stringify(args)}`
    return cache.getOrSet(key, () => fn(...args), ttl)
  }
}

// Función helper para invalidar caché de tickers
export function invalidateTickerCache(tickerId = null) {
  if (tickerId) {
    cache.invalidatePattern(`.*ticker.*${tickerId}.*`)
  } else {
    cache.invalidatePattern(`.*ticker.*`)
  }
}

// Función helper para invalidar caché de dashboard
export function invalidateDashboardCache() {
  cache.invalidatePattern(`.*dashboard.*`)
}