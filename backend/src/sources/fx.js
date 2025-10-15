import { request } from 'undici'

export async function fetchUsdPenForDate(dateStr){
  // Fuente principal: Decolecta API - Tipo de cambio SUNAT
  try {
    const r = await request(`https://api.decolecta.com/v1/tipo-cambio/sunat?date=${dateStr}`)
    const data = await r.body.json()
    // Según documentación, retorna objeto con campos: compra, venta, fecha
    // Usamos el precio de venta para convertir USD a PEN
    const rate = data?.venta
    if (rate && Number(rate) > 0) {
      console.log(`TC SUNAT obtenido para ${dateStr}: ${rate}`)
      return Number(rate)
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
  const d = new Date(dateStr)
  d.setDate(d.getDate()-1)
  if (d.toISOString().slice(0,10) !== dateStr) {
    return fetchUsdPenForDate(d.toISOString().slice(0,10))
  }
  
  throw new Error(`No exchange rate found for ${dateStr}`)
}