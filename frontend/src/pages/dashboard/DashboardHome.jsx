import React, { useState, useEffect, useMemo } from 'react';
import {
  CardShell,
  CardTopRow,
  TempSunIcon,
  AirHumidityIcon,
  SoilDropIcon,
  DropBadgeIcon,
  PlantSoilIcon,
  WaterValveIcon,
  ListIcon,
  WindSharedIcon,
  IrrigationSmartIcon,
  EmptyState,
  RecommendationCard,
  AlertCard,
  LastUpdatedTimer
} from './DashboardShared';
import { getLabelForRange } from './dashboardUtils';
import { useLatestSensors, useDashboard, useSensorHistory, useRecommendations, useDevices, useIrrigationResources, submitRecommendationFeedback, executeRecommendation, submitAlertFeedback } from '../../hooks/useWarifData';



const getCropIcon = (key) => {
  switch(key) {
    case 'tomatoes': return "🍅";
    case 'cucumber': return "🥒";
    case 'pepper': return "🫑";
    case 'herbs': return "🌿";
    default: return "🌱";
  }
};

const getCropName = (key, isEn) => {
  const map = {
    tomatoes: { ar: "طماطم", en: "Tomatoes" },
    cucumber: { ar: "خيار", en: "Cucumber" },
    pepper: { ar: "فلفل", en: "Pepper" },
    herbs: { ar: "أعشاب", en: "Herbs" },
    default: { ar: "أخرى", en: "Other" }
  };
  const crop = map[key] || map.default;
  return isEn ? crop.en : crop.ar;
};

