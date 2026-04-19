/**
 * utils/index.js
 * Shared utility functions used across the frontend.
 */
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

// ── Tailwind class merge helper ────────────────
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// ── Date formatting ────────────────────────────
export const formatDate = (iso) =>
  format(new Date(iso), 'dd MMM yyyy, HH:mm')

export const timeAgo = (iso) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true })

// ── Sensor value formatting ────────────────────
const SENSOR_UNITS = {
  temperature: '°C',
  humidity: '%',
  light: 'lux',
  soil_moisture: '%',
  ec: 'mS/cm',
  co2: 'ppm',
}

export const formatSensorValue = (type, value) => {
  const unit = SENSOR_UNITS[type] ?? ''
  return `${Number(value).toFixed(1)} ${unit}`.trim()
}

// ── Alert severity colour ──────────────────────
export const severityColor = (severity) => ({
  critical: 'text-red-600 bg-red-50 border-red-200',
  warning:  'text-amber-600 bg-amber-50 border-amber-200',
  info:     'text-blue-600 bg-blue-50 border-blue-200',
}[severity] ?? 'text-gray-600 bg-gray-50 border-gray-200')

// ── Clamp a number between min and max ─────────
export const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max)
