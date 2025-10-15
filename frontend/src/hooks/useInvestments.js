import { useState, useCallback } from 'react'
import { API } from '../ui/config'

export function useInvestments() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const createInvestment = useCallback(async (tickerId, investmentData) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API}/tickers/${tickerId}/inversiones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(investmentData)
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      return { success: true, data }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteInvestment = useCallback(async (investmentId) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API}/inversiones/${investmentId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  const getInvestments = useCallback(async (tickerId) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API}/tickers/${tickerId}/inversiones`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      return data.items || []
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const updateInvestment = useCallback(async (investmentId, investmentData) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API}/inversiones/${investmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(investmentData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    createInvestment,
    deleteInvestment,
    getInvestments,
    updateInvestment
  }
}
