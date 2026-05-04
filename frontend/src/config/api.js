// Frontend API Configuration
// Centralized configuration for all API interactions

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const REQUEST_TIMEOUT = parseInt(import.meta.env.VITE_REQUEST_TIMEOUT || '30000', 10)
const RETRY_ATTEMPTS = parseInt(import.meta.env.VITE_API_RETRY_ATTEMPTS || '3', 10)
const RETRY_DELAY = parseInt(import.meta.env.VITE_API_RETRY_DELAY || '1000', 10)
const DEBUG = import.meta.env.VITE_DEBUG === 'true'

export const apiConfig = {
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT,
  retryAttempts: RETRY_ATTEMPTS,
  retryDelay: RETRY_DELAY,
  debug: DEBUG
}

export function debugLog(message, data = null) {
  if (DEBUG) {
    if (data) {
      console.log(`[Warif API] ${message}`, data)
    } else {
      console.log(`[Warif API] ${message}`)
    }
  }
}

export class ApiError extends Error {
  constructor(message, status = null, details = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function fetchWithRetry(url, options = {}, retries = 0) {
  const config = options.apiConfig || apiConfig
  const maxRetries = options.retries ?? config.retryAttempts
  const retryDelay = options.retryDelay ?? config.retryDelay
  const timeout = options.timeout ?? config.timeout

  let timeoutId;
  try {
    debugLog(`Fetching: ${url}`)

    const controller = new AbortController()
    timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ApiError(
        `HTTP ${response.status}: ${errorData.detail || response.statusText}`,
        response.status,
        errorData
      )
    }

    const data = await response.json()
    debugLog(`Success: ${url}`, data)
    return data
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId)

    if (error.name === 'AbortError') {
      error = new ApiError(`Request timeout (${timeout}ms)`, 408)
    }

    if (error instanceof ApiError && error.status >= 500 && retries < maxRetries) {
      debugLog(`Retry attempt ${retries + 1}/${maxRetries} for ${url}`)
      await new Promise(resolve => setTimeout(resolve, retryDelay * (retries + 1)))
      return fetchWithRetry(url, options, retries + 1)
    }

    debugLog(`Error: ${url}`, error.message)
    throw error
  }
}

export function getAuthHeaders() {
  const token = localStorage.getItem('warif_token')
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  }
}
