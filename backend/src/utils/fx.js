/**
 * Utilidades para manejo de tipos de cambio (FX)
 * Centraliza la lógica de obtención de FX para evitar fallbacks hardcodeados
 */

/**
 * Obtiene el tipo de cambio USD/PEN para una fecha
 * Usa el último conocido si no existe para la fecha exacta
 * @param {Database} db
 * @param {string} fecha - YYYY-MM-DD
 * @returns {number} Tipo de cambio
 * @throws {Error} Si no hay ningún tipo de cambio registrado
 */
export function getFxForDate(db, fecha) {
    // Buscar FX exacto o el más reciente anterior
    const fx = db.prepare(`
    SELECT usd_pen 
    FROM tipos_cambio 
    WHERE fecha <= ? 
    ORDER BY fecha DESC 
    LIMIT 1
  `).get(fecha)

    if (fx) {
        return fx.usd_pen
    }

    // Si no hay FX anterior, buscar el más antiguo disponible (para fechas muy antiguas)
    const oldest = db.prepare(`
    SELECT usd_pen FROM tipos_cambio ORDER BY fecha ASC LIMIT 1
  `).get()

    if (!oldest) {
        throw new Error(`No hay tipos de cambio registrados. Registre al menos uno antes de continuar.`)
    }

    return oldest.usd_pen
}

/**
 * Construye un mapa de FX para iteración eficiente
 * @param {Database} db
 * @param {string} toDate - Fecha límite
 * @returns {Object} { fxMap: {fecha: rate}, initialFx: number|null }
 */
export function buildFxMap(db, toDate) {
    const fxHistory = db.prepare(`
    SELECT fecha, usd_pen 
    FROM tipos_cambio 
    WHERE fecha <= ? 
    ORDER BY fecha ASC
  `).all(toDate)

    const fxMap = {}
    let lastKnownFx = null

    for (const row of fxHistory) {
        fxMap[row.fecha] = row.usd_pen
        lastKnownFx = row.usd_pen
    }

    // Si no hay FX antes del rango, buscar cualquiera disponible
    if (!lastKnownFx && fxHistory.length === 0) {
        const any = db.prepare('SELECT usd_pen FROM tipos_cambio ORDER BY fecha ASC LIMIT 1').get()
        if (any) lastKnownFx = any.usd_pen
    }

    return { fxMap, initialFx: lastKnownFx }
}

/**
 * Obtiene FX de un mapa con fallback al último conocido
 * Para uso en loops diarios
 * @param {Object} fxMap - Mapa de fechas a FX
 * @param {string} fecha - Fecha a buscar
 * @param {number} lastKnown - Último FX conocido
 * @returns {number} Tipo de cambio
 */
export function getFxFromMap(fxMap, fecha, lastKnown) {
    if (fxMap[fecha]) {
        return fxMap[fecha]
    }
    return lastKnown
}
