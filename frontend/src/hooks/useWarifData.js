// frontend/src/hooks/useWarifData.js
// Fetches real sensor data from Warif Backend API

import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

const getToken = () => localStorage.getItem('warif_token')

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
})

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
export function triggerManualIrrigation() {
  simState.irrigationActive = true;
  setTimeout(() => { simState.irrigationActive = false; }, 30000); // Auto off after 30s
}
export function triggerManualCooling() {
  // Fan is thermostat-controlled by physics simulator
  // This is a UI feedback function only
  console.log('[Warif] Manual cooling requested - simulator handles fan automatically at 33°C')
  return Promise.resolve({ status: 'acknowledged' })
}

export function useLatestSensors(intervalMs = 10000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
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
        // Fallback to base mock values if backend is down or throws error
        mapped = {
          air_temperature: 31,
          air_humidity: 45,
          soil_temperature: 25,
          soil_moisture: 42
        }
      }

      // --- SIMULATION ENGINE (FRONTEND INJECTION) ---
      // DISABLED: Now using the true Backend Physics Engine.
      if (false) {
      mapped.air_temperature = parseFloat(mapped.air_temperature || mapped['درجة الحرارة'] || 31);
      mapped.air_humidity = parseFloat(mapped.air_humidity || mapped['رطوبة الهواء'] || 45);
      mapped.soil_moisture = parseFloat(mapped.soil_moisture || mapped['رطوبة التربة'] || 42);
      mapped.soil_temperature = parseFloat(mapped.soil_temperature || mapped['حرارة التربة'] || 25);

      // 1. Light Intensity (Mock Sensor)
      mapped.light_intensity = 60000; 

      // 2. Pulse Noise (Random fluctuation over time)
      simState.noisePhase += 0.2;
      const noise = Math.sin(simState.noisePhase);
      mapped.air_temperature += noise * 0.5;
      mapped.air_humidity += noise * 2;
      mapped.soil_moisture += (Math.random() - 0.5) * 1.0;
      mapped.light_intensity += (Math.random() - 0.5) * 5000;

      // 3. Anomaly Generation (1% chance if no active anomaly)
      if (!simState.activeAnomaly && Math.random() < 0.01) {
        const anomalies = ["cooling_failure", "irrigation_failure"];
        simState.activeAnomaly = anomalies[Math.floor(Math.random() * anomalies.length)];
        simState.anomalyRemainingCycles = 5; // lasts for 5 cycles
      }

      if (simState.activeAnomaly) {
        if (simState.activeAnomaly === "cooling_failure") {
          mapped.air_temperature += 8; // Spike temp
        } else if (simState.activeAnomaly === "irrigation_failure") {
          mapped.soil_moisture = 15; // Severe drop
        }
        simState.anomalyRemainingCycles -= 1;
        if (simState.anomalyRemainingCycles <= 0) {
          simState.activeAnomaly = null; // Recover
        }
      }

      // 4. Hysteresis Loop for Cooling
      if (mapped.air_temperature >= 33) {
        simState.coolingActive = true;
      } else if (mapped.air_temperature <= 30 && !simState.activeAnomaly) {
        simState.coolingActive = false;
      }
      
      // Affect values based on active states
      if (simState.coolingActive) {
        mapped.air_temperature -= 1.5; // Simulate cooling pulling temp down
      }
      if (simState.irrigationActive) {
        mapped.soil_moisture += 15; // Simulate watering
      }
      
        // Attach simulation state flags to data for UI to consume
        mapped.coolingActive = simState.coolingActive;
        mapped.irrigationActive = simState.irrigationActive;
        mapped.anomaly = simState.activeAnomaly;
      }

      // Maintain historic array for charts
      simState.history.push({ 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
        temp: mapped.air_temperature, 
        hum: mapped.air_humidity, 
        soil: mapped.soil_moisture 
      });
      if (simState.history.length > 20) {
        simState.history.shift();
      }

      mapped.history = [...simState.history];
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
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch_data = useCallback(async () => {
    if (!sensor_type) return
    try {
      const res = await fetch(`${API_BASE}/api/v1/sensors?sensor_type=${sensor_type}&limit=${limit}`, {
        headers: authHeaders()
      })
      if (res.ok) {
        const json = await res.json()
        setData(json.reverse()) // Reverse so oldest is first for chart plotting
      }
    } catch (err) {
      console.error("History fetch failed:", err)
    } finally {
      setLoading(false)
    }
  }, [sensor_type, limit])

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
      const token = localStorage.getItem('warif_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/v1/alerts?status=open`, {
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

        const shortTitle = backendAlert.message ? backendAlert.message.split('.')[0] : (isEn ? "System Alert" : "تنبيه النظام");

        return {
          id: backendAlert.id,
          autoMode: globalAutoMode,
          title: shortTitle,
          severity: frontendSeverity,
          sensor: isEn ? sensorNameEn : sensorNameAr,
          value: backendAlert.actual_value !== null ? backendAlert.actual_value.toString() : "",
          action: backendAlert.message,
          actionType: "system",
          timestamp: new Date(backendAlert.created_at).toLocaleTimeString()
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
    const id = setInterval(fetch_data, 10000)
    return () => clearInterval(id)
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

export function useIrrigationResources(farmId, intervalMs = 15000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

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
