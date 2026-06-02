// Fetches real sensor data from Warif Backend API

import { useState, useEffect, useCallback } from 'react'
import { fetchWithRetry, getAuthHeaders, apiConfig } from '../config/api'
import { getFarms } from '../services/api'

const API_BASE = import.meta.env.VITE_API_URL || ''

const getStoredToken = () => sessionStorage.getItem('warif_token') || localStorage.getItem('warif_token');
const authHeaders = () => getAuthHeaders()

const KNOWN_ANOMALY_TYPES = new Set([
  "sensor_stuck",
  "unrealistic_jump",
  "pattern_break",
  "threshold_violation",
]);

const INTERNAL_ANOMALY_TYPES = new Set([
  "ml_anomaly",
]);

const ALERT_SENSOR_LABELS = {
  ar: {
    water_tank: "خزان المياه",
    air_temperature: "درجة حرارة الهواء",
    temperature: "درجة حرارة الهواء",
    air_humidity: "رطوبة الهواء",
    humidity: "رطوبة الهواء",
    soil_moisture: "رطوبة التربة",
    irrigation: "رطوبة التربة",
    soil_temperature: "درجة حرارة التربة",
    light_intensity: "شدة الإضاءة",
    water_usage: "استهلاك المياه",
    power_usage: "استهلاك الطاقة",
    energy_kwh: "استهلاك الطاقة",
    soil: "التربة",
    multi_sensor: "النظام",
  },
  en: {
    water_tank: "Water Tank",
    air_temperature: "Air Temperature",
    temperature: "Air Temperature",
    air_humidity: "Air Humidity",
    humidity: "Air Humidity",
    soil_moisture: "Soil Moisture",
    irrigation: "Soil Moisture",
    soil_temperature: "Soil Temperature",
    light_intensity: "Light Intensity",
    water_usage: "Water Usage",
    power_usage: "Power Usage",
    energy_kwh: "Energy Usage",
    soil: "Soil",
    multi_sensor: "System",
  },
};

const fallbackAlertMessage = (backendAlert, isEn) => {
  const sensorType = backendAlert.sensor_type || "system";
  const sensorName = ALERT_SENSOR_LABELS[isEn ? "en" : "ar"][sensorType] || (isEn ? "System" : "النظام");
  const value = backendAlert.actual_value != null ? ` ${Number(backendAlert.actual_value).toFixed(1)}` : "";
  return isEn
    ? `Alert for ${sensorName}${value}. Review the current condition and take the appropriate action.`
    : `تنبيه في ${sensorName}${value}. راجع الحالة الحالية واتخذ الإجراء المناسب.`;
};

