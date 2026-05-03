// Central API service for Warif — all backend calls go here

import { fetchWithRetry, getAuthHeaders, apiConfig } from '../config/api'

// Auth
export const loginUser = async (username, password) => {
  const form = new FormData()
  form.append("username", username)
  form.append("password", password)
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/auth/login`, {
    method: "POST",
    body: form
  })
}

export const registerUser = async (username, email, password, language = "ar") => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password, language })
  })
}

export const getMe = async () => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/auth/me`, {
    headers: getAuthHeaders()
  })
}

// Farms
export const createFarm = async (name, farm_type, crop_type) => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/farms`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, farm_type, crop_type })
  })
}

export const getFarms = async () => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/farms`, {
    headers: getAuthHeaders()
  })
}

export const registerDevice = async (farm_id, device_id, name, type) => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/farms/${farm_id}/devices`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ device_id, name, type })
  })
}

// Sensors
export const getLatestSensors = async () => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/sensors/latest`, {
    headers: getAuthHeaders()
  })
}

export const getSensorHistory = async (sensor_type, limit = 30) => {
  return fetchWithRetry(
    `${apiConfig.baseURL}/api/v1/sensors?sensor_type=${sensor_type}&limit=${limit}`,
    { headers: getAuthHeaders() }
  )
}

// Dashboard
export const getDashboard = async (farm_id) => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/dashboard/${farm_id}`, {
    headers: getAuthHeaders()
  })
}

// Irrigation
export const getIrrigationStatus = async (farm_id) => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/irrigation/status/${farm_id}`, {
    headers: getAuthHeaders()
  })
}

export const startManualIrrigation = async (device_id, duration_min) => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/irrigation/manual`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ device_id, duration_min })
  })
}

export const stopIrrigation = async (device_id) => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/irrigation/stop/${device_id}`, {
    method: "POST",
    headers: getAuthHeaders()
  })
}

export const triggerAutoIrrigation = async (farm_id, duration_min = 15) => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/irrigation/auto/${farm_id}?duration_min=${duration_min}`, {
    method: "POST",
    headers: getAuthHeaders()
  })
}

export const stopFarmIrrigation = async (farm_id) => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/irrigation/stop-farm/${farm_id}`, {
    method: "POST",
    headers: getAuthHeaders()
  })
}

export const getIrrigationHistory = async (farm_id, limit = 20) => {
  return fetchWithRetry(
    `${apiConfig.baseURL}/api/v1/irrigation/history/${farm_id}?limit=${limit}`,
    { headers: getAuthHeaders() }
  )
}

export const getIrrigationResources = async (farm_id) => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/irrigation/resources/${farm_id}`, {
    headers: getAuthHeaders()
  })
}

export const triggerFanControl = async (farm_id, action = "start") => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/irrigation/resources/${farm_id}`, {
    headers: getAuthHeaders()
  })
}

// Recommendations
export const getRecommendations = async (farm_id, category = null) => {
  let url = `${apiConfig.baseURL}/api/v1/recommendations/${farm_id}`
  if (category) url += `?category=${category}`
  return fetchWithRetry(url, { headers: getAuthHeaders() })
}

export const markAllRecommendationsRead = async (farm_id) => {
  return fetchWithRetry(
    `${apiConfig.baseURL}/api/v1/recommendations/${farm_id}/mark-all-read`,
    { method: "POST", headers: getAuthHeaders() }
  )
}

// Chatbot
export const askChatbot = async (question, sensor_data = null, language = "ar") => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/chatbot/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, sensor_data, language, n_chunks: 4 })
  })
}

// Alerts
export const getAlerts = async () => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/alerts`, {
    headers: getAuthHeaders()
  })
}
