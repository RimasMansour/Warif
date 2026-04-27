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
  IrrigationSmartIcon
} from './DashboardShared';
import { 
  Donut
} from './DashboardCharts';
import { CameraCard } from './CameraCard';
import { 
  formatLastUpdated, 
  getLiveFarmData, 
  generateDataForRange,
  getAllCombinedRecommendations 
} from './dashboardUtils';
import { useLatestSensors, useDashboard } from '../../hooks/useWarifData';

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

export function DashboardHome({ onGo, onSendAI, globalAutoMode, onOpenAssets, activeFarm, sharedSensors }) {

  // ── Live data from Backend API ─────────────────────────────
  const farmId = JSON.parse(localStorage.getItem('warif_user') || '{}').farmId || 1;
  const { data: localSensors } = useLatestSensors(10000);
  const { data: dashboardData } = useDashboard(farmId);

  const livesensors = sharedSensors || localSensors;

  const apiTemp      = livesensors?.air_temperature  ?? null;
  const apiHum       = livesensors?.air_humidity     ?? null;
  const apiSoilMoist = livesensors?.soil_moisture    ?? null;
  const apiSoilTemp  = livesensors?.soil_temperature ?? null;
  const [seconds, setSeconds] = useState(0);

  const [resourceRange, setResourceRange] = useState("D");

  useEffect(() => {
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeFarm]);

  const resourceData = useMemo(() => {
    const raw = generateDataForRange(resourceRange, { 
      base: 45, amp: 15, noise: 10, min: 10, max: 90, seed: 88, farmIndex: activeFarm
    });
    return raw.map((pt, i) => ({
      ...pt,
      water: pt.value,
      power: Math.max(10, Math.min(95, pt.value * (0.85 + Math.sin(i * 0.5) * 0.1)))
    }));
  }, [resourceRange, activeFarm]);

  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';

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
      <div className="w-full h-full overflow-auto px-8 py-5 min-h-0 page-enter">
      <div className="w-full max-w-[1150px] mx-auto flex flex-col gap-5">

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
          <DigitalTwinCommandCenterCard onOpenAssets={onOpenAssets} />
        </div>


        {/* Middle Section Layout */}
        <div className="flex flex-col lg:flex-row gap-5 items-stretch w-full">

          {/* Main Grid: AI Modules Overview */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 min-w-0">
            <div className="animate-fade-in-up delay-2 h-full"><MicroclimateGlanceCard onGo={onGo} seconds={seconds} activeFarm={activeFarm} apiTemp={apiTemp} apiHum={apiHum} /></div>
            <div className="animate-fade-in-up delay-3 h-full"><SoilCropHealthGlanceCard onGo={onGo} seconds={seconds} activeFarm={activeFarm} apiSoilMoist={apiSoilMoist} apiSoilTemp={apiSoilTemp} /></div>
            <div className="animate-fade-in-up delay-4 h-full"><IrrigationGlanceCard onGo={onGo} globalAutoMode={globalAutoMode} seconds={seconds} activeFarm={activeFarm} /></div>
            <div className="animate-fade-in-up delay-5 h-full"><DSSGlanceCard onGo={onGo} seconds={seconds} activeFarm={activeFarm} /></div>
          </div>

          {/* Side Column: Camera / Live Monitoring */}
          <div className="w-full lg:w-[450px] shrink-0 animate-fade-in-up delay-6 flex flex-col min-w-0 h-full">
            <CameraCard />
          </div>

        </div>


      </div>
    </div>
    </>
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
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{isEn ? 'Temp Trend (24h)' : 'ميول الحرارة (٢٤ ساعة)'}</div>
        <div className="text-[9px] font-bold px-1.5 rounded-md" style={{ color: color, backgroundColor: `${color}10` }}>{isEn ? 'Peak' : 'الأعلى'}: ٣٤°C</div>
      </div>
      <div className="relative w-32 h-16 bg-gray-50/30 rounded-xl overflow-hidden border border-gray-100/50 flex items-center">
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
    </div>
  );
}

function SoilSparkline({ color = "#10b981", gradientId = "soilGradient" }) {
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  return (
    <div className="flex flex-col gap-1.5 h-full justify-center">
      <div className="flex items-center justify-between opacity-70">
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{isEn ? 'Moisture Trend (24h)' : 'اتجاه الرطوبة (٢٤ ساعة)'}</div>
        <div className="text-[9px] font-bold px-1.5 rounded-md" style={{ color: color, backgroundColor: `${color}15` }}>{isEn ? 'Peak' : 'الأعلى'}: ٤٨٪</div>
      </div>
      
      <div className="relative w-32 h-16 bg-gray-50/30 rounded-xl overflow-hidden border border-gray-100/50 flex items-center">
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

      <div className={`flex items-center justify-between px-1 ${isEn ? 'flex-row-reverse' : ''}`}>
        <span className="text-[9px] font-bold text-gray-400">{isEn ? 'Stable Trend' : 'تحليل الميول مستقر'}</span>
        <span className="text-[9px] font-black text-gray-300">{isEn ? 'Low' : 'الأقل'}: ٣٢٪</span>
      </div>
    </div>
  );
}

function MicroclimateGlanceCard({ onGo, seconds, activeFarm, apiTemp, apiHum }) {
  const mockData = getLiveFarmData(activeFarm);
  const temp = apiTemp ?? mockData.temp;
  const hum  = apiHum  ?? mockData.hum;
  const isOptimal = temp < 32 && hum < 65;
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');

  return (
    <CardShell className="p-6 h-full cursor-pointer card-interactive group flex flex-col justify-between" onClick={() => onGo("microclimate")}>
      <div className="animate-fade-in delay-1">
      <CardTopRow 
        title={isEn ? "Climate & Ventilation" : "المناخ والتهوية"} 
        subtitle={formatLastUpdated(seconds)} 
        icon={<WindSharedIcon />} 
        isEn={isEn}
        iconBg="bg-emerald-50"
        iconColor="text-[#059669]"
      />

      <div className={`mt-4 flex items-end justify-between gap-2 ${isEn ? 'flex-row-reverse' : ''}`}>
        <div className={`flex flex-col gap-4 ${isEn ? 'items-end text-right' : 'items-start text-right'}`}>
          <div className="flex flex-col">
            <div className="text-[12px] text-gray-400 font-bold uppercase mb-0.5 tracking-tight">{isEn ? 'Temperature' : 'درجة الحرارة'}</div>
            <div className={`text-[26px] font-black text-gray-800 leading-none ${isEn ? 'flex flex-row-reverse items-baseline justify-end' : ''}`}>
              {temp.toFixed(1)}<span className="text-[14px] font-bold text-gray-400 mx-1.5">°C</span>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="text-[12px] text-gray-400 font-bold uppercase mb-0.5 tracking-tight">{isEn ? 'Air Humidity' : 'رطوبة الجو'}</div>
            <div className={`text-[26px] font-black text-gray-800 leading-none ${isEn ? 'flex flex-row-reverse items-baseline justify-end' : ''}`}>
              {hum.toFixed(0)}<span className="text-[14px] font-bold text-gray-400 mx-1.5">%</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
           <div className={`px-3 py-2 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm min-w-[70px] border ${isOptimal ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
              <div className={`text-[10px] font-bold mb-0.5 ${isOptimal ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}`}>{isEn ? 'Status' : 'الوضع'}</div>
              <div className={`text-[13px] font-black ${isOptimal ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}`}>{isOptimal ? (isEn ? 'Optimal' : 'مثالي') : (isEn ? 'Alert' : 'تنبيه')}</div>
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

function SoilCropHealthGlanceCard({ onGo, seconds, activeFarm, apiSoilMoist, apiSoilTemp }) {
  const mockData = getLiveFarmData(activeFarm);
  const soilMoist = apiSoilMoist ?? mockData.soilMoist;
  const soilTemp  = apiSoilTemp  ?? mockData.soilTemp;
  const isHealthy = soilMoist > 30 && soilMoist < 55;
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');

  return (
    <CardShell className="p-6 h-full cursor-pointer card-interactive group flex flex-col justify-between" onClick={() => onGo("soil")}>
      <div className="animate-fade-in delay-2">
      <CardTopRow 
        title={isEn ? "Soil & Crop Health" : "بيئة وصحة التربة"} 
        subtitle={formatLastUpdated(seconds)} 
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
              <div className={`text-[10px] font-bold mb-0.5 ${isHealthy ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}`}>{isEn ? 'Status' : 'الوضع'}</div>
              <div className={`text-[13px] font-black ${isHealthy ? 'text-[var(--status-success)]' : 'text-[var(--status-warning)]'}`}>{isHealthy ? (isEn ? 'Healthy' : 'سليم') : (isEn ? 'Warning' : 'تنبيه')}</div>
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

function IrrigationGlanceCard({ onGo, globalAutoMode, seconds, activeFarm }) {
  const data = getLiveFarmData(activeFarm);
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  return (
    <CardShell className="p-6 h-full cursor-pointer card-interactive group relative overflow-hidden flex flex-col justify-between" onClick={() => onGo("irrigation")}>
      <div className="animate-fade-in delay-3">
        <CardTopRow 
          title={isEn ? "Irrigation Management" : "إدارة الري"} 
          subtitle={formatLastUpdated(seconds)} 
          icon={<IrrigationSmartIcon />} 
          isEn={isEn}
          iconBg="bg-emerald-50"
          iconColor="text-[#059669]"
        />

        <div className="mt-5 flex items-end justify-between gap-2">
          <div className="flex flex-col gap-3">
            <div className={`text-[10px] font-black px-2.5 py-1 rounded-lg w-max mb-3 shadow-sm flex items-center gap-1.5 border ${data.flowRate > 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-100/50' : 'text-gray-500 bg-gray-50 border-gray-100'}`}>
              <span className="relative flex h-1.5 w-1.5 ">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${data.flowRate > 0 ? 'bg-emerald-400' : 'bg-gray-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${data.flowRate > 0 ? 'bg-emerald-600' : 'bg-gray-600'}`}></span>
              </span>
              {isEn ? 'System Active' : 'النظام نشط'}
            </div>
            
            <div className="flex flex-col">
              <div className="text-[11px] text-gray-400 font-bold uppercase mb-0.5 tracking-tight font-black">{isEn ? 'Daily Consumption' : 'الاستهلاك اليومي'}</div>
              <div className="text-3xl font-black text-gray-800 tracking-tight">
                {data.waterUsage} <span className="text-[13px] font-bold text-gray-400 mx-1 tracking-normal">{isEn ? 'L' : 'لتر'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="7" fill="transparent" className="text-gray-100/50" />
                <circle
                  cx="50" cy="50" r="42" stroke={`url(#glanceFlowGrad-${Math.round(data.flowRate)})`} strokeWidth="7"
                  strokeDasharray={264} strokeDashoffset={264 - (264 * Math.round(data.flowRate)) / 100}
                  strokeLinecap="round" fill="transparent" className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id={`glanceFlowGrad-${Math.round(data.flowRate)}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={data.flowRate >= 80 ? "#10b981" : data.flowRate >= 40 ? "#f59e0b" : "#ef4444"} />
                    <stop offset="100%" stopColor={data.flowRate >= 80 ? "#3b82f6" : data.flowRate >= 40 ? "#fbbf24" : "#f87171"} />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className={`text-[18px] font-black tracking-tighter ${data.flowRate >= 80 ? 'text-emerald-600' : data.flowRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  {Math.round(data.flowRate)}%
                </span>
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{isEn ? "Flow" : "تدفق"}</span>
              </div>
            </div>

            {/* Restored Resource Bars with Premium Styling */}
            <div className="flex flex-col gap-2 w-full min-w-[110px] bg-gray-50/50 p-2 rounded-xl border border-gray-100/50">
               <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100/50">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                  </div>
                  <div className="flex-1 h-1 bg-gray-200/30 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '70%' }} />
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100/50">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  </div>
                  <div className="flex-1 h-1 bg-gray-200/30 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '45%' }} />
                  </div>
               </div>
            </div>
          </div>
        </div>

        {globalAutoMode && (
          <div className="bg-emerald-500 text-white rounded-xl py-2 px-4 mt-4 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(16,185,129,0.2)]">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-[13px] font-black uppercase tracking-wider">{isEn ? 'Automatic Control Active' : 'التحكم التلقائي نشط'}</span>
          </div>
        )}
      </div>
    </CardShell>
  );
}

function DSSGlanceCard({ onGo, seconds, activeFarm }) {
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  
  // Use shared recommendations logic
  const decisions = getAllCombinedRecommendations(activeFarm, isEn).slice(0, 2);

  const T_Analysis = isEn ? "AI Analysis" : "تحليل ذكي";
  const T_Reason = isEn ? "Reason:" : "السبب:";
  const T_Subtitle = isEn ? "Suggested actions to maintain environmental stability" : "إجراءات مقترحة للحفاظ على استقرار المحيط";

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

      <div className="flex-1 flex flex-col gap-6 mt-2">
        {decisions.map((item, idx) => (
          <div key={idx} className="flex gap-4">
            {/* Green dot indicator */}
            <div className="flex-shrink-0 mt-2">
               <div className="w-2.5 h-2.5 rounded-full bg-[var(--status-success)] shadow-[0_0_8px_rgba(18,183,106,0.4)]" />
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <div className="text-[14.5px] font-black text-gray-800 leading-tight">
                {item.title}
              </div>
              <div className="border-r-2 border-emerald-500/20 pr-3 py-1 flex flex-col gap-1">
                <div className="text-[12px] text-gray-400 leading-relaxed font-bold">
                   <span className="text-emerald-600 font-extrabold ml-1">{T_Reason}</span>
                   {item.reasoning}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-3 flex items-center justify-between border-t border-gray-50">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{isEn ? 'Infer Engine Active' : 'محرك الاستدلال نشط'}</div>
        <div className="flex items-center gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
           <span className="text-[10px] font-black text-emerald-600 tracking-wide">{formatLastUpdated(seconds, "", "")}</span>
        </div>
      </div>
    </CardShell>
  );
}

function DigitalTwinCommandCenterCard({ onOpenAssets }) {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';

  return (
    <CardShell className="p-6 lg:p-7 relative overflow-hidden bg-white border border-gray-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.01)] group/main card-interactive">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-10 relative z-10 w-full items-center">
        
        <div className="w-full lg:w-[45%] flex flex-col justify-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 text-[11px] font-black text-emerald-700 mb-3 w-max">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {isEn ? 'Digital Twin Engine' : 'محرك التوأم الرقمي'}
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
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{label}</div>
    </div>
  );
}