const mlAnomalyAlertMessage = (backendAlert, isEn) => {
  const sensorType = backendAlert.sensor_type || "multi_sensor";
  const sensorName = ALERT_SENSOR_LABELS[isEn ? "en" : "ar"][sensorType] || (isEn ? "System" : "النظام");

  if (sensorType === "multi_sensor") {
    return isEn
      ? "Alert: An unusual pattern was detected across multiple sensors. Check sensor connectivity and review the latest readings."
      : "تنبيه: تم رصد نمط غير طبيعي بين عدة حساسات. تحقق من اتصال الحساسات وراجع آخر القراءات.";
  }

  const actions = {
    ar: {
      air_temperature: "تحقق من قراءة الحساس واتصال الجهاز، وتأكد من أن نظام التبريد والتهوية يعمل بشكل طبيعي.",
      temperature: "تحقق من قراءة الحساس واتصال الجهاز، وتأكد من أن نظام التبريد والتهوية يعمل بشكل طبيعي.",
      soil_temperature: "تحقق من حساس حرارة التربة وقارِن القراءة بحالة التربة الفعلية.",
      air_humidity: "تحقق من قراءة حساس رطوبة الهواء واضبط التهوية عند الحاجة.",
      humidity: "تحقق من قراءة حساس رطوبة الهواء واضبط التهوية عند الحاجة.",
      soil_moisture: "تحقق من حساس رطوبة التربة ونظام الري، وقارن القراءة بحالة التربة الفعلية.",
      irrigation: "تحقق من حساس رطوبة التربة ونظام الري، وقارن القراءة بحالة التربة الفعلية.",
      light_intensity: "تحقق من حساس الإضاءة ومصدر القراءة، وتأكد من عدم وجود عائق أو فصل في الاتصال.",
      water_tank: "تحقق من حساس خزان المياه ومستوى الخزان الفعلي.",
      water_usage: "تحقق من المضخة، ومحابس الري، وقراءة استهلاك المياه.",
      power_usage: "تحقق من استهلاك الأجهزة للطاقة واتصال الأجهزة المرتبطة.",
      energy_kwh: "تحقق من قراءة استهلاك الطاقة واتصال الجهاز.",
    },
    en: {
      air_temperature: "Check the sensor reading and device connection, and confirm that cooling and ventilation are operating normally.",
      temperature: "Check the sensor reading and device connection, and confirm that cooling and ventilation are operating normally.",
      soil_temperature: "Check the soil temperature sensor and compare the reading with the actual soil condition.",
      air_humidity: "Check the air humidity sensor reading and adjust ventilation if needed.",
      humidity: "Check the air humidity sensor reading and adjust ventilation if needed.",
      soil_moisture: "Check the soil moisture sensor and irrigation system, and compare the reading with the actual soil condition.",
      irrigation: "Check the soil moisture sensor and irrigation system, and compare the reading with the actual soil condition.",
      light_intensity: "Check the light sensor and reading source, and confirm there is no obstruction or connection loss.",
      water_tank: "Check the water tank sensor and the actual tank level.",
      water_usage: "Check the pump, irrigation valves, and water usage reading.",
      power_usage: "Check power consumption and connected device status.",
      energy_kwh: "Check the energy reading and device connection.",
    },
  };

  const action = actions[isEn ? "en" : "ar"][sensorType] || (isEn
    ? "Check the sensor reading, device connection, and related equipment."
    : "تحقق من قراءة الحساس، واتصال الجهاز، والمعدات المرتبطة.");

  return isEn
    ? `Alert: Unusual reading in ${sensorName}. ${action}`
    : `تنبيه: قراءة غير طبيعية في ${sensorName}. ${action}`;
};

// Global Persistence Cache to prevent "zeroing" on navigation
const globalCache = {
  latestSensors: null,
  history: {}, // Keyed by sensor_type + limit
  dashboard: {}, // Keyed by farm_id
  recommendations: {}, // Keyed by farm_id
  irrigationStatus: {}, // Keyed by farm_id
  irrigationResources: {} // Keyed by farm_id
};

// Global Simulation State (frontend-only mock logic)
let simState = {
  coolingActive: false,
  irrigationActive: false,
};

