// frontend/src/hooks/useWarifData.js
// Fetches real sensor data from Warif Backend API

import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const getToken = () => localStorage.getItem('warif_token')

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
})

export function useLatestSensors(intervalMs = 10000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch_data = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/sensors/latest`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch sensors')
      const json = await res.json()

      // Convert array to map: { soil_moisture: 42.3, air_temperature: 31.5, ... }
      const mapped = {}
      json.forEach(r => { mapped[r.sensor_type] = r.value })
      setData(mapped)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch_data()
    const id = setInterval(fetch_data, intervalMs)
    return () => clearInterval(id)
  }, [fetch_data, intervalMs])

  return { data, loading, error, refetch: fetch_data }
}

export function useDashboard(farm_id) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch_data = useCallback(async () => {
    if (!farm_id) return
    try {
      const res = await fetch(`${API_BASE}/api/v1/dashboard/${farm_id}`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch dashboard')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [farm_id])

  useEffect(() => {
    fetch_data()
    const id = setInterval(fetch_data, 10000)
    return () => clearInterval(id)
  }, [fetch_data])

  return { data, loading, error, refetch: fetch_data }
}

export function useRecommendations(farm_id) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch_data = useCallback(async () => {
    if (!farm_id) return
    try {
      const res = await fetch(`${API_BASE}/api/v1/recommendations/${farm_id}`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch recommendations')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [farm_id])

  useEffect(() => {
    fetch_data()
  }, [fetch_data])

  return { data, loading, error, refetch: fetch_data }
}

export function useIrrigationStatus(farm_id) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch_data = useCallback(async () => {
    if (!farm_id) return
    try {
      const res = await fetch(`${API_BASE}/api/v1/irrigation/status/${farm_id}`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch irrigation status')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [farm_id])

  useEffect(() => {
    fetch_data()
    const id = setInterval(fetch_data, 10000)
    return () => clearInterval(id)
  }, [fetch_data])

  return { data, loading, error, refetch: fetch_data }
}

export function useIrrigationPrediction(farm_id, sensors) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch_data = useCallback(async () => {
    if (!farm_id || !sensors) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        soil_moisture: sensors.soil_moisture ?? 45,
        air_temp: sensors.air_temperature ?? 30,
        humidity: sensors.air_humidity ?? 60,
        soil_temp: sensors.soil_temperature ?? 25,
      })
      const res = await fetch(
        `${API_BASE}/api/v1/ml/predictions/irrigation/${farm_id}?${params}`,
        { headers: authHeaders() }
      )
      if (!res.ok) throw new Error('Failed to fetch ML prediction')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [farm_id, sensors])

  useEffect(() => {
    fetch_data()
    const id = setInterval(fetch_data, 30000)
    return () => clearInterval(id)
  }, [fetch_data])

  return { data, loading, error, refetch: fetch_data }
}
