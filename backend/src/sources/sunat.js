import { request } from 'undici'

/**
 * Obtiene los tipos de cambio desde la API de decolecta.com
 * 
 * Esta API es un proxy que consulta los datos oficiales de SUNAT/SBS y los devuelve en formato JSON.
 * 
 * - API gratuita (requiere registro en https://apis.net.pe/app para obtener token)
 * - Retorna JSON limpio (no requiere scraping HTML ni cookies de sesión)
 * - Datos oficiales de SUNAT publicados por SBS
 * - Documentación: https://apis.net.pe/api-tipo-cambio.html
 * 
 * @param {string} apiToken - Token de autenticación (obtener en https://apis.net.pe/app)
 * @param {string} date - Fecha en formato YYYY-MM-DD (opcional, por defecto hoy)
 * @param {number} month - Mes para consultar todo el mes (1-12, requiere year)
 * @param {number} year - Año para consultar (requiere month)
 * @returns {Promise<Array>} Array de objetos {fecha, usd_pen}
 */
export async function fetchSunatExchangeRates(apiToken = null, date = null, month = null, year = null) {
    // URL base de la API
    let url = 'https://api.decolecta.com/v1/tipo-cambio/sunat'

    // Construir query params
    const params = new URLSearchParams()
    if (date) {
        params.append('date', date)
    } else if (month && year) {
        params.append('month', month)
        params.append('year', year)
    }

    if (params.toString()) {
        url += `?${params.toString()}`
    }

    console.log('[DECOLECTA] Consultando API de tipo de cambio...')
    console.log(`[DECOLECTA] URL: ${url}`)

    try {
        const headers = {
            'Accept': 'application/json',
            'Referer': 'https://apis.net.pe/tipo-de-cambio-sunat-api',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        // Si hay token, agregarlo como Authorization header
        if (apiToken) {
            headers['Authorization'] = `Bearer ${apiToken}`
            console.log('[DECOLECTA] Usando token de autenticación')
        } else {
            console.warn('[DECOLECTA] Sin token - puede fallar. Obtén tu token gratis en https://apis.net.pe/app')
        }

        const response = await request(url, {
            method: 'GET',
            headers,
            bodyTimeout: 15000,
            headersTimeout: 15000
        })

        if (response.statusCode !== 200) {
            throw new Error(`API returned status ${response.statusCode}`)
        }

        const body = await response.body.json()

        // Verificar si hay error
        if (body.error) {
            console.error('[DECOLECTA] Error de la API:', body.error)

            // Si el error es por falta de API key, dar instrucciones claras
            if (body.error.includes('Apikey Required') || body.error.includes('Limit Exceeded')) {
                throw new Error(
                    'Se requiere token de API. ' +
                    'Regístrate gratis en https://apis.net.pe/app y configura la variable de entorno DECOLECTA_API_TOKEN'
                )
            }

            throw new Error(body.error)
        }

        console.log('[DECOLECTA] Respuesta recibida')

        // La

        // La API puede retornar un solo objeto o un array
        const data = Array.isArray(body) ? body : [body]
        console.log(`[DECOLECTA] Procesando ${data.length} registros`)

        // Procesar los datos
        const results = []

        for (const item of data) {
            try {
                // La API retorna: { date: "YYYY-MM-DD", buy_price: "3.359", sell_price: "3.368", base_currency: "USD", quote_currency: "PEN" }
                if (!item.date || !item.sell_price) {
                    console.warn('[DECOLECTA] Registro sin fecha o precio de venta:', item)
                    continue
                }

                // Usar el precio de venta (sell_price) como valor estándar
                const usd_pen = parseFloat(item.sell_price)

                if (isNaN(usd_pen) || usd_pen <= 0) {
                    console.warn('[DECOLECTA] Precio inválido:', item.sell_price)
                    continue
                }

                results.push({
                    fecha: item.date, // Ya viene en formato YYYY-MM-DD
                    usd_pen
                })
            } catch (e) {
                console.warn('[DECOLECTA] Error procesando registro:', item, e.message)
            }
        }

        console.log(`[DECOLECTA] Procesados ${results.length} registros válidos`)
        return results

    } catch (error) {
        console.error('[DECOLECTA] Error al consultar API:', error.message)
        throw new Error(`Error consultando Decolecta: ${error.message}`)
    }
}
