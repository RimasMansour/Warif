// frontend/src/services/api.js
// Central API service for Warif — all backend calls go here

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

const getToken = () => localStorage.getItem('warif_token')

const authHeaders = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${getToken()}`
})

// Auth
export const loginUser = async (username, password) => {
  const form = new FormData()
  form.append("username", username)
  form.append("password", password)
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    body: form
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || "Login failed")
  }
  return res.json()
}

export const registerUser = async (username, email, password, language = "ar") => {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password, language })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || "Registration failed")
  }
  return res.json()
}

export const getMe = async () => {
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: authHeaders()
  })
  if (!res.ok) throw new Error("Unauthorized")
  return res.json()
}

// Farms
export const createFarm = async (name, farm_type, crop_type) => {
  const res = await fetch(`${API_BASE}/api/v1/farms`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, farm_type, crop_type })
  })
  if (!res.ok) throw new Error("Failed to create farm")
  return res.json()
}

export const getFarms = async () => {
  const res = await fetch(`${API_BASE}/api/v1/farms`, {
    headers: authHeaders()
  })
  if (!res.ok) throw new Error("Failed to fetch farms")
  return res.json()
}

export const registerDevice = async (farm_id, device_id, name, type) => {
  const res = await fetch(`${API_BASE}/api/v1/farms/${farm_id}/devices`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ device_id, name, type })
  })
  if (!res.ok) throw new Error("Failed to register device")
  return res.json()
}

// Sensors
export const getLatestSensors = async () => {
  const res = await fetch(`${API_BASE}/api/v1/sensors/latest`, {
    headers: authHeaders()
  })
  if (!res.ok) throw new Error("Failed to fetch sensors")
  return res.json()
}

export const getSensorHistory = async (sensor_type, limit = 30) => {
  const res = await fetch(
    `${API_BASE}/api/v1/sensors?sensor_type=${sensor_type}&limit=${limit}`,
    { headers: authHeaders() }
  )
  if (!res.ok) throw new Error("Failed to fetch sensor history")
  return res.json()
}

// Dashboard
export const getDashboard = async (farm_id) => {
  const res = await fetch(`${API_BASE}/api/v1/dashboard/${farm_id}`, {
    headers: authHeaders()
  })
  if (!res.ok) throw new Error("Failed to fetch dashboard")
  return res.json()
}

// Irrigation
export const getIrrigationStatus = async (farm_id) => {
  const res = await fetch(`${API_BASE}/api/v1/irrigation/status/${farm_id}`, {
    headers: authHeaders()
  })
  if (!res.ok) throw new Error("Failed to fetch irrigation status")
  return res.json()
}

export const startManualIrrigation = async (device_id, duration_min) => {
  const res = await fetch(`${API_BASE}/api/v1/irrigation/manual`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ device_id, duration_min })
  })
  if (!res.ok) throw new Error("Failed to start irrigation")
  return res.json()
}

export const stopIrrigation = async (device_id) => {
  const res = await fetch(`${API_BASE}/api/v1/irrigation/stop/${device_id}`, {
    method: "POST",
    headers: authHeaders()
  })
  if (!res.ok) throw new Error("Failed to stop irrigation")
  return res.json()
}

export const getIrrigationHistory = async (farm_id, limit = 20) => {
  const res = await fetch(
    `${API_BASE}/api/v1/irrigation/history/${farm_id}?limit=${limit}`,
    { headers: authHeaders() }
  )
  if (!res.ok) throw new Error("Failed to fetch irrigation history")
  return res.json()
}

// Recommendations
export const getRecommendations = async (farm_id, category = null) => {
  let url = `${API_BASE}/api/v1/recommendations/${farm_id}`
  if (category) url += `?category=${category}`
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error("Failed to fetch recommendations")
  return res.json()
}

export const markAllRecommendationsRead = async (farm_id) => {
  const res = await fetch(
    `${API_BASE}/api/v1/recommendations/${farm_id}/mark-all-read`,
    { method: "POST", headers: authHeaders() }
  )
  if (!res.ok) throw new Error("Failed to mark recommendations")
  return res.json()
}

// Chatbot
export const askChatbot = async (question, sensor_data = null, language = "ar") => {
  const res = await fetch(`${API_BASE}/api/v1/chatbot/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, sensor_data, language, n_chunks: 4 })
  })
  if (!res.ok) throw new Error("Chatbot request failed")
  return res.json()
}

// Alerts
export const getAlerts = async () => {
  const res = await fetch(`${API_BASE}/api/v1/alerts`, {
    headers: authHeaders()
  })
  if (!res.ok) throw new Error("Failed to fetch alerts")
  return res.json()
}
