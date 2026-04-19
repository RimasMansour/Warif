/**
 * services/api.js
 * Central Axios instance and all API call functions.
 * Import specific functions from this file in your hooks/components.
 */
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8010',
  headers: { 'Content-Type': 'application/json' },
})

// ── Auth token injection ───────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response error handling ────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ════════════════════════════════════════════════
//  Auth
// ════════════════════════════════════════════════
export const login = (credentials) =>
  api.post('/api/v1/auth/login', credentials).then((r) => r.data)

// ════════════════════════════════════════════════
//  Sensors
// ════════════════════════════════════════════════
export const getSensorData = (params) =>
  api.get('/api/v1/sensors', { params }).then((r) => r.data)

export const getLatestReadings = () =>
  api.get('/api/v1/sensors/latest').then((r) => r.data)

// ════════════════════════════════════════════════
//  Alerts
// ════════════════════════════════════════════════
export const getAlerts = (params) =>
  api.get('/api/v1/alerts', { params }).then((r) => r.data)

export const acknowledgeAlert = (id) =>
  api.post(`/api/v1/alerts/${id}/ack`).then((r) => r.data)

export const resolveAlert = (id) =>
  api.post(`/api/v1/alerts/${id}/resolve`).then((r) => r.data)

// ════════════════════════════════════════════════
//  Trays
// ════════════════════════════════════════════════
export const getTrays = () =>
  api.get('/api/v1/trays').then((r) => r.data)

export const createTray = (data) =>
  api.post('/api/v1/trays', data).then((r) => r.data)

export const updateTray = (id, data) =>
  api.put(`/api/v1/trays/${id}`, data).then((r) => r.data)

// ════════════════════════════════════════════════
//  Commands
// ════════════════════════════════════════════════
export const sendCommand = (data) =>
  api.post('/api/v1/commands', data).then((r) => r.data)

// ════════════════════════════════════════════════
//  ML
// ════════════════════════════════════════════════
export const getYieldPredictions = () =>
  api.get('/api/v1/ml/predictions/yield').then((r) => r.data)

export const getGrowthTrajectory = () =>
  api.get('/api/v1/ml/predictions/growth-trajectory').then((r) => r.data)

export const retrainModels = () =>
  api.post('/api/v1/ml/models/retrain').then((r) => r.data)

// ════════════════════════════════════════════════
//  Config / Thresholds
// ════════════════════════════════════════════════
export const getThresholds = () =>
  api.get('/api/v1/config/thresholds').then((r) => r.data)

export const updateThresholds = (data) =>
  api.put('/api/v1/config/thresholds', data).then((r) => r.data)

export default api
