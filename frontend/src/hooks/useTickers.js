import { useState, useEffect, useCallback } from 'react'
import { API } from '../ui/config'

export function useTickers() {
  const [tickers, setTickers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchTickers = useCallback(async (query = '', page = 1, pageSize = 100, includeHistory = false) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API}/tickers?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}&includeHistory=${includeHistory}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setTickers(data.items || [])
      return data
    } catch (err) {
      setError(err.message)
      setTickers([])
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const createTicker = useCallback(async (tickerData) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API}/tickers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tickerData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      await fetchTickers() // Recargar lista
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchTickers])

  const updateTicker = useCallback(async (id, updateData) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API}/tickers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      await fetchTickers() // Recargar lista
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchTickers])

  const deleteTicker = useCallback(async (id) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API}/tickers/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      await fetchTickers() // Recargar lista
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchTickers])

  const refreshTickerPrice = useCallback(async (id) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API}/tickers/${id}/refresh`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      await fetchTickers() // Recargar lista
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchTickers])

  return {
    tickers,
    loading,
    error,
    fetchTickers,
    createTicker,
    updateTicker,
    deleteTicker,
    refreshTickerPrice
  }
}
