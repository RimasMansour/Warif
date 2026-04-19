/**
 * hooks/useSensors.js
 * Poll latest sensor readings from the API.
 */
import { useState, useEffect, useCallback } from 'react'
import { getLatestReadings } from '@/services/api'

export function useSensors(intervalMs = 10_000) {
  const [readings, setReadings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const fetchReadings = useCallback(async () => {
    try {
      const data = await getLatestReadings()
      setReadings(data)
      setError(null)
    } catch (err) {
      setError(err.message ?? 'Failed to fetch sensor data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReadings()
    const id = setInterval(fetchReadings, intervalMs)
    return () => clearInterval(id)
  }, [fetchReadings, intervalMs])

  return { readings, loading, error, refetch: fetchReadings }
}
