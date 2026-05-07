// Fetches real sensor data from Warif Backend API

import { useState, useEffect, useCallback } from 'react'
import { fetchWithRetry, getAuthHeaders, apiConfig } from '../config/api'
import { triggerFanControl, getFarms } from '../services/api'

const API_BASE = import.meta.env.VITE_API_URL || ''

const authHeaders = () => getAuthHeaders()

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
  noisePhase: 0,
  coolingActive: false,
  irrigationActive: false,
  activeAnomaly: null, // "cooling_failure" | "irrigation_failure" | null
  anomalyRemainingCycles: 0,
  history: []
};

// Expose manual triggers for UI
export async function triggerManualIrrigation(action = 'start', farmId = null, durationMin = 15) {
  const token = localStorage.getItem('warif_token');
  const API_BASE = import.meta.env.VITE_API_URL || '';
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
      body: JSON.stringify({ device_id: `irrigation_${farmId}`, duration_min: durationMin })
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
export async function triggerManualCooling(mode = "stop", farmId = null) {
  console.log('[Warif] Manual cooling requested:', mode, 'farm:', farmId);
  let payload = { fan: false, cooler: false, farm_id: farmId };
  if (mode === 'full')     payload = { fan: true,  cooler: true,  farm_id: farmId };
  if (mode === 'fan_only') payload = { fan: true,  cooler: false, farm_id: farmId };

  const token = localStorage.getItem('warif_token');
  try {
    const API_BASE = import.meta.env.VITE_API_URL || '';
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

export function useLatestSensors(intervalMs = 10000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!globalCache.latestSensors)
  const [error, setError] = useState(null)

  const fetch_data = useCallback(async () => {
    try {
      const userData = JSON.parse(localStorage.getItem('warif_user') || '{}');
      const sessionFarms = JSON.parse(sessionStorage.getItem('warif_session_farms') || '[]');
      const farmId = sessionFarms.length > 0
        ? sessionFarms[0].id
        : (userData.farmId || null);
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
      } catch (fetchErr) {
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
  }, [])

  useEffect(() => {
    fetch_data()
    const id = setInterval(fetch_data, intervalMs)
    return () => clearInterval(id)
  }, [fetch_data, intervalMs])

  return { data, loading, error, refetch: fetch_data }
}

export function useAutoMode(farmId) {
  const [autoMode, setAutoMode] = useState(true);
  const [loading, setLoading] = useState(false);

  // Load auto_mode from backend on mount
  useEffect(() => {
    if (!farmId) return;
    const token = localStorage.getItem('warif_token');
    fetch(`${API_BASE}/api/v1/farms/${farmId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (typeof data.auto_mode === 'boolean') {
          setAutoMode(data.auto_mode);
        }
      })
      .catch(() => { });
  }, [farmId]);

  // Save auto_mode to backend
  const toggleAutoMode = async (newValue) => {
    if (!farmId) return;
    setLoading(true);
    const token = localStorage.getItem('warif_token');
    try {
      await fetch(`${API_BASE}/api/v1/farms/${farmId}/auto-mode`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ auto_mode: newValue })
      });
      setAutoMode(newValue);
    } catch (e) {
      console.error('Failed to update auto mode:', e);
    } finally {
      setLoading(false);
    }
  };

  return { autoMode, toggleAutoMode, loading };
}

export function useSensorHistory(sensor_type, limit = 100) {
  const cacheKey = `${sensor_type}_${limit}`;
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(!globalCache.history[cacheKey])

  const fetch_data = useCallback(async () => {
    if (!sensor_type) return
    try {
      const userData = JSON.parse(localStorage.getItem('warif_user') || '{}');
      const sessionFarms = JSON.parse(sessionStorage.getItem('warif_session_farms') || '[]');
      const farmId = sessionFarms.length > 0
        ? sessionFarms[0].id
        : (userData.farmId || null);
      if (!farmId) return;

      const res = await fetch(`${API_BASE}/api/v1/sensors?sensor_type=${sensor_type}&farm_id=${farmId}&limit=${limit}`, {
        headers: authHeaders()
      })
      if (res.ok) {
        const json = await res.json()
        const reversed = json.reverse();
        globalCache.history[cacheKey] = null;
        globalCache.history[cacheKey] = reversed;
        setData(reversed)
      }
    } catch (err) {
      console.error("History fetch failed:", err)
    } finally {
      setLoading(false)
    }
  }, [sensor_type, limit, cacheKey])

  useEffect(() => {
    fetch_data()
    const id = setInterval(fetch_data, 30000)
    return () => clearInterval(id)
  }, [fetch_data])

  return { data, loading, refetch: fetch_data }
}

export function useAutoAlerts(sensors, globalAutoMode) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const userData = JSON.parse(localStorage.getItem('warif_user') || '{}');
      // Get farmId from sessionStorage first (most current), 
      // then localStorage, then fetch without filter
      const sessionFarms = JSON.parse(sessionStorage.getItem('warif_session_farms') || '[]');
      const farmId = sessionFarms.length > 0 
        ? sessionFarms[0].id 
        : (userData.farmId || null);
      const token = localStorage.getItem('warif_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const url = `${API_BASE}/api/v1/alerts?status=open${farmId ? `&farm_id=${farmId}` : ''}`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch alerts");
      const json = await res.json();
      
      const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
      
      const mappedAlerts = json.map(backendAlert => {
        let frontendSeverity = "medium";
        if (backendAlert.severity === "critical") frontendSeverity = "high";
        else if (backendAlert.severity === "info") frontendSeverity = "low";
        
        const sensorNameAr = backendAlert.sensor_type === "water_tank" ? "خزان المياه" 
                           : backendAlert.sensor_type === "air_temperature" ? "حرارة الجو"
                           : backendAlert.sensor_type === "soil_moisture" ? "رطوبة التربة"
                           : "النظام";
                           
        const sensorNameEn = backendAlert.sensor_type === "water_tank" ? "Water Tank"
                           : backendAlert.sensor_type === "air_temperature" ? "Air Temp"
                           : backendAlert.sensor_type === "soil_moisture" ? "Soil Moist"
                           : "System";

        const msg = backendAlert.message || (isEn ? "System Alert" : "تنبيه النظام");

        let shortTitle = msg;
        let fullDetails = msg;

        if (msg.includes('-')) {
          const parts = msg.split('-');
          shortTitle = parts[0].trim();
          fullDetails = msg;
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
          if (sensorType === 'power_usage') return isEn ? "Check power consumption of devices." : "تحقق من استهلاك الطاقة للأجهزة.";
          return isEn ? "Review system status and take action." : "راجع حالة النظام واتخذ الإجراء المناسب.";
        };

        return {
          id: backendAlert.id,
          autoMode: globalAutoMode,
          title: shortTitle || (isEn ? "System Alert" : "تنبيه النظام"),
          severity: backendAlert.severity || frontendSeverity,
          created_at: backendAlert.created_at,
          sensor_type: backendAlert.sensor_type,
          sensor: isEn ? sensorNameEn : sensorNameAr,
          value: extractedValue,
          reason: reasonMatch,
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
  }, [globalAutoMode]);

  const dismissAlert = useCallback(async (id) => {
    try {
      const token = localStorage.getItem('warif_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';
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
    fetch_data()
    const id = setInterval(fetch_data, 10000)
    return () => clearInterval(id)
  }, [fetch_data])

  return { data, loading, error, refetch: fetch_data }
}

export function useRecommendations(farm_id) {
  const [data, setData] = useState(globalCache.recommendations[farm_id] || [])
  const [loading, setLoading] = useState(!globalCache.recommendations[farm_id])
  const [error, setError] = useState(null)

  const fetch_data = useCallback(async () => {
    if (!farm_id) return
    try {
      const res = await fetch(`${API_BASE}/api/v1/recommendations/${farm_id}`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch recommendations')
      const json = await res.json()
      globalCache.recommendations[farm_id] = json;
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

export function useIrrigationResources(farmId, intervalMs = 15000) {
  const [data, setData] = useState(globalCache.irrigationResources[farmId] || null)
  const [loading, setLoading] = useState(!globalCache.irrigationResources[farmId])

  const fetch_data = useCallback(async () => {
    try {
      const token = localStorage.getItem('warif_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/v1/irrigation/resources/${farmId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      globalCache.irrigationResources[farmId] = json;
      setData(json)
    } catch (err) {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [farmId])

  useEffect(() => {
    if (!farmId) return
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

        // 3. Fallback to localStorage ONLY if the DB is truly empty for this user
        if (results.length === 0) {
          const saved = JSON.parse(localStorage.getItem('warif_user') || '{}');
          if (saved.sensorList && saved.sensorList.length > 0) {
            console.log(`[useDevices] DB empty, falling back to ${saved.sensorList.length} localStorage sensors`);
            results = saved.sensorList.map(s => ({
              id: s.id || `local_${Math.random()}`,
              name: s.name,
              type: (s.type?.toLowerCase().includes('sensor') || s.type?.includes('حساس')) ? 'sensor' : 'actuator',
              status: (s.status === 'normal' || s.status === 'active') ? 'active' : 'inactive',
              isLocal: true
            }));
          }
        }
        
        setDevices(results);
      } catch (err) { 
        console.error("[useDevices] Error loading devices:", err);
        setDevices([]); 
      } finally { setLoading(false); }
    };
    load();
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
  const token = localStorage.getItem('warif_token');
  const API_BASE = import.meta.env.VITE_API_URL || '';
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
    console.log('[Warif] Feedback submitted:', data);
    return data;
  } catch (err) {
    console.error('[Warif] Feedback error:', err);
    return null;
  }
}

export async function executeRecommendation(category, farmId, durationMin = 15) {
  const token = localStorage.getItem('warif_token');
  const API_BASE = import.meta.env.VITE_API_URL || '';
  try {
    if (category === 'irrigation') {
      return await triggerManualIrrigation('start', farmId, durationMin);
    } else if (category === 'temperature' || category === 'humidity') {
      return await triggerManualCooling('full', farmId);
    } else {
      console.warn('[Warif] Unsupported recommendation category:', category);
      return null;
    }
  } catch (err) {
    console.error('[Warif] Execute recommendation error:', err);
    return null;
  }
}

export async function submitAlertFeedback(alertId, helpful) {
  const token = localStorage.getItem('warif_token');
  const API_BASE = import.meta.env.VITE_API_URL || '';
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