// Expose manual triggers for UI
export async function triggerManualIrrigation(action = 'start', farmId = null, durationMin = 15, recommendationId = null) {
  const token = getStoredToken();
  try {
    if (action === 'stop') {
      const res = await fetch(`${API_BASE}/api/v1/irrigation/stop-farm/${farmId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Stop irrigation API failed');
      const data = await res.json();
      simState.irrigationActive = false;
      console.log('[Warif] Irrigation stopped via API:', data);
      return data;
    }
    // action === 'start'
    const res = await fetch(`${API_BASE}/api/v1/irrigation/manual`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ farm_id: farmId, device_id: `irrigation_${farmId}`, duration_min: durationMin, recommendation_id: recommendationId })
    });
    if (!res.ok) throw new Error('Irrigation API failed');
    const data = await res.json();
    simState.irrigationActive = true;
    setTimeout(() => { simState.irrigationActive = false; }, durationMin * 60 * 1000);
    console.log('[Warif] Manual irrigation started via API:', data);
    return data;
  } catch (err) {
    console.error('[Warif] Manual irrigation API error:', err);
    return null;
  }
}
export async function triggerManualCooling(mode = "stop", farmId = null, recommendationId = null) {
  console.log('[Warif] Manual cooling requested:', mode, 'farm:', farmId);
  let payload = { fan: false, cooler: false, farm_id: farmId, recommendation_id: recommendationId };
  if (mode === 'full')     payload = { fan: true,  cooler: true,  farm_id: farmId, recommendation_id: recommendationId };
  if (mode === 'fan_only') payload = { fan: true,  cooler: false, farm_id: farmId, recommendation_id: recommendationId };

  const token = getStoredToken();
  try {
    const res = await fetch(`${API_BASE}/api/v1/commands/cooling`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Cooling command failed');
    return await res.json();
  } catch (e) {
    console.error('Failed to trigger cooling:', e);
    throw e;
  }
}

export function useLatestSensors(intervalMs = 10000, farmIdOverride = null) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!globalCache.latestSensors)
  const [error, setError] = useState(null)

  const fetch_data = useCallback(async () => {
    try {
      const userData = JSON.parse(localStorage.getItem('warif_user') || '{}');
      const sessionFarms = JSON.parse(sessionStorage.getItem('warif_session_farms') || '[]');
      const farmId = farmIdOverride || (sessionFarms.length > 0
        ? sessionFarms[0].id
        : (userData.farmId || null));
      if (!farmId) return;

      let mapped = {}
      try {
        const res = await fetch(`${API_BASE}/api/v1/sensors/latest?farm_id=${farmId}`, {
          headers: authHeaders()
        })
        
        if (res.ok) {
          const json = await res.json()
          json.forEach(r => { mapped[r.sensor_type] = r.value })
        } else {
          throw new Error("Backend not ok")
        }
      } catch {
        // Fallback to base mock values if backend is down
        mapped = {
          air_temperature: 31,
          air_humidity: 45,
          soil_temperature: 25,
          soil_moisture: 42,
          light_intensity: 0,
          power_usage: 0,
          water_usage: 0,
        }
      }

      globalCache.latestSensors = null;
      setData(mapped)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [farmIdOverride])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetch_data()
    const id = setInterval(fetch_data, intervalMs)
    return () => clearInterval(id)
  }, [fetch_data, intervalMs])

  return { data, loading, error, refetch: fetch_data }
}

export function useAutoMode(farmId) {
  const [autoMode, setAutoMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load auto_mode from backend on mount
  useEffect(() => {
    if (!farmId) return;
    let cancelled = false;
    const loadAutoMode = async () => {
      setLoading(true);
      const token = getStoredToken();
      try {
        const res = await fetch(`${API_BASE}/api/v1/farms/${farmId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (cancelled) return;
        if (typeof data.auto_mode === 'boolean') {
          setAutoMode(data.auto_mode);
        }
      } catch {
        // Keep the current local mode if the backend value is unavailable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAutoMode();
    return () => {
      cancelled = true;
    };
  }, [farmId]);

  // Save auto_mode to backend
  const toggleAutoMode = async (newValue) => {
    if (!farmId) return;
    const previousValue = autoMode;
    setAutoMode(newValue);
    setLoading(true);
    const token = getStoredToken();
    try {
      const res = await fetch(`${API_BASE}/api/v1/farms/${farmId}/auto-mode`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ auto_mode: newValue })
      });
      if (!res.ok) throw new Error(`Failed to update auto mode (${res.status})`);
      const data = await res.json().catch(() => null);
      if (data && typeof data.auto_mode === 'boolean') {
        setAutoMode(data.auto_mode);
      }
    } catch (e) {
      console.error('Failed to update auto mode:', e);
      setAutoMode(previousValue);
    } finally {
      setLoading(false);
    }
  };

  return { autoMode, toggleAutoMode, loading };
}

export function useSensorHistory(sensor_type, limit = 100, intervalMs = 30000, since = null, options = {}) {
  const sinceStr = since ? since.toISOString() : null;
  const bucket = options.bucket || null;
  const untilStr = options.until ? options.until.toISOString() : null;
  const requestedFarmId = options.farmId || null;
  const cacheKey = `${sensor_type}_${limit}_${sinceStr || ''}_${untilStr || ''}_${bucket || 'raw'}_${requestedFarmId || 'current'}`;
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(!globalCache.history[cacheKey])

  const fetch_data = useCallback(async () => {
    if (!sensor_type) return
    try {
      const userData = JSON.parse(localStorage.getItem('warif_user') || '{}');
      const sessionFarms = JSON.parse(sessionStorage.getItem('warif_session_farms') || '[]');
      const farmId = requestedFarmId || (sessionFarms.length > 0
        ? sessionFarms[0].id
        : (userData.farmId || null));
      if (!farmId) return;

      let url = bucket
        ? `${API_BASE}/api/v1/sensors/aggregate?sensor_type=${sensor_type}&farm_id=${farmId}&bucket=${bucket}`
        : `${API_BASE}/api/v1/sensors?sensor_type=${sensor_type}&farm_id=${farmId}&limit=${limit}`;
      if (sinceStr) url += `&since=${encodeURIComponent(sinceStr)}`;
      if (untilStr) url += `&until=${encodeURIComponent(untilStr)}`;
      const res = await fetch(url, { headers: authHeaders() })
      if (res.ok) {
        const json = await res.json()
        const reversed = bucket ? json : json.reverse();
        globalCache.history[cacheKey] = null;
        globalCache.history[cacheKey] = reversed;
        setData(reversed)
      }
    } catch (err) {
      console.error("History fetch failed:", err)
    } finally {
      setLoading(false)
    }
  }, [sensor_type, limit, cacheKey, sinceStr, untilStr, bucket, requestedFarmId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetch_data()
    if (intervalMs <= 0) return;
    const id = setInterval(fetch_data, intervalMs)
    return () => clearInterval(id)
  }, [fetch_data, intervalMs])

  return { data, loading, refetch: fetch_data }
}

