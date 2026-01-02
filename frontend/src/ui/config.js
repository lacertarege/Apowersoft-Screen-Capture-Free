export const API = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API) ? import.meta.env.VITE_API : 'http://localhost:3002'

// Función para verificar la conexión con el backend
export async function checkBackendConnection() {
  try {
    const response = await fetch(`${API}/health`)
    const data = await response.json()
    return { connected: true, data }
  } catch (error) {
    console.error('Error conectando con el backend:', error)
    return { connected: false, error: error.message }
  }
}