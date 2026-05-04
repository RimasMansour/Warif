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

export const triggerFanControl = async (device_id, action = "start") => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/commands`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      device_id,
      command: action === "start" ? "FAN_ON" : "FAN_OFF",
      payload: JSON.stringify({ speed: 100 })
    })
  })
}

// User Profile
export const updateUser = async (userData) => {
  return fetchWithRetry(`${apiConfig.baseURL}/api/v1/auth/me`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(userData)
  })
}

// Step 1: Verify email in backend + Send OTP via EmailJS
export const sendResetCode = async (email) => {
  // Check if email exists in DB first
  try {
    await fetchWithRetry(`${apiConfig.baseURL}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
  } catch (err) {
    if (err.status === 404) throw new Error('EMAIL_NOT_FOUND');
    throw err;
  }

  // If found, generate local code and send via EmailJS
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  localStorage.setItem('warif_reset_code', code);
  localStorage.setItem('warif_reset_email', email);

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: 'service_8j5wqpl',
      template_id: 'template_u8zt5as',
      user_id: 'G-oMnZWX9pcO2F2Mo',
      template_params: {
        to_email: email,
        reset_code: code,
        user_name: 'مزارع وريف' // Generic since we don't have full name yet
      }
    })
  });
  if (!response.ok) throw new Error('EMAIL_SEND_FAILED');
  return true;
};

// Step 2: Verify OTP code
export const verifyResetCode = (code) => {
  const stored = localStorage.getItem('warif_reset_code');
  if (!stored || stored !== code.trim()) throw new Error('CODE_WRONG');
  return true;
};

// Step 3: Save new password to backend
export const saveNewPassword = async (newPassword) => {
  const email = localStorage.getItem('warif_reset_email');
  if (!email) throw new Error('RESET_SESSION_EXPIRED');

  await fetchWithRetry(`${apiConfig.baseURL}/api/v1/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, new_password: newPassword })
  });

  localStorage.removeItem('warif_reset_code');
  localStorage.removeItem('warif_reset_email');
  return true;
};

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
