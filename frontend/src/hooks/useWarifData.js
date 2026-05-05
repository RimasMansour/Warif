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
export async function triggerManualIrrigation(deviceId = 'simulator_001', durationMin = 20) {
  simState.irrigationActive = true;
  setTimeout(() => { simState.irrigationActive = false; }, durationMin * 60 * 1000);
  try {
    const token = localStorage.getItem('warif_token');
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${API_BASE}/api/v1/irrigation/manual`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, duration_min: durationMin })
    });
    if (!res.ok) throw new Error('Irrigation API failed');
    const data = await res.json();
    console.log('[Warif] Manual irrigation started via API:', data);
    return data;
  } catch (err) {
    console.error('[Warif] Manual irrigation API error:', err);
    return null;
  }
}
export async function triggerManualCooling(action = "start") {
  console.log(`[Warif] Manual cooling requested: ${action}`);
  try {
    // We try to find a device_id from latest sensors if possible, or use a default/generic one
    // In a real scenario, this would be the specific actuator ID for this farm.
    const device_id = "GATEWAY_MASTER"; 
    const res = await triggerFanControl(device_id, action);
    return res;
  } catch (err) {
    console.error("Failed to trigger cooling:", err);
    throw err;
  }
}

export function useLatestSensors(intervalMs = 10000) {
  const [data, setData] = useState(globalCache.latestSensors)
  const [loading, setLoading] = useState(!globalCache.latestSensors)
  const [error, setError] = useState(null)

  const fetch_data = useCallback(async () => {
    try {
      let mapped = {}
      try {
        const res = await fetch(`${API_BASE}/api/v1/sensors/latest`, {
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
          soil_moisture: 42
        }
      }

      globalCache.latestSensors = mapped;
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

export function useSensorHistory(sensor_type, limit = 100) {
  const cacheKey = `${sensor_type}_${limit}`;
  const [data, setData] = useState(globalCache.history[cacheKey] || [])
  const [loading, setLoading] = useState(!globalCache.history[cacheKey])

  const fetch_data = useCallback(async () => {
    if (!sensor_type) return
    try {
      const res = await fetch(`${API_BASE}/api/v1/sensors?sensor_type=${sensor_type}&limit=${limit}`, {
        headers: authHeaders()
      })
      if (res.ok) {
        const json = await res.json()
        const reversed = json.reverse();
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
      const farmId = userData.farmId;
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
          severity: frontendSeverity,
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
      (d.name?.toLowerCase().includes('pump') ||
       d.name?.toLowerCase().includes('مضخ') ||
       d.name?.toLowerCase().includes('valve'))).length,
    cooling: devices.filter(d => d.type === 'actuator' && 
      (d.name?.toLowerCase().includes('fan') ||
       d.name?.toLowerCase().includes('cool') ||
       d.name?.toLowerCase().includes('مروح') ||
       d.name?.toLowerCase().includes('تبريد'))).length,
    actuators: devices.filter(d => d.type === 'actuator').length,
    total: devices.length,
    activeTotal: devices.filter(d => d.status === 'active').length,
  };

  return { devices, counts, loading };
}
