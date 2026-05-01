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
  simState.coolingActive = true;
  setTimeout(() => { simState.coolingActive = false; }, 30000); 
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
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());

  // Function to dismiss alerts
  const dismissAlert = useCallback((id) => {
    setDismissedAlerts(prev => new Set(prev).add(id));
  }, []);

  useEffect(() => {
    if (!sensors) return;
    
    const newAlerts = [];
    const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
    
    // Mode-aware alert builder
    const addAlert = (id, title, titleAr, severity, sensor, val, actionAuto, actionAutoAr, actionManual, actionManualAr, actionType) => {
      if (dismissedAlerts.has(id)) return; // Don't show if dismissed

      newAlerts.push({
        id,
        autoMode: globalAutoMode,
        title: isEn ? title : titleAr,
        severity, 
        sensor: isEn ? sensor : (sensor === 'Air Temp' ? 'حرارة الجو' : sensor === 'Soil Moist' ? 'رطوبة التربة' : sensor === 'Light' ? 'الإضاءة' : 'النظام'),
        value: val,
        action: globalAutoMode ? (isEn ? actionAuto : actionAutoAr) : (isEn ? actionManual : actionManualAr),
        actionType,
        timestamp: new Date().toLocaleTimeString()
      });
    };

    // Thresholds & Anomalies Check
    if (sensors.anomaly === "cooling_failure") {
      addAlert("a-1", 
        "Cooling System Failure", "عطل في نظام التبريد", "high", "System", "Error", 
        "Cooling restarted via backup system.", "تمت محاولة إعادة تشغيل التبريد عبر النظام الاحتياطي.", 
        "Suggested action: Inspect cooling fans immediately", "الإجراء المقترح: افحص مراوح التبريد فوراً، هل تريد تفعيل المروحة الاحتياطية؟", "cool");
    }
    if (sensors.anomaly === "irrigation_failure") {
      addAlert("a-2", 
        "Irrigation Interruption", "انقطاع شبكة الري", "high", "System", "Error", 
        "Emergency pump activated automatically.", "تم تشغيل مضخة الطوارئ تلقائياً.", 
        "Suggested action: Check water pump and main valve", "الإجراء المقترح: تحقق من المضخة والمحبس الرئيسي، هل تريد تشغيل الطوارئ؟", "irrigate");
    }
    if (sensors.air_temperature > 35 && sensors.anomaly !== "cooling_failure") {
      addAlert("t-1", 
        "High Air Temperature", "ارتفاع حرارة الجو", "medium", "Air Temp", `${sensors.air_temperature.toFixed(1)}°C`, 
        "Emergency ventilation activated automatically.", "تم تفعيل التهوية القصوى تلقائياً لخفض الحرارة.", 
        "Suggested action: Activate emergency ventilation", "الإجراء المقترح: تفعيل التهوية القصوى لخفض الحرارة. هل تريد تفعيلها الآن؟", "cool");
    }
    if (sensors.soil_moisture < 25 && sensors.anomaly !== "irrigation_failure") {
      addAlert("sm-1", 
        "Low Soil Moisture", "جفاف التربة", "high", "Soil Moist", `${sensors.soil_moisture.toFixed(0)}%`, 
        "Irrigation started automatically.", "تم بدء الري تلقائياً لتعويض نقص الرطوبة.", 
        "Suggested action: Start irrigation immediately", "الإجراء المقترح: بدء الري فوراً لتعويض النقص. هل توافق؟", "irrigate");
    }
    if (sensors.light_intensity > 100000) {
      addAlert("l-1", 
        "High Light Intensity", "إضاءة ساطعة جداً", "medium", "Light", `${Math.round(sensors.light_intensity)} Lux`, 
        "Shading nets deployed automatically.", "تم تفعيل شبك التظليل تلقائياً لحماية المحصول.", 
        "Suggested action: Deploy shading nets", "الإجراء المقترح: تفعيل شبك التظليل لحماية المحصول. تأكيد؟", "shade");
    }

    setAlerts(newAlerts);
  }, [sensors, globalAutoMode, dismissedAlerts]);

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