export function DashboardHome({ onGo, onSendAI, globalAutoMode, onOpenAssets, activeFarm, farmId, sharedSensors, alerts = [], onAlertAccept, onAlertReject, onAlertFeedback, farmObj }) {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  const crops = useMemo(() => {
    if (!farmObj?.crop_type) return [];
    return farmObj.crop_type.split(',').map(c => c.trim()).filter(Boolean);
  }, [farmObj]);

  // ── Live data from Backend API ─────────────────────────────
  const { data: localSensors } = useLatestSensors(10000);
  const { data: dashboardData } = useDashboard(farmId);
  const { devices, counts, loading: devicesLoading } = useDevices(farmId);
  const { data: irrigationResources } = useIrrigationResources(farmId, 15000);

  const livesensors = sharedSensors || localSensors;

  const apiTemp      = livesensors?.air_temperature  ?? null;
  const apiHum       = livesensors?.air_humidity     ?? null;
  const apiLight     = livesensors?.light_intensity  ?? null;
  const coolingActive= livesensors?.coolingActive    ?? false;
  const apiSoilMoist = livesensors?.soil_moisture    ?? null;
  const apiSoilTemp  = livesensors?.soil_temperature ?? null;

  const [resourceRange, setResourceRange] = useState("D");

  const { data: rawWater } = useSensorHistory('water_usage', 12);
  const { data: rawPower } = useSensorHistory('power_usage', 12);

  const resourceData = useMemo(() => {
    const points = [];
    const maxLen = Math.max(rawWater?.length || 0, rawPower?.length || 0);
    const len = Math.max(12, maxLen);
    
    for (let i = 0; i < len; i++) {
      const wItem = rawWater?.[i];
      const pItem = rawPower?.[i];
      
      let water = wItem?.value ?? 0;
      let power = pItem?.value ?? 0;
      
      let label = getLabelForRange(resourceRange, i, wItem?.timestamp || pItem?.timestamp, isEn);
      
      points.push({ label, water, power, value: water }); 
    }
    return points;
  }, [rawWater, rawPower, resourceRange, isEn]);

  const T = {
    title: isEn ? "Monitoring & Control Center" : "لوحة التحكم والمراقبة",
    subtitle: isEn ? "A direct overview of greenhouse performance and equipment efficiency." : "نظرة شاملة ومباشرة على أداء المحمية وكفاءة تشغيل المعدات.",
  };

  return (
    <>
      <div className="w-full px-4 md:px-8 py-4 page-enter">
      <div className="w-full max-w-[1380px] mx-auto flex flex-col gap-5">

        {/* Page Header */}
        <div className="flex items-center gap-3 animate-fade-in-down mb-1 mt-1">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0 border border-emerald-100/50 shadow-sm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <div className={`${isEn ? 'text-left' : 'text-right'}`}>
            <div className="text-3xl font-black text-gray-900 tracking-tighter leading-none">{T.title}</div>
            <div className="text-[16px] font-bold text-gray-500 mt-2 opacity-90">{T.subtitle}</div>
          </div>
        </div>

        {/* Top Section: Digital Twin Command Center */}
        <div className="animate-fade-in-up delay-1">
          <DigitalTwinCommandCenterCard onOpenAssets={onOpenAssets} alertsCount={alerts.length} counts={counts} crops={crops} />
        </div>


        {/* Perfectly Aligned 3-Column Layout: Uniform Row Heights & Custom Column Widths */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.12fr] gap-4 lg:gap-5 w-full">

          {/* Row 1: Top Aligned Cards - Compact Fixed Height */}
          <div className="animate-fade-in-up delay-2">
            <MicroclimateGlanceCard onGo={onGo} activeFarm={activeFarm} apiTemp={apiTemp} apiHum={apiHum} apiLight={apiLight} coolingActive={coolingActive} />
          </div>
          <div className="animate-fade-in-up delay-3">
            <SoilCropHealthGlanceCard onGo={onGo} activeFarm={activeFarm} apiSoilMoist={apiSoilMoist} apiSoilTemp={apiSoilTemp} />
          </div>
          <div className="animate-fade-in-up delay-4 flex flex-col row-span-2 lg:h-[600px] overflow-hidden">
            <DashboardAlertsCard
              onGo={onGo}
              alerts={alerts}
              onAccept={onAlertAccept}
              onReject={onAlertReject}
              onFeedback={onAlertFeedback}
              isEn={isEn}
              globalAutoMode={globalAutoMode}
            />
          </div>

          {/* Row 2: Bottom Aligned Cards - Compact Fixed Height */}
          <div className="animate-fade-in-up delay-5">
            <IrrigationGlanceCard
              onGo={onGo}
              globalAutoMode={globalAutoMode}
              activeFarm={farmObj}
              water={irrigationResources?.water_usage_liters ?? 0}
              power={irrigationResources?.power_usage_kwh ?? 0}
              dashboardData={dashboardData}
            />
          </div>
          <div className="animate-fade-in-up delay-6">
            <DSSGlanceCard onGo={onGo} globalAutoMode={globalAutoMode} activeFarm={activeFarm} farmId={farmId} />
          </div>

        </div>
        
      </div>
    </div>
    </>
  );
}

function DashboardAlertsCard({ onGo, alerts, onAccept, onReject, onFeedback, isEn, globalAutoMode }) {
  const [alertFeedback, setAlertFeedback] = useState({});
  const [showAlertThanks, setShowAlertThanks] = useState([]);

  const handleAlertFeedback = async (id, type) => {
    // تحديث الواجهة المحلية فوراً
    setAlertFeedback(prev => ({ ...prev, [id]: type }));
    setShowAlertThanks(prev => [...prev, id]);
    setTimeout(() => setShowAlertThanks(prev => prev.filter(i => i !== id)), 2000);

    // إرسال الفيدباك إلى الـ Backend - للـ alerts (ليس recommendations)
    const helpful = type === 'up';
    await submitAlertFeedback(id, helpful);
  };

  // تقسيم الانذارات حسب الشدة
  const urgentAlerts = alerts.filter(a => a.severity === 'high' || a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning' || a.severity === 'info');

  return (
    <CardShell className="h-full flex flex-col bg-white p-4 md:p-5">
      <CardTopRow
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>}
        iconBg={alerts.length > 0 ? "bg-red-50" : "bg-emerald-50"}
        iconColor={alerts.length > 0 ? "text-red-500" : "text-emerald-600"}
        title={isEn ? "System Alerts" : "تنبيهات النظام"}
        subtitle={
          alerts.length > 0
            ? `${alerts.length} ${isEn ? 'Active' : 'نشطة'}`
            : isEn ? "System Stable" : "النظام مستقر تماماً"
        }
      />
      <div className="mt-4 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 scrollbar-neutral pr-1">
        {alerts.length === 0 ? (
          <EmptyState
            compact={true}
            variant="success"
            title={isEn ? 'No active alerts' : 'لا توجد تنبيهات نشطة'}
            subtitle={isEn ? 'System is stable and operating within optimal parameters.' : 'النظام مستقر ويعمل ضمن النطاق المثالي.'}
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
          />
        ) : (
          <>
            {/* كل الانذارات مرتبة حسب الشدة */}
            {[...urgentAlerts, ...warningAlerts].map((alert, i) => (
              <AlertCard key={alert.id || i} alert={alert} isEn={isEn} globalAutoMode={globalAutoMode} onAccept={onAccept} onFeedback={handleAlertFeedback} feedbackState={alertFeedback} showThanks={showAlertThanks} compact={true} />
            ))}
          </>
        )}
      </div>
    </CardShell>
  );
}

