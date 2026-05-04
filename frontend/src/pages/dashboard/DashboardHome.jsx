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
  EmptyState
} from './DashboardShared';
import { 
  Donut,
  SoilTrendChart
} from './DashboardCharts';
import { 
  formatLastUpdated, 
  generateDataForRange,
  getLabelForRange
} from './dashboardUtils';
import { useLatestSensors, useDashboard, useSensorHistory, useRecommendations } from '../../hooks/useWarifData';

// Liquid Wave Animation Styles
const waveStyles = `
  @keyframes wave-move {
    0% { transform: translateX(0) translateZ(0) scaleY(1); }
    50% { transform: translateX(-25%) translateZ(0) scaleY(0.8); }
    100% { transform: translateX(-50%) translateZ(0) scaleY(1); }
  }
  .animate-wave {
    animation: wave-move 4s linear infinite;
  }
  .animate-wave-slow {
    animation: wave-move 7s linear infinite;
  }
`;

function LastUpdatedTimer({ seconds, ar, en, isEn }) {
  const [localSec, setLocalSec] = useState(seconds);
  useEffect(() => {
    const interval = setInterval(() => setLocalSec(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  return <>{formatLastUpdated(localSec, ar, en)}</>;
}

export function DashboardHome({ onGo, onSendAI, globalAutoMode, onOpenAssets, activeFarm, sharedSensors, alerts = [], onAlertAccept, onAlertReject, onAlertFeedback }) {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  // ── Live data from Backend API ─────────────────────────────
  const farmId = JSON.parse(localStorage.getItem('warif_user') || '{}').farmId || 1;
  const { data: localSensors } = useLatestSensors(10000);
  const { data: dashboardData } = useDashboard(farmId);

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
    subtitle: isEn ? "A direct overview of greenhouse performance and equipment efficiency." : "نظرة شاملة ومباشرة على أداء المحميات وكفاءة تشغيل المعدات.",
    commandCenter: isEn ? "Digital Twin Command Center" : "مركز قيادة التوأم الرقمي",
    climate: isEn ? "Microclimate & Ventilation" : "المناخ والتهوية",
    soil: isEn ? "Soil & Crop Health" : "بيئة وصحة التربة",
    irrigation: isEn ? "Irrigation Management" : "إدارة الري",
    dss: isEn ? "Smart Recommendations" : "التوصيات الذكية",
    camera: isEn ? "Live Monitoring" : "المراقبة المباشرة",
    automationActive: isEn ? "Smart Automation Active" : "نظام الأتمتة الذكي نشط",
    inferenceActive: isEn ? "Inference Engine Active" : "محرك الاستدلال نشط",
    fullLogic: isEn ? "Full Logic Reasoning" : "تفسير منطقي كامل",
  };

  return (
    <>
      <style>{waveStyles}</style>
      <div className="w-full px-4 md:px-8 py-5 page-enter">
      <div className="w-full max-w-[1380px] mx-auto flex flex-col gap-6">

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
          <DigitalTwinCommandCenterCard onOpenAssets={onOpenAssets} alertsCount={alerts.length} />
        </div>


        {/* Perfectly Aligned 3-Column Layout: Uniform Row Heights & Custom Column Widths */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.12fr] gap-6 items-stretch w-full">
          
          {/* Row 1: Top Aligned Cards */}
          <div className="animate-fade-in-up delay-2">
            <MicroclimateGlanceCard onGo={onGo} activeFarm={activeFarm} apiTemp={apiTemp} apiHum={apiHum} apiLight={apiLight} coolingActive={coolingActive} />
          </div>
          <div className="animate-fade-in-up delay-3">
            <SoilCropHealthGlanceCard onGo={onGo} activeFarm={activeFarm} apiSoilMoist={apiSoilMoist} apiSoilTemp={apiSoilTemp} />
          </div>
          <div className="animate-fade-in-up delay-4 flex flex-col">
            <DashboardAlertsCard 
              alerts={alerts} 
              onAccept={onAlertAccept} 
              onReject={onAlertReject} 
              onFeedback={onAlertFeedback} 
              isEn={isEn} 
              globalAutoMode={globalAutoMode}
            />
          </div>

          {/* Row 2: Bottom Aligned Cards */}
          <div className="animate-fade-in-up delay-5">
            <IrrigationGlanceCard onGo={onGo} globalAutoMode={globalAutoMode} activeFarm={activeFarm} resourceData={resourceData} dashboardData={dashboardData} />
          </div>
          <div className="animate-fade-in-up delay-6">
            <DSSGlanceCard onGo={onGo} globalAutoMode={globalAutoMode} activeFarm={activeFarm} />
          </div>
          <div className="animate-fade-in-up delay-7">
            <SoilTrendChart isRtl={!isEn} isEn={isEn} activeFarm={activeFarm} />
          </div>

        </div>
        
      </div>
    </div>
    </>
  );
}

function DashboardAlertsCard({ alerts, onAccept, onReject, onFeedback, isEn, globalAutoMode }) {
  return (
    <CardShell className="h-full flex flex-col bg-white p-5">
      <CardTopRow
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>}
        iconBg={alerts.length > 0 ? "bg-red-50" : "bg-emerald-50"}
        iconColor={alerts.length > 0 ? "text-red-500" : "text-emerald-600"}
        title={isEn ? "System Alerts" : "تنبيهات النظام اللحظية"}
        subtitle={
          alerts.length > 0
            ? `${alerts.length} ${isEn ? 'Active alerts' : 'تنبيهات نشطة'}`
            : isEn ? "System Stable" : "النظام مستقر تماماً"
        }
      />
      <div className="flex-1 mt-4 overflow-y-auto max-h-[200px] pr-1 custom-scrollbar flex flex-col gap-3">
        {alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-80 min-h-[120px]">
            <div className="text-[13px] font-bold">{isEn ? 'No active alerts' : 'لا توجد تنبيهات نشطة'}</div>
          </div>
        ) : (
          alerts.map((alert, i) => {
            const isRtl = !isEn;
            const isCritical = alert.severity === 'high' || alert.severity === 'critical';
            const borderColor = isCritical ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-orange-500';
            const bgColor = isCritical ? 'bg-red-50/20' : 'bg-orange-50/20';
            const titleColor = isCritical ? 'text-red-700' : 'text-orange-700';

            return (
              <div key={alert.id || i} className={`p-4 rounded-lg ${borderColor} flex flex-col gap-3 animate-fade-in ${bgColor}`}>

                {/* العنوان فقط - واضح وصريح */}
                <div className={`flex items-start justify-between gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <h4 className={`text-[15px] font-black leading-tight ${titleColor}`}>
                    {alert.title}
                  </h4>
                  <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{alert.timestamp}</span>
                </div>

                {/* السبب - نبقيه كما هو */}
                {alert.reason && (
                  <div className={`rounded-lg p-3 bg-blue-50/50 border border-blue-100/40 ${isRtl ? 'text-right' : 'text-left'}`}>
                    <div className="text-[12px] text-gray-700 leading-relaxed font-medium">
                      <span className="font-bold text-gray-800">السبب: </span>{alert.reason}
                    </div>
                  </div>
                )}

                {/* الإجراء المطلوب - نبقيه كما هو */}
                <div className={`bg-gradient-to-r ${isCritical ? 'from-red-100 to-red-50' : 'from-orange-100 to-orange-50'} rounded-lg p-3 border ${isCritical ? 'border-red-200' : 'border-orange-200'}`}>
                  <div className={`${isRtl ? 'text-right' : 'text-left'}`}>
                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">الإجراء:</div>
                    <div className={`text-[13px] font-black ${isCritical ? 'text-red-700' : 'text-orange-700'}`}>
                      {alert.action}
                    </div>
                  </div>
                </div>

                {/* الفيدباك - اللايك والدس لايك */}
                <div className={`pt-2 border-t border-gray-100/60 flex items-center justify-between gap-2`}>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {isEn ? 'Was this helpful?' : 'هل كان مفيداً؟'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onFeedback?.(alert.id, false)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all"
                      title={isEn ? 'Not helpful' : 'غير مفيد'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                    </button>
                    <button
                      onClick={() => onFeedback?.(alert.id, true)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all"
                      title={isEn ? 'Helpful' : 'مفيد'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </CardShell>
  );
}




/* =========================================================
   Glance Cards representing AI Modules
   Standardized with p-5 padding and Real-time indicators
========================================================= */

function LiveStatusFooter({ time = "منذ 5 دقائق" }) {
  // Logic Fix: Removing the footer as the timestamp is now in the header subtitle
  return null;
}

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
    <CardShell className="p-6 h-full cursor-pointer card-interactive group flex flex-col justify-between" onClick={() => onGo("microclimate")}>
      <div className="animate-fade-in delay-1">
      <CardTopRow 
        title={isEn ? "Climate & Ventilation" : "المناخ والتهوية"} 
        subtitle={<LastUpdatedTimer seconds={0} ar="آخر تحديث" en="Last Update" isEn={isEn} />} 
        icon={<WindSharedIcon />} 
        isEn={isEn}
        iconBg="bg-emerald-50"
        iconColor="text-[#059669]"
      />

      <div className={`mt-4 flex items-end justify-between gap-2 ${isEn ? 'flex-row-reverse' : ''}`}>
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
    <CardShell className="p-6 h-full cursor-pointer card-interactive group flex flex-col justify-between" onClick={() => onGo("soil")}>
      <div className="animate-fade-in delay-2">
      <CardTopRow 
        title={isEn ? "Soil & Crop Health" : "بيئة وصحة التربة"} 
        subtitle={<LastUpdatedTimer seconds={0} ar="آخر تحديث" en="Last Update" isEn={isEn} />} 
        icon={<PlantSoilIcon />} 
        isEn={isEn}
        iconBg="bg-emerald-50"
        iconColor="text-[#059669]"
      />

      <div className={`mt-4 flex items-end justify-between gap-4 ${isEn ? 'flex-row-reverse' : ''}`}>
        <div className={`flex flex-col gap-5 ${isEn ? 'items-end text-right' : 'items-start text-right'}`}>
          <div className="flex flex-col">
            <div className="text-[12px] text-gray-400 font-bold uppercase mb-0.5 tracking-tight">{isEn ? 'Soil Temp' : 'حرارة التربة'}</div>
            <div className={`text-[26px] font-black text-gray-800 leading-none ${isEn ? 'flex flex-row-reverse items-baseline justify-end' : ''}`}>
              {soilTemp.toFixed(1)}<span className="text-[14px] font-bold text-gray-400 mx-1.5">°C</span>
            </div>
          </div>
          <div className="flex flex-col">
            <div className={`text-[12px] text-gray-400 font-bold uppercase mb-0.5 tracking-tight flex items-center gap-2 ${isEn ? 'flex-row-reverse' : ''}`}>
              {isEn ? 'Soil Moisture' : 'رطوبة التربة'}
            </div>
            <div className={`text-[26px] font-black text-gray-800 leading-none ${isEn ? 'flex flex-row-reverse items-baseline justify-end' : ''}`}>
              {soilMoist.toFixed(0)}<span className="text-[14px] font-bold text-gray-400 mx-1.5">%</span>
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

function IrrigationGlanceCard({ onGo, globalAutoMode, activeFarm, dashboardData, resourceData }) {
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  
  // Get real data from dashboard API
  const waterPercent = dashboardData?.water_tank_level || 0;
  const energyKwh = dashboardData?.energy_kwh || 0;
  // Calculate a fake visual percentage for energy (max 50 kWh daily goal)
  const energyPercent = Math.min(100, (energyKwh / 50) * 100);
  return (
    <CardShell className="p-6 h-full cursor-pointer card-interactive group relative overflow-hidden flex flex-col justify-between" onClick={() => onGo("irrigation")}>
      <div className="animate-fade-in delay-3">
        <CardTopRow 
          title={isEn ? "Irrigation Management" : "إدارة الري"} 
          subtitle={<LastUpdatedTimer seconds={0} ar="آخر تحديث" en="Last Update" isEn={isEn} />} 
          icon={<IrrigationSmartIcon />} 
          isEn={isEn}
          iconBg="bg-emerald-50"
          iconColor="text-[#059669]"
        />

        <div className="mt-8 flex flex-col items-center">
          {/* Centered Donut Chart */}
          <div className="relative w-32 h-32 flex items-center justify-center mb-6">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100/50" />
              <circle
                cx="50" cy="50" r="42" stroke={`url(#glanceFlowGrad-${dashboardData?.irrigation_status === "active" ? 100 : 0})`} strokeWidth="8"
                strokeDasharray={264} strokeDashoffset={264 - (264 * (dashboardData?.irrigation_status === "active" ? 100 : 0)) / 100}
                strokeLinecap="round" fill="transparent" className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id={`glanceFlowGrad-${dashboardData?.irrigation_status === "active" ? 100 : 0}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={dashboardData?.irrigation_status === "active" ? "#10b981" : "#ef4444"} />
                  <stop offset="100%" stopColor={dashboardData?.irrigation_status === "active" ? "#3b82f6" : "#f87171"} />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={`text-2xl font-black tracking-tighter ${dashboardData?.irrigation_status === "active" ? 'text-emerald-600' : 'text-gray-400'}`}>
                {dashboardData?.irrigation_status === "active" ? "ON" : "OFF"}
              </span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{isEn ? "Flow" : "تدفق"}</span>
            </div>
          </div>

          {/* Centered Daily Consumption */}
          <div className="flex flex-col items-center text-center">
            <div className="text-xs text-gray-400 font-bold uppercase mb-1 tracking-tight font-black">{isEn ? 'Daily Consumption' : 'الاستهلاك اليومي'}</div>
            <div className="text-4xl font-black text-gray-800 tracking-tight flex items-baseline gap-1">
              {Math.round(resourceData?.water ?? 0)} <span className="text-base font-bold text-gray-400">{isEn ? 'L' : 'لتر'}</span>
            </div>
          </div>
        </div>

        {/* Thickened Resource Bars */}
        <div className="mt-8 flex flex-col gap-4 w-full bg-gray-50/50 p-4 rounded-[24px] border border-gray-100/50">
           <div className="flex items-center gap-4">
              <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100/50 shrink-0 shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
              </div>
              <div className="flex-1 h-3.5 bg-gray-200/50 rounded-full overflow-hidden shadow-inner relative">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(59,130,246,0.5)]" style={{ width: `${waterPercent}%` }} />
              </div>
              <div className="text-[13px] font-black text-blue-600 shrink-0 min-w-[35px]">{waterPercent.toFixed(0)}%</div>
           </div>
           <div className="flex items-center gap-4">
              <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100/50 shrink-0 shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div className="flex-1 h-3.5 bg-gray-200/50 rounded-full overflow-hidden shadow-inner relative">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(245,158,11,0.5)]" style={{ width: `${energyPercent}%` }} />
              </div>
              <div className="text-[13px] font-black text-amber-600 shrink-0 min-w-[35px]">{energyKwh.toFixed(1)}</div>
           </div>
        </div>
      </div>
    </CardShell>
  );
}

function DSSGlanceCard({ onGo, globalAutoMode, activeFarm }) {
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  const isRtl = !isEn;
  const [interactedIds, setInteractedIds] = useState({});
  const farmId = JSON.parse(localStorage.getItem('warif_user') || '{}').farmId || 1;
  const { data: apiRecs } = useRecommendations(farmId);

  // Format recommendations professionally
  const recommendations = (apiRecs && apiRecs.length > 0) ? apiRecs.slice(0, 2).map((r, idx) => ({
    id: r.id || idx,
    title: r.title || r.message?.slice(0, 45) || 'توصية',
    data_insight: r.data_insight || r.reasoning || r.message || '',
    suggestion: r.suggestion || r.message || '',
    reason: r.reason || r.reasoning || '',
    priority: r.priority === 'high' ? 'high' : 'normal',
    category: r.category || 'general',
    is_read: r.is_read,
  })) : [];

  const T_Subtitle = isEn ? "Data-driven actions to optimize farm performance" : "إجراءات مدروسة لتحسين أداء المزرعة";

  const handleAction = (e, idx, type) => {
    e.stopPropagation();
    setInteractedIds(prev => ({ ...prev, [idx]: type }));
  };

  return (
    <CardShell className="p-6 h-full cursor-pointer card-interactive group flex flex-col justify-between" onClick={() => onGo("dss")}>
      <div className="animate-fade-in delay-2">
        <CardTopRow
          title={isEn ? "Smart Recommendations" : "توصيات ذكية"}
          subtitle={T_Subtitle}
          icon={<ListIcon />}
          isEn={isEn}
          iconBg="bg-emerald-50"
          iconColor="text-[#059669]"
        />
      </div>

      <div className="flex-1 mt-4 overflow-y-auto max-h-[200px] pr-1 custom-scrollbar flex flex-col gap-3">
        {recommendations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-80 min-h-[120px]">
            <div className="text-[13px] font-bold">{isEn ? 'No active recommendations' : 'لا توجد توصيات نشطة'}</div>
          </div>
        ) : (
          recommendations.map((rec, idx) => {
            const status = interactedIds[rec.id];
            if (status === 'later') return null;

            return (
              <div key={rec.id} className={`p-4 rounded-xl border flex flex-col gap-2.5 animate-fade-in ${
                rec.priority === 'high'
                  ? 'bg-blue-50/30 border-blue-100/50'
                  : 'bg-emerald-50/30 border-emerald-100/50'
              }`}>

                {/* العنوان */}
                <div className={`flex items-start justify-between gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                  <h4 className={`text-[14px] font-black leading-tight ${rec.priority === 'high' ? 'text-blue-700' : 'text-emerald-700'}`}>
                    {rec.title}
                  </h4>
                </div>

                {/* البيانات والتحليل */}
                {rec.data_insight && (
                  <div className={`rounded-lg p-2.5 bg-white/60 border border-gray-100/50 ${isRtl ? 'text-right' : 'text-left'}`}>
                    <div className="text-[11px] text-gray-600 leading-relaxed font-medium">
                      <span className="font-bold text-gray-800">{isEn ? 'Analysis:' : 'التحليل:'}</span> {rec.data_insight}
                    </div>
                  </div>
                )}

                {/* الاقتراح */}
                {rec.suggestion && (
                  <div className={`bg-gradient-to-r ${rec.priority === 'high' ? 'from-blue-100 to-blue-50' : 'from-emerald-100 to-emerald-50'} rounded-lg p-3 border ${rec.priority === 'high' ? 'border-blue-200' : 'border-emerald-200'}`}>
                    <div className={`${isRtl ? 'text-right' : 'text-left'}`}>
                      <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">{isEn ? 'Suggestion' : 'الاقتراح'}:</div>
                      <div className={`text-[13px] font-black ${rec.priority === 'high' ? 'text-blue-700' : 'text-emerald-700'}`}>
                        {rec.suggestion}
                      </div>
                    </div>
                  </div>
                )}

                {/* الفيدباك - اللايك والدس لايك */}
                <div className={`pt-2 border-t border-gray-100/60 flex items-center justify-between gap-2`}>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {isEn ? 'Rate this' : 'هل مفيدة؟'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleAction(e, rec.id, 'dislike')}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all"
                      title={isEn ? 'Not helpful' : 'غير مفيدة'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                    </button>
                    <button
                      onClick={(e) => handleAction(e, rec.id, 'like')}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all"
                      title={isEn ? 'Helpful' : 'مفيدة'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
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

function DigitalTwinCommandCenterCard({ onOpenAssets, alertsCount = 0 }) {
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
        <div className="hidden lg:block w-[2px] h-32 bg-gradient-to-b from-transparent via-gray-100 to-transparent mx-2" />

        <div className="w-full lg:w-[50%] cursor-pointer group/assets" onClick={onOpenAssets}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="text-base font-black text-gray-800">{isEn ? 'Hardware & Sensors Log' : 'سجل المعدات والأجهزة'}</div>
                <div className="text-[12px] text-[var(--status-success)] font-black uppercase tracking-widest px-2.5 py-1 bg-emerald-50 rounded-xl">{isEn ? 'Active' : 'نشط'}</div>
            </div>

            <div className="flex flex-wrap gap-2 justify-center mt-2">
              <MinimalStat value="4" label={isEn ? 'Sensors' : 'حساسات'} />
              <MinimalStat value="2" label={isEn ? 'Pumps' : 'مضخات'} />
              <MinimalStat value="1" label={isEn ? 'Camera' : 'كاميرا'} />
              <MinimalStat value="6" label={isEn ? 'Cooling' : 'تبريد'} />
            </div>
          </div>
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

function IoTSystemHealthCard({ isEn }) {
  return (
    <CardShell className="flex flex-col bg-white p-5 md:p-6 min-h-[220px]">
      <CardTopRow 
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/></svg>}
        iconBg="bg-blue-50"
        iconColor="text-blue-500"
        title={isEn ? "IoT Sensors Network" : "شبكة حساسات إنترنت الأشياء"}
        subtitle={isEn ? "Live System Health" : "حالة اتصال الأجهزة الميدانية"}
      />
      <div className="flex-1 mt-5 flex flex-col gap-3">
        
        {/* Main Gateway Status */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100/50 text-emerald-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[12px] font-black text-gray-800">{isEn ? 'Main IoT Gateway' : 'البوابة الرئيسية (Gateway)'}</span>
              <span className="text-xs font-bold text-emerald-600">{isEn ? 'Connected & Stable' : 'متصل ومستقر'}</span>
            </div>
          </div>
          <div className="text-xs font-bold text-gray-400 bg-white px-2 py-1 rounded shadow-sm">
            Ping: 12ms
          </div>
        </div>

        {/* Nodes Health Grid */}
        <div className="grid grid-cols-2 gap-3 mt-1">
          <div className="flex flex-col p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500">{isEn ? 'Climate Nodes' : 'عقد المناخ'}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></span>
            </div>
            <div className="text-xl font-black text-gray-800">100%</div>
            <div className="text-xs text-gray-400 font-medium mt-0.5">{isEn ? 'Signal Strength' : 'قوة إشارة النقل'}</div>
          </div>

          <div className="flex flex-col p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500">{isEn ? 'Soil Probes' : 'مجسات التربة'}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></span>
            </div>
            <div className="text-xl font-black text-gray-800">96%</div>
            <div className="text-xs text-gray-400 font-medium mt-0.5">{isEn ? 'Battery Level' : 'مستوى البطارية'}</div>
          </div>
        </div>

      </div>
      <div className="mt-4 pt-3 flex items-center justify-between border-t border-gray-50">
        <div className="text-xs font-bold text-gray-400 tracking-tighter">{isEn ? 'Last Sync Time' : 'آخر مزامنة للبيانات'}</div>
        <div className="flex items-center gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
           <span className="text-xs font-black text-blue-600 tracking-wide"><LastUpdatedTimer seconds={0} ar="" en="" isEn={isEn} /></span>
        </div>
      </div>
    </CardShell>
  );
}

export function TopKPIStrip({ temp = 0, hum = 0, soil = 0, alertsCount = 0, globalAutoMode = true, isEn = true, T = {} }) {
  return (
    <div className="flex flex-wrap items-center gap-3 w-full bg-white/60 backdrop-blur-sm p-2 rounded-2xl border border-gray-200/50 shadow-sm mb-5" dir={isEn ? 'ltr' : 'rtl'}>
      <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <span className="text-lg">🌡</span>
        <span className="text-sm font-black text-gray-800">{(temp || 0).toFixed(1)}°C</span>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <span className="text-lg">💧</span>
        <span className="text-sm font-black text-gray-800">{(hum || 0).toFixed(0)}%</span>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <span className="text-lg">🌱</span>
        <span className="text-sm font-black text-gray-800">{(soil || 0).toFixed(0)}%</span>
      </div>
      <div className="flex-1"></div>
      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-colors ${globalAutoMode ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-orange-50 border-orange-100 text-orange-700'}`}>
        <span className={`w-2 h-2 rounded-full animate-pulse ${globalAutoMode ? 'bg-emerald-500' : 'bg-orange-500'}`}></span>
        <span className="text-xs font-black uppercase tracking-tight">{globalAutoMode ? (isEn ? 'Auto Mode' : 'تشغيل ذكي') : (isEn ? 'Manual Mode' : 'تحكم يدوي')}</span>
      </div>
      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all ${alertsCount > 0 ? 'bg-red-50 border-red-200 text-red-700 scale-[1.02]' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
        <div className="relative flex items-center justify-center">
          <span className="text-lg">🔔</span>
          {alertsCount > 0 && (
            <>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping opacity-75"></span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border border-white"></span>
            </>
          )}
        </div>
        <span className="text-xs font-black">{alertsCount} {isEn ? 'Alerts' : 'تنبيهات'}</span>
      </div>
    </div>
  );
}
