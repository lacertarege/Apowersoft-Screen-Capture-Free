// Utilidades para hacer llamadas API de forma segura y evitar pantallas blancas
import React from 'react'

export async function safeApiCall(apiFunction, fallbackValue = null, errorMessage = 'Error en la operación') {
  try {
    const result = await apiFunction()
    return { success: true, data: result, error: null }
  } catch (error) {
    console.error('Error en safeApiCall:', error)
    return { 
      success: false, 
      data: fallbackValue, 
      error: error.message || errorMessage 
    }
  }
}

export function withErrorHandling(component, errorMessage = 'Error en el componente') {
  return function WrappedComponent(props) {
    try {
      return component(props)
    } catch (error) {
      console.error('Error en componente:', error)
      return React.createElement('div', {
        style: {
          padding: '10px',
          border: '1px solid #fca5a5',
          borderRadius: '4px',
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          margin: '10px 0'
        }
      }, [
        React.createElement('strong', { key: 'strong' }, 'Error: '),
        errorMessage,
        React.createElement('br', { key: 'br' }),
        React.createElement('small', { key: 'small' }, `Detalles: ${error.message}`)
      ])
    }
  }
}

export function safeAsyncHandler(asyncFunction, errorMessage = 'Error en la operación') {
  return async (...args) => {
    try {
      return await asyncFunction(...args)
    } catch (error) {
      console.error('Error en safeAsyncHandler:', error)
      throw new Error(errorMessage + ': ' + (error.message || 'Error desconocido'))
    }
  }
}

// Función para validar que el backend esté disponible
export async function checkBackendHealth(apiUrl = 'http://localhost:3001') {
  try {
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      timeout: 5000
    })
    return response.ok
  } catch (error) {
    console.error('Backend no disponible:', error)
    return false
  }
}