/* =========================================================
   Glance Cards representing AI Modules
   Standardized with p-5 padding and Real-time indicators
========================================================= */


function ClimateSparkline({ color = "#ef4444", gradientId = "climateGradient" }) {
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  return (
    <div className="flex flex-col gap-1.5 h-full justify-center">
      <div className="flex items-center justify-between opacity-70">
        <div className="text-xs font-black text-gray-400 uppercase tracking-tighter">{isEn ? 'Temp Trend (24h)' : 'ميول الحرارة (٢٤ ساعة)'}</div>
      </div>
      <div className="relative w-44 h-24 bg-gray-50/30 rounded-xl overflow-hidden border border-gray-100/50 flex items-center">
        <svg viewBox="0 0 100 40" className="w-full h-full preserve-3d ml-2">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path 
            d="M0 35 Q 20 5, 40 25 T 70 10 T 100 30" 
            fill="none" 
            stroke={color} 
            strokeWidth="2.5" 
            strokeLinecap="round"
            className="transition-all duration-700 ease-in-out"
          />
          <path 
            d="M0 35 Q 20 5, 40 25 T 70 10 T 100 30 L 100 40 L 0 40 Z" 
            fill={`url(#${gradientId})`} 
            className="transition-all duration-700 ease-in-out"
          />
        </svg>
      </div>
      <div className="flex items-center justify-between mt-1 px-1">
        <div className="text-[11px] font-black text-gray-300 uppercase tracking-tight">{isEn ? 'Stable Range' : 'النطاق المستقر'}</div>
        <div className="text-[11px] font-bold px-1.5 rounded-md" style={{ color: color, backgroundColor: `${color}10` }}>
          18°C – 38°C
        </div>
      </div>
    </div>
  );
}

function SoilSparkline({ color = "#10b981", gradientId = "soilGradient" }) {
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  return (
    <div className="flex flex-col gap-1.5 h-full justify-center">
      <div className="flex items-center justify-between opacity-70">
        <div className="text-xs font-black text-gray-400 uppercase tracking-tighter">{isEn ? 'Moisture Trend (24h)' : 'اتجاه الرطوبة (٢٤ ساعة)'}</div>
      </div>
      
      <div className="relative w-44 h-24 bg-gray-50/30 rounded-xl overflow-hidden border border-gray-100/50 flex items-center">
        <svg viewBox="0 0 100 40" className="w-full h-full preserve-3d ml-2">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          
          <path 
            d="M0 30 Q 15 10, 30 20 T 60 5 T 100 15" 
            fill="none" 
            stroke={color} 
            strokeWidth="2" 
            strokeLinecap="round"
            className="transition-all duration-700 ease-in-out"
          />
          <path 
            d="M0 30 Q 15 10, 30 20 T 60 5 T 100 15 L 100 40 L 0 40 Z" 
            fill={`url(#${gradientId})`} 
            className="transition-all duration-700 ease-in-out"
          />
        </svg>
      </div>
      <div className="flex items-center justify-between mt-1 px-1">
        <div className="text-[11px] font-black text-gray-300 uppercase tracking-tight">{isEn ? 'Stable Range' : 'النطاق المستقر'}</div>
        <div className="text-[11px] font-bold px-1.5 rounded-md" style={{ color: color, backgroundColor: `${color}15` }}>
          80% - 35%
        </div>
      </div>
    </div>
  );
}

