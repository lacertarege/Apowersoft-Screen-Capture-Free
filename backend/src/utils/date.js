/**
 * Utilidades para manejo de fechas en el huso horario de Lima, Perú (UTC-5)
 */

/**
 * Retorna la fecha actual en formato YYYY-MM-DD ajustada a la zona horaria de Lima.
 * @param {Date} date Objeto Date opcional (por defecto ahora)
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export function getLimaDate(date = new Date()) {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

/**
 * Retorna el año actual en Lima.
 * @returns {number}
 */
export function getLimaYear() {
    const dateStr = getLimaDate();
    return parseInt(dateStr.split('-')[0]);
}