export function useAutoAlerts(sensors, globalAutoMode, farmIdOverride = null) {
  const [alerts, setAlerts] = useState([]);
  const [_loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const userData = JSON.parse(localStorage.getItem('warif_user') || '{}');
      const sessionFarms = JSON.parse(sessionStorage.getItem('warif_session_farms') || '[]');
      const farmId = farmIdOverride || (sessionFarms.length > 0
        ? sessionFarms[0].id
        : (userData.farmId || null));
      if (!farmId) return;
      const token = getStoredToken();
      const url = `${API_BASE}/api/v1/alerts?farm_id=${farmId}&status=open`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch alerts");
      let json = await res.json();
      
      const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
      
      const mappedAlerts = json.map(backendAlert => {
        let frontendSeverity = "medium";
        if (backendAlert.severity === "critical") frontendSeverity = "high";
        else if (backendAlert.severity === "info") frontendSeverity = "low";
        
        const sensorNameAr = ALERT_SENSOR_LABELS.ar[backendAlert.sensor_type] || "النظام";
        const sensorNameEn = ALERT_SENSOR_LABELS.en[backendAlert.sensor_type] || "System";
        const backendExplanation = backendAlert.anomaly_type || "";
        const anomalyType = KNOWN_ANOMALY_TYPES.has(backendExplanation) ? backendExplanation : null;
        const isInternalAnomaly = INTERNAL_ANOMALY_TYPES.has(backendExplanation);
        const reasoningText = anomalyType || isInternalAnomaly ? "" : backendExplanation;
        const isMultiSensorAlert = backendAlert.sensor_type === "multi_sensor";
        const hasTechnicalMlCopy = /ML Anomaly|KNN|Isolation Forest|multi[_-]sensor/i.test(backendAlert.message || "");
        const msg = isInternalAnomaly || isMultiSensorAlert || hasTechnicalMlCopy
          ? mlAnomalyAlertMessage(backendAlert, isEn)
          : (backendAlert.message || fallbackAlertMessage(backendAlert, isEn));

        let shortTitle = msg;
        let fullDetails = msg;

        if (msg.includes('-')) {
          const parts = msg.split('-');
          shortTitle = parts[0].trim();
          fullDetails = msg;
        }

        if (reasoningText && !fullDetails.includes(reasoningText)) {
          fullDetails = `${msg} — ${reasoningText}`;
        }

        // Extract value from message e.g. (29.8 C)
        const extractedValue = backendAlert.message?.match(/\(([^)]+)\)/)?.[1] || "";

        // Build reason from message (part after last dot before recommendation)
        const reasonMatch = backendAlert.message?.split('.')?.[0] || "";

        // Build action based on sensor type
        const getAction = (sensorType, isEn) => {
          if (sensorType === 'air_temperature') return isEn ? "Check cooling system and ventilation." : "تحقق من نظام التبريد والتهوية.";
          if (sensorType === 'air_humidity') return isEn ? "Adjust ventilation to regulate humidity." : "اضبط التهوية لتنظيم الرطوبة.";
          if (sensorType === 'soil_moisture') return isEn ? "Check irrigation system and soil sensors." : "تحقق من نظام الري وحساسات التربة.";
          if (sensorType === 'water_tank') return isEn ? "Refill water tank immediately." : "أعد تعبئة خزان المياه فوراً.";
          if (sensorType === 'water_usage') return isEn ? "Check pump and irrigation valves." : "تحقق من المضخة ومحابس الري.";
          if (sensorType === 'power_usage' || sensorType === 'energy_kwh') return isEn ? "Check power consumption of devices." : "تحقق من استهلاك الأجهزة للطاقة.";
          return isEn ? "Review system status and take action." : "راجع حالة النظام واتخذ الإجراء المناسب.";
        };

        return {
          id: backendAlert.id,
          autoMode: globalAutoMode,
          title: shortTitle || (isEn ? "System Alert" : "تنبيه النظام"),
          severity: backendAlert.severity || frontendSeverity,
          created_at: backendAlert.created_at,
          sensor_type: backendAlert.sensor_type,
          anomaly_type: anomalyType,
          actual_value: backendAlert.actual_value,
          threshold: backendAlert.threshold,
          execution_action: backendAlert.execution_action,
          action_status: backendAlert.action_status,
          action_result: backendAlert.action_result,
          sensor: isEn ? sensorNameEn : sensorNameAr,
          value: extractedValue,
          reason: reasoningText || reasonMatch,
          action: getAction(backendAlert.sensor_type, isEn),
          message: fullDetails,
          actionType: backendAlert.sensor_type || "system",
          timestamp: backendAlert.created_at 
            ? new Date(backendAlert.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            : '',
        };
      });
      setAlerts(mappedAlerts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [globalAutoMode, farmIdOverride]);

  const dismissAlert = useCallback(async (id) => {
    try {
      const token = getStoredToken();
      await fetch(`${API_BASE}/api/v1/alerts/${id}/ack`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${token}` }
      });
      fetchAlerts();
    } catch (err) {
      console.error("Failed to dismiss alert", err);
    }
  }, [fetchAlerts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAlerts();
    const id = setInterval(fetchAlerts, 10000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  return { alerts, dismissAlert };
}

export function useDashboard(farm_id) {
  const [data, setData] = useState(globalCache.dashboard[farm_id] || null)
  const [loading, setLoading] = useState(!globalCache.dashboard[farm_id])
  const [error, setError] = useState(null)

  const fetch_data = useCallback(async () => {
    if (!farm_id) return
    try {
      const res = await fetch(`${API_BASE}/api/v1/dashboard/${farm_id}`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch dashboard')
      const json = await res.json()
      globalCache.dashboard[farm_id] = json;
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [farm_id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetch_data()
    const id = setInterval(fetch_data, 10000)
    return () => clearInterval(id)
  }, [fetch_data])

  return { data, loading, error, refetch: fetch_data }
}

export function useRecommendations(farm_id, options = {}) {
  const includeAlerts = Boolean(options.includeAlerts);
  const includeState = options.includeState !== false;
  const limit = options.limit || 50;
  const since = options.since || null;
  const sinceStr = since instanceof Date ? since.toISOString() : since;
  const cacheKey = `${farm_id || 'none'}_${includeAlerts ? 'all' : 'recommendations'}_${includeState ? 'state' : 'fast'}_${limit}_${sinceStr || 'all'}`;
  const [data, setData] = useState(globalCache.recommendations[cacheKey] || [])
  const [loading, setLoading] = useState(!globalCache.recommendations[cacheKey])
  const [error, setError] = useState(null)

  const fetch_data = useCallback(async () => {
    if (!farm_id) return
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (sinceStr) params.set('since', sinceStr);
      if (!includeState) params.set('include_state', 'false');
      const res = await fetch(`${API_BASE}/api/v1/recommendations/${farm_id}?${params.toString()}`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch recommendations')
      let json = await res.json()
      
      // Filter out non-actionable "system perfect" recommendations
      json = json.filter(rec => {
        const text = (rec.title || '') + ' ' + (rec.message || '') + ' ' + (rec.reasoning || '');
        const isPerfect = text.includes('النظام يعمل بشكل مثالي') || text.includes('ضمن النطاق المثالي');
        return !isPerfect && (includeAlerts || rec.is_alert !== true);
      });

      globalCache.recommendations[cacheKey] = json;
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [farm_id, includeAlerts, includeState, limit, sinceStr, cacheKey])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetch_data()
    const id = setInterval(fetch_data, 10000)
    return () => clearInterval(id)
  }, [fetch_data])

  return { data, loading, error, refetch: fetch_data }
}

export function useIrrigationStatus(farm_id) {
  const [data, setData] = useState(globalCache.irrigationStatus[farm_id] || null)
  const [loading, setLoading] = useState(!globalCache.irrigationStatus[farm_id])
  const [error, setError] = useState(null)

  const fetch_data = useCallback(async () => {
    if (!farm_id) return
    try {
      const res = await fetch(`${API_BASE}/api/v1/irrigation/status/${farm_id}`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch irrigation status')
      const json = await res.json()
      globalCache.irrigationStatus[farm_id] = json;
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [farm_id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetch_data()
    const id = setInterval(fetch_data, 30000)
    return () => clearInterval(id)
  }, [fetch_data])

  return { data, loading, error, refetch: fetch_data }
}

export function useIrrigationResources(farmId, intervalMs = 15000) {
  const [data, setData] = useState(globalCache.irrigationResources[farmId] || null)
  const [loading, setLoading] = useState(!globalCache.irrigationResources[farmId])

  const fetch_data = useCallback(async () => {
    try {
      const token = getStoredToken();
      const res = await fetch(`${API_BASE}/api/v1/irrigation/resources/${farmId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      globalCache.irrigationResources[farmId] = json;
      setData(json)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [farmId])

  useEffect(() => {
    if (!farmId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetch_data()
    const id = setInterval(fetch_data, intervalMs)
    return () => clearInterval(id)
  }, [fetch_data, intervalMs, farmId])

  return { data, loading }
}

export function useDevices(providedFarmId = null) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        let farmId = providedFarmId;

        // 1. If no farmId provided, fetch it from the API
        if (!farmId) {
          const farms = await getFarms();
          if (farms && farms.length > 0) {
            farmId = farms[0].id;
          }
        }

        // 2. If we still don't have a farmId, check localStorage as a last resort
        if (!farmId) {
          const saved = JSON.parse(localStorage.getItem('warif_user') || '{}');
          farmId = saved.farmId;
        }

        let results = [];
        if (farmId) {
          console.log(`[useDevices] Fetching devices for farm ${farmId}`);
          const res = await fetchWithRetry(
            `${apiConfig.baseURL}/api/v1/farms/${farmId}/devices`,
            { headers: getAuthHeaders() }
          );
          results = Array.isArray(res) ? res : [];
          console.log(`[useDevices] Found ${results.length} devices in DB`);
        }

        if (!cancelled) setDevices(results);
      } catch (err) {
        console.error("[useDevices] Error loading devices:", err);
        if (!cancelled) setDevices([]);
      } finally { if (!cancelled) setLoading(false); }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [providedFarmId]);

  const counts = {
    sensors: devices.filter(d => d.type === 'sensor').length,
    pumps: devices.filter(d => d.type === 'actuator' && 
      (d.name?.includes('مضخة') ||
       d.name?.includes('ري') ||
       d.name?.includes('محبس') ||
       d.name?.toLowerCase().includes('irrigat') ||
       d.name?.toLowerCase().includes('pump') ||
       d.name?.toLowerCase().includes('valve'))).length,
    cooling: devices.filter(d => d.type === 'actuator' && 
      (d.name?.includes('تبريد') ||
       d.name?.includes('مكيف') ||
       d.name?.includes('المروحة') ||
       d.name?.includes('مروحة') ||
       d.name?.toLowerCase().includes('cool') ||
       d.name?.toLowerCase().includes('fan'))).length,
    actuators: devices.filter(d => d.type === 'actuator').length,
    total: devices.length,
    activeTotal: devices.filter(d => d.status === 'active').length,
  };

  return { devices, counts, loading };
}

export async function submitRecommendationFeedback(farmId, recId, helpful) {
  const token = getStoredToken();
  try {
    const res = await fetch(`${API_BASE}/api/v1/recommendations/${farmId}/feedback/${recId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ helpful })
    });
    if (!res.ok) throw new Error('Feedback submission failed');
    const data = await res.json();
    Object.keys(globalCache.recommendations).forEach(key => {
      if (String(key) !== String(farmId) && !key.startsWith(`${farmId}_`)) return;
      globalCache.recommendations[key] = globalCache.recommendations[key].map(rec =>
        String(rec.id) === String(recId) ? { ...rec, helpful, feedback_at: data.feedback_at } : rec
      );
    });
    console.log('[Warif] Feedback submitted:', data);
    return data;
  } catch (err) {
    console.error('[Warif] Feedback error:', err);
    return null;
  }
}

export async function submitRecommendationAction(farmId, recId, status) {
  const token = getStoredToken();
  try {
    const res = await fetch(`${API_BASE}/api/v1/recommendations/${farmId}/action/${recId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Recommendation action submission failed');
    const data = await res.json();
    Object.keys(globalCache.recommendations).forEach(key => {
      if (String(key) !== String(farmId) && !key.startsWith(`${farmId}_`)) return;
      globalCache.recommendations[key] = globalCache.recommendations[key].map(rec =>
        String(rec.id) === String(recId) ? { ...rec, action_status: status, is_read: true } : rec
      );
    });
    console.log('[Warif] Recommendation action submitted:', data);
    return data;
  } catch (err) {
    console.error('[Warif] Recommendation action error:', err);
    throw err;
  }
}

export async function executeRecommendation(_category, farmId, recommendationId = null, durationMin = 15) {
  const token = getStoredToken();
  try {
    void _category;
    if (!farmId || !recommendationId) {
      throw new Error('farmId and recommendationId are required to execute recommendation');
    }
    const mins = (typeof durationMin === 'number' && durationMin > 0)
      ? durationMin
      : (typeof durationMin === 'string' && !isNaN(parseInt(durationMin)) && parseInt(durationMin) > 0)
        ? parseInt(durationMin)
        : 15;

    const res = await fetch(`${API_BASE}/api/v1/recommendations/${farmId}/execute/${recommendationId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode: 'manual', duration_min: mins })
    });
    if (!res.ok) {
      let message = 'Recommendation execution failed';
      try {
        const errorData = await res.json();
        message = errorData?.detail || message;
      } catch {
        // Keep the generic message if the backend did not return JSON.
      }
      throw new Error(message);
    }
    const data = await res.json();
    Object.keys(globalCache.recommendations).forEach(key => {
      if (String(key) !== String(farmId) && !key.startsWith(`${farmId}_`)) return;
      globalCache.recommendations[key] = globalCache.recommendations[key].map(rec =>
        String(rec.id) === String(recommendationId) ? { ...rec, action_status: data.executed === false ? null : 'executed', is_read: true } : rec
      );
    });
    console.log('[Warif] Recommendation executed by backend decision:', data);
    return data;
  } catch (err) {
    console.error('[Warif] Execute recommendation error:', err);
    throw err;
  }
}

export async function submitAlertFeedback(alertId, helpful) {
  const token = getStoredToken();
  try {
    const res = await fetch(`${API_BASE}/api/v1/alerts/${alertId}/feedback`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ helpful })
    });
    if (!res.ok) throw new Error('Alert feedback submission failed');
    const data = await res.json();
    console.log('[Warif] Alert feedback submitted:', data);
    return data;
  } catch (err) {
    console.error('[Warif] Alert feedback error:', err);
    return null;
  }
}

export function useActivityLogs(farmId, limit = 20) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      if (!farmId) { setLoading(false); return; }
      const token = getStoredToken();
      const res = await fetch(
        `${API_BASE}/api/v1/logs?farm_id=${farmId}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Logs fetch error:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [farmId, limit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs();
    const id = setInterval(fetchLogs, 30000);
    return () => clearInterval(id);
  }, [fetchLogs]);

  return { logs, loading, refetch: fetchLogs };
}

export function useCoolingStatus(farmId, intervalMs = 5000) {
  const [status, setStatus] = useState({ fan: false, cooler: false, mode: 'stop' });
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!farmId) return;
    try {
      const token = getStoredToken();
      const res = await fetch(`${API_BASE}/api/v1/commands/cooling/status/${farmId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch cooling status:", err);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    const initial = window.setTimeout(fetchStatus, 0);
    if (intervalMs <= 0) return () => window.clearTimeout(initial);
    const id = setInterval(fetchStatus, intervalMs);
    return () => {
      window.clearTimeout(initial);
      clearInterval(id);
    };
  }, [fetchStatus, intervalMs]);

  return { status, loading, refetch: fetchStatus };
}

