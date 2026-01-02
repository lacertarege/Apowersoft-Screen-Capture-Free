import { request } from 'undici'

export async function fetchUsdPenForDate(dateStr) {
  // Fuente principal: Decolecta API - Tipo de cambio SUNAT
  try {
    const r = await request(`https://api.decolecta.com/v1/tipo-cambio/sunat?date=${dateStr}`)
    const bodyStr = await r.body.text()

    if (r.statusCode !== 200) {
      console.warn(`Decolecta returned status ${r.statusCode} for ${dateStr}`)
    } else if (bodyStr.trim().startsWith('{')) {
      const data = JSON.parse(bodyStr)
      const rate = data?.venta
      if (rate && Number(rate) > 0) {
        console.log(`TC SUNAT obtenido para ${dateStr}: ${rate}`)
        return Number(rate)
      }
    } else {
      console.warn(`Decolecta returned non-JSON response for ${dateStr}`)
    }
  } catch (e) {
    console.warn(`Error fetching USD-PEN for ${dateStr} from Decolecta:`, e.message)
  }

  // Fallback: Frankfurter API
  try {
    const r = await request(`https://api.frankfurter.app/${dateStr}?from=USD&to=PEN`)
    const data = await r.body.json()
    const rate = data?.rates?.PEN
    if (rate) {
      console.log(`TCO Frankfurter obtenido para ${dateStr}: ${rate}`)
      return rate
    }
  } catch (e) {
    console.warn(`Error fetching USD-PEN for ${dateStr} from Frankfurter:`, e.message)
  }

  // Último fallback: día anterior
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  const prevDate = d.toISOString().slice(0, 10)
  if (prevDate !== dateStr) {
    return fetchUsdPenForDate(prevDate)
  }

  throw new Error(`No exchange rate found for ${dateStr}`)
}