function MicroclimateGlanceCard({ onGo, activeFarm, apiTemp, apiHum, apiLight, coolingActive }) {
  const temp = apiTemp ?? 0;
  const hum  = apiHum  ?? 0;
  const light = apiLight ?? 0;
  const isOptimal = temp >= 18 && temp <= 38 && hum >= 45 && hum <= 85;
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');

  return (
    <CardShell className="p-4 md:p-5 h-full cursor-pointer card-interactive group flex flex-col justify-between" onClick={() => onGo("microclimate")}>
      <div className="animate-fade-in delay-1">
      <CardTopRow 
        title={isEn ? "Climate & Ventilation" : "المناخ والتهوية"} 
        subtitle={<LastUpdatedTimer seconds={0} ar="آخر تحديث" en="Last Update" isEn={isEn} />} 
        icon={<WindSharedIcon />} 
        isEn={isEn}
        iconBg="bg-emerald-50"
        iconColor="text-[#059669]"
      />

      <div className={`mt-4 flex items-start justify-between gap-2 ${isEn ? 'flex-row-reverse' : ''}`}>
        <div className={`flex flex-col gap-3 ${isEn ? 'items-end text-right' : 'items-start text-right'}`}>
          <div className="flex flex-col">
            <div className="text-[12px] text-gray-400 font-bold uppercase mb-0.5 tracking-tight">{isEn ? 'Temperature' : 'درجة الحرارة'}</div>
            <div className={`text-[22px] font-black text-gray-800 leading-none ${isEn ? 'flex flex-row-reverse items-baseline justify-end' : ''}`}>
              {temp.toFixed(1)}<span className="text-[12px] font-bold text-gray-400 mx-1">°C</span>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="text-[12px] text-gray-400 font-bold uppercase mb-0.5 tracking-tight">{isEn ? 'Air Humidity' : 'رطوبة الجو'}</div>
            <div className={`text-[22px] font-black text-gray-800 leading-none ${isEn ? 'flex flex-row-reverse items-baseline justify-end' : ''}`}>
              {hum.toFixed(0)}<span className="text-[12px] font-bold text-gray-400 mx-1">%</span>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="text-[12px] text-gray-400 font-bold uppercase mb-0.5 tracking-tight">{isEn ? 'Light Intensity' : 'شدة الإضاءة'}</div>
            <div className={`text-[22px] font-black text-gray-800 leading-none ${isEn ? 'flex flex-row-reverse items-baseline justify-end' : ''}`}>
              {Math.round(light).toLocaleString()}<span className="text-[12px] font-bold text-gray-400 mx-1">Lux</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
           <div className={`px-3 py-1.5 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm min-w-[70px] border ${coolingActive ? 'bg-blue-50 border-blue-200' : isOptimal ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
              <div className={`text-xs font-bold mb-0.5 ${coolingActive ? 'text-blue-600' : isOptimal ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}`}>{isEn ? 'Status' : 'الوضع'}</div>
              <div className={`text-[12px] font-black ${coolingActive ? 'text-blue-700' : isOptimal ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}`}>{coolingActive ? (isEn ? 'Cooling Active' : 'تبريد نشط') : isOptimal ? (isEn ? 'Optimal' : 'ضمن النطاق المثالي') : temp > 38 ? (isEn ? 'High Temp!' : 'حرارة مرتفعة!') : hum < 45 ? (isEn ? 'Low Humidity' : 'رطوبة منخفضة') : hum > 85 ? (isEn ? 'High Humidity' : 'رطوبة مرتفعة') : (isEn ? 'Check Needed' : 'يحتاج مراجعة')}</div>
           </div>
           <div className="w-full">
              <ClimateSparkline color={temp > 32 ? 'var(--status-error)' : temp > 28 ? 'var(--status-warning)' : 'var(--status-success)'} gradientId="climateGradHome" />
           </div>
        </div>
      </div>
      </div>
    </CardShell>
  );
}

function SoilCropHealthGlanceCard({ onGo, activeFarm, apiSoilMoist, apiSoilTemp }) {
  const soilMoist = apiSoilMoist ?? 0;
  const soilTemp  = apiSoilTemp  ?? 0;
  const isHealthy = soilMoist >= 35 && soilMoist <= 80 && soilTemp >= 18 && soilTemp <= 35;
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');

  return (
    <CardShell className="p-4 md:p-5 h-full cursor-pointer card-interactive group flex flex-col justify-between" onClick={() => onGo("soil")}>
      <div className="animate-fade-in delay-2">
      <CardTopRow 
        title={isEn ? "Soil & Crop Health" : "بيئة وصحة التربة"} 
        subtitle={<LastUpdatedTimer seconds={0} ar="آخر تحديث" en="Last Update" isEn={isEn} />} 
        icon={<PlantSoilIcon />} 
        isEn={isEn}
        iconBg="bg-emerald-50"
        iconColor="text-[#059669]"
      />

      <div className={`mt-4 flex items-start justify-between gap-4 ${isEn ? 'flex-row-reverse' : ''}`}>
        <div className={`flex flex-col gap-3 ${isEn ? 'items-end text-right' : 'items-start text-right'}`}>
          <div className="flex flex-col">
            <div className="text-[12px] text-gray-400 font-bold uppercase mb-0.5 tracking-tight">{isEn ? 'Soil Temp' : 'حرارة التربة'}</div>
            <div className={`text-[22px] font-black text-gray-800 leading-none ${isEn ? 'flex flex-row-reverse items-baseline justify-end' : ''}`}>
              {soilTemp.toFixed(1)}<span className="text-[12px] font-bold text-gray-400 mx-1">°C</span>
            </div>
          </div>
          <div className="flex flex-col">
            <div className={`text-[12px] text-gray-400 font-bold uppercase mb-0.5 tracking-tight flex items-center gap-2 ${isEn ? 'flex-row-reverse' : ''}`}>
              {isEn ? 'Soil Moisture' : 'رطوبة التربة'}
            </div>
            <div className={`text-[22px] font-black text-gray-800 leading-none ${isEn ? 'flex flex-row-reverse items-baseline justify-end' : ''}`}>
              {soilMoist.toFixed(0)}<span className="text-[12px] font-bold text-gray-400 mx-1">%</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
           <div className={`px-3 py-2 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm min-w-[70px] border ${isHealthy ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
              <div className={`text-xs font-bold mb-0.5 ${isHealthy ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}`}>{isEn ? 'Status' : 'الوضع'}</div>
              <div className={`text-[13px] font-black ${isHealthy ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}`}>{isHealthy ? (isEn ? 'Optimal' : 'ضمن النطاق المثالي') : soilMoist < 35 ? (isEn ? 'Dry Soil!' : 'تربة جافة!') : soilMoist > 80 ? (isEn ? 'Waterlogged' : 'تربة مشبعة') : soilTemp > 35 ? (isEn ? 'Hot Soil' : 'حرارة تربة مرتفعة') : (isEn ? 'Check Needed' : 'يحتاج مراجعة')}</div>
           </div>
           <div className="w-full">
              <SoilSparkline color={isHealthy ? 'var(--status-success)' : 'var(--status-warning)'} gradientId="soilGradHome" />
           </div>
        </div>
      </div>

      </div>
    </CardShell>
  );
}

function IrrigationGlanceCard({ onGo, globalAutoMode, activeFarm, dashboardData, water, power }) {
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  const [flowPos, setFlowPos] = React.useState(0);

  const waterPercent = dashboardData?.water_tank_level || 0;
  const waterUsage = water || 0;
  const energyKwh = power || 0;
  const isActive = dashboardData?.irrigation_status === "active";
  const flowRate = isActive ? 20 : 0;

  React.useEffect(() => {
    if (!isActive) { setFlowPos(0); return; }
    const timer = setInterval(() => setFlowPos(p => p >= 100 ? 0 : p + 4), 60);
    return () => clearInterval(timer);
  }, [isActive]);

  const tankColor = waterPercent > 50 ? '#22c55e' : waterPercent > 20 ? '#f59e0b' : '#ef4444';
  const tankLabel = waterPercent > 50 ? (isEn?'Good':'جيد') : waterPercent > 20 ? (isEn?'Low':'منخفض') : (isEn?'Critical':'حرج');

  return (
    <CardShell
      className="p-4 md:p-5 h-full cursor-pointer card-interactive group relative overflow-hidden flex flex-col justify-between"
      onClick={() => onGo("irrigation")}
    >
      <div className="animate-fade-in delay-3 flex flex-col gap-3 h-full">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100/50 flex items-center justify-center shadow-sm flex-shrink-0">
              <IrrigationSmartIcon size={22} strokeWidth={1.7} className="text-blue-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black text-gray-800">{isEn ? 'Irrigation Control' : 'إدارة الري'}</span>
              <span className="text-[11px] text-gray-400">{isEn ? 'Last update: now' : 'آخر تحديث: الآن'}</span>
            </div>
          </div>
        </div>

        {/* Pump Status */}
        <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl border ${isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
          <span className="text-sm font-bold text-gray-700">
            {isEn ? (isActive ? 'Pump Active' : 'Pump Off') : (isActive ? 'المضخة تعمل' : 'المضخة مغلقة')}
          </span>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-xs font-semibold text-gray-500">
              {isEn ? (isActive ? 'Running' : 'Standby') : (isActive ? 'يعمل' : 'استعداد')}
            </span>
          </div>
        </div>

        {/* Live Flow Visualizer */}
        <div className="flex flex-col gap-1.5 px-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">{isEn ? 'Live Flow' : 'التدفق اللحظي'}</span>
            <span className={`text-xs font-black ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
              {flowRate} {isEn ? 'L/min' : 'لتر/دقيقة'}
            </span>
          </div>
          <div className="relative w-full h-5 flex items-center">
            <div className="absolute inset-x-0 h-2.5 rounded-full bg-gray-100 overflow-hidden">
              {isActive && (
                <div
                  className="absolute h-full rounded-full"
                  style={{
                    width: '30%',
                    left: `${flowPos}%`,
                    background: 'linear-gradient(90deg, transparent, #3b82f6, #06b6d4, transparent)',
                    transition: 'none',
                  }}
                />
              )}
            </div>
            <div className={`absolute ${isEn ? 'left-0' : 'right-0'} w-5 h-5 rounded-full flex items-center justify-center z-10 ${isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <span className="text-xs">💧</span>
            </div>
            <div className={`absolute ${isEn ? 'right-0' : 'left-0'} w-5 h-5 rounded-full flex items-center justify-center z-10 ${isActive ? 'bg-emerald-100' : 'bg-gray-100'}`}>
              <span className="text-xs font-black" style={{ color: isActive ? '#22c55e' : '#9ca3af' }}>
                {isEn ? '►' : '◄'}
              </span>
            </div>
          </div>
        </div>

        {/* Water Tank */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">{isEn ? 'Water Tank' : 'خزان المياه'}</span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-black" style={{ color: tankColor }}>{Math.round(waterPercent)}%</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${tankColor}20`, color: tankColor }}>
                {tankLabel}
              </span>
            </div>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(waterPercent, 100)}%`, backgroundColor: tankColor }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-gray-100 mt-auto">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400">{isEn ? 'Water' : 'المياه'}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black text-gray-800">{Math.round(waterUsage)}</span>
              <span className="text-[11px] text-gray-400">{isEn ? 'L' : 'لتر'}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-400">{isEn ? 'Energy' : 'الكهرباء'}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black text-gray-800">
                {energyKwh < 1 ? (energyKwh * 1000).toFixed(0) : energyKwh.toFixed(2)}
              </span>
              <span className="text-[11px] text-gray-400">
                {energyKwh < 1 ? (isEn ? 'Wh' : 'واط') : (isEn ? 'kWh' : 'ك.واط')}
              </span>
            </div>
          </div>
        </div>

      </div>
    </CardShell>
  );
}

function DSSGlanceCard({ onGo, globalAutoMode, activeFarm, farmId }) {
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  const isRtl = !isEn;
  const [feedback, setFeedback] = useState({});
  const [showThanksIds, setShowThanksIds] = useState([]);

  const handleFeedback = async (id, type) => {
    setFeedback(prev => ({ ...prev, [id]: type }));
    setShowThanksIds(prev => [...prev, id]);
    setTimeout(() => setShowThanksIds(prev => prev.filter(i => i !== id)), 2000);
    await submitRecommendationFeedback(farmId, id, type === 'up');
  };
  const { data: apiRecs } = useRecommendations(farmId);

  const recommendations = (apiRecs && apiRecs.length > 0) ? apiRecs.slice(0, 2).map((r, idx) => ({
    id: r.id || idx,
    title: r.title || r.message || 'توصية',
    data_insight: r.data_insight || r.reasoning || '',
    suggestion: r.suggestion || '',
    benefit: r.benefit || '',
    priority: r.priority === 'high' ? 'high' : 'normal',
    severity: r.severity || 'normal',
    type: r.category || 'general',
    category: r.category || 'general',
    is_read: r.is_read,
    created_at: r.created_at,
  })) : [];

  const T_Subtitle = isEn ? "Data-driven actions to optimize farm performance" : "إجراءات مدروسة لتحسين أداء المزرعة";

  return (
    <CardShell className="p-4 md:p-5 h-full cursor-pointer card-interactive group flex flex-col justify-between" onClick={() => onGo("dss")}>
      <div className="animate-fade-in delay-2">
        <CardTopRow
          title={isEn ? "Recommendations" : "التوصيات"}
          subtitle={T_Subtitle}
          icon={<ListIcon />}
          isEn={isEn}
          iconBg="bg-emerald-50"
          iconColor="text-[#059669]"
        />
      </div>

      <div
        className={`flex-1 mt-3 overflow-y-auto max-h-[190px] flex flex-col gap-3 scrollbar-neutral ${isRtl ? 'pl-2' : 'pr-2'}`}
      >

        {recommendations.length === 0 ? (
          <EmptyState
            compact={true}
            title={isEn ? 'No active recommendations' : 'لا توجد توصيات نشطة'}
            subtitle={isEn ? 'The system is monitoring for optimization opportunities.' : 'يقوم النظام بمراقبة الفرص المتاحة لتحسين الأداء.'}
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>}
          />
        ) : (
          recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={{
                id: rec.id,
                title: rec.title,
                message: rec.suggestion || rec.title,
                reasoning: rec.data_insight,
                category: rec.category,
                severity: rec.severity || 'normal',
                created_at: rec.created_at
              }}
              farmId={farmId}
              globalAutoMode={globalAutoMode}
              isEn={isEn}
              onExecute={(category, farmId) => executeRecommendation(category, farmId)}
              onIgnore={() => {}}
              onFeedback={handleFeedback}
              feedbackState={feedback}
              showThanks={showThanksIds}
              compact={true}
            />
          ))
        )}
      </div>

      <div className="mt-4 pt-3 flex items-center justify-between border-t border-gray-50">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{isEn ? 'System Ready' : 'النظام جاهز'}</div>
        <div className="flex items-center gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
           <span className="text-xs font-black text-emerald-600 tracking-wide"><LastUpdatedTimer seconds={0} ar="" en="" isEn={isEn} /></span>
        </div>
      </div>
    </CardShell>
  );
}

function DigitalTwinCommandCenterCard({ onOpenAssets, alertsCount = 0, counts = {}, crops = [] }) {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';

  return (
    <CardShell className="p-6 lg:p-7 relative overflow-hidden bg-white border border-gray-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.01)] group/main card-interactive">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-10 relative z-10 w-full items-center">

        <div className="w-full lg:w-[45%] flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 text-[11px] font-black text-emerald-700 w-max">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {isEn ? 'Digital Twin Engine' : 'محرك التوأم الرقمي'}
            </div>
            {alertsCount > 0 && (
               <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-red-50 border-red-200 text-red-700 animate-pulse`}>
                 <div className="relative flex items-center justify-center">
                   <span className="text-sm">🔔</span>
                   <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full border border-white"></span>
                 </div>
                 <span className="text-[11px] font-black">{alertsCount} {isEn ? 'Alerts' : 'تنبيهات'}</span>
               </div>
            )}
          </div>
          <h3 className="text-2xl font-black tracking-tighter mb-2 text-gray-800 leading-tight">{isEn ? 'Digital Twin Command Center' : 'مركز قيادة التوأم الرقمي'}</h3>
          <p className="text-[13px] text-gray-400 font-semibold leading-relaxed">
            {isEn ? 'A precise real-time digital representation connected with all sensors to monitor the farm environment and manage efficiency.' : 'تمثيل رقمي دقيق متصل في الوقت الفعلي مع كافّة الحساسات لمراقبة بيئة المزرعة لحظياً وإدارة كفاءة التشغيل.'}
          </p>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-[2px] self-stretch bg-gradient-to-b from-transparent via-gray-100 to-transparent mx-2" />

        <div className="w-full lg:w-[55%] flex flex-row gap-0 items-center">

          {/* Hardware & Sensors — left of right section, clickable */}
          <div className={`cursor-pointer group/assets ${crops.length > 0 ? 'flex-1 min-w-0' : 'w-full'}`} onClick={onOpenAssets}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-base font-black text-gray-800">{isEn ? 'Hardware & Sensors Log' : 'سجل المعدات والأجهزة'}</div>
                <div className="text-[12px] text-[var(--status-success)] font-black uppercase tracking-widest px-2.5 py-1 bg-emerald-50 rounded-xl">{isEn ? 'Active' : 'نشط'}</div>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <MinimalStat value={counts.sensors || 0} label={isEn ? 'Sensors' : 'حساسات'} />
                <MinimalStat value={counts.pumps || 0} label={isEn ? 'Pumps' : 'مضخات'} />
                <MinimalStat value={counts.cooling || 0} label={isEn ? 'Cooling' : 'تبريد'} />
              </div>
            </div>
          </div>

          {/* Greenhouse Crops — right column */}
          {crops.length > 0 && (
            <>
              <div className="hidden lg:block w-[2px] self-stretch bg-gradient-to-b from-transparent via-gray-100 to-transparent mx-5" />
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className={`flex items-center gap-1.5 ${isEn ? 'flex-row-reverse' : ''}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    {isEn ? "Greenhouse Crops" : 'محصول هذه المحمية'}
                  </div>
                </div>
                <div className={`flex flex-wrap gap-2 ${isEn ? 'flex-row-reverse' : ''}`}>
                  {crops.slice(0, 4).map((crop, idx) => (
                    <div key={crop + idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50/80 rounded-xl border border-gray-100/50">
                      <span className="text-base">{getCropIcon(crop)}</span>
                      <span className="text-[12px] font-black text-gray-700">{getCropName(crop, isEn)}</span>
                    </div>
                  ))}
                  {crops.length > 4 && (
                    <div className="flex items-center justify-center px-2.5 py-1 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] font-black text-emerald-700">
                      +{crops.length - 4}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </CardShell>
  );
}

function MinimalStat({ value, label }) {
  return (
    <div className="flex flex-col items-center justify-center py-1 px-3 min-w-[75px] rounded-xl bg-gray-50/50 border border-gray-100/50 group-hover/assets:border-emerald-100 transition-all">
      <div className="text-3xl font-black text-gray-900 leading-none mb-0.5">{value}</div>
      <div className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{label}</div>
    </div>
  );
}
