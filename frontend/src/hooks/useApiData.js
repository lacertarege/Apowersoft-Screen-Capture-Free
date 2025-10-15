import { useState, useCallback } from 'react'

/**
 * Hook personalizado para manejar llamadas a API de manera consistente
 * Evita duplicación de lógica de loading, error handling, etc.
 */
export function useApiData(initialData = []) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async (url, options = {}) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(url, options)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const result = await response.json()
      
      // Si la respuesta tiene estructura { items: [...] }, usar items
      // Si no, usar la respuesta completa
      const newData = result.items !== undefined ? result.items : result
      setData(newData)
      
      return result
    } catch (err) {
      console.error('Error en fetchData:', err)
      setError(err.message)
      setData(initialData)
      return { items: initialData } // Devolver un valor por defecto en caso de error
    } finally {
      setLoading(false)
    }
  }, [initialData])

  const clearData = useCallback(() => {
    setData(initialData)
    setError(null)
  }, [initialData])

  return {
    data,
    loading,
    error,
    fetchData,
    clearData,
    setData,
    setError
  }
}

/**
 * Hook especializado para datos de tickers
 */
export function useTickersData() {
  const { data, loading, error, fetchData } = useApiData([])
  
  const fetchTickers = useCallback(async (query = '') => {
    const url = query 
      ? `/tickers?pageSize=1000&q=${encodeURIComponent(query)}`
      : '/tickers'
    return fetchData(url)
  }, [fetchData])
  
  return {
    tickers: data,
    loading,
    error,
    fetchTickers
  }
}

/**
 * Hook especializado para datos históricos
 */
export function useHistoricosData() {
  const { data, loading, error, fetchData } = useApiData([])
  
  const fetchHistoricos = useCallback(async (tickerId, from = '1970-01-01') => {
    const url = `/historicos/${tickerId}?from=${from}`
    return fetchData(url)
  }, [fetchData])
  
  return {
    historicos: data,
    loading,
    error,
    fetchHistoricos
  }
}
