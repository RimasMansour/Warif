/**
 * hooks/useAlerts.js
 * Fetch and manage alerts state.
 */
import { useState, useEffect, useCallback } from 'react'
import { getAlerts, acknowledgeAlert, resolveAlert } from '@/services/api'

export function useAlerts() {
  const [alerts, setAlerts]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getAlerts({ status: 'open' })
      setAlerts(data)
      setError(null)
    } catch (err) {
      setError(err.message ?? 'Failed to fetch alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const ack = async (id) => {
    await acknowledgeAlert(id)
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'acknowledged' } : a))
    )
  }

  const resolve = async (id) => {
    await resolveAlert(id)
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  return {
    alerts,
    loading,
    error,
    refetch: fetchAlerts,
    acknowledge: ack,
    resolve,
  }
}
