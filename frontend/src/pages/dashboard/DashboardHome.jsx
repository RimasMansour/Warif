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
  getRecommendationTheme,
  RecommendationCard,
  AlertCard
} from './DashboardShared';
import {
  formatLastUpdated,
  generateDataForRange,
  getLabelForRange
} from './dashboardUtils';
import { useLatestSensors, useDashboard, useSensorHistory, useRecommendations, useDevices, useIrrigationResources, submitRecommendationFeedback, executeRecommendation, submitAlertFeedback } from '../../hooks/useWarifData';

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
          <DigitalTwinCommandCenterCard onOpenAssets={onOpenAssets} alertsCount={alerts.length} counts={counts} />
        </div>


        {/* Perfectly Aligned 3-Column Layout: Uniform Row Heights & Custom Column Widths */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.12fr] gap-4 lg:gap-5 w-full">

          {/* Row 1: Top Aligned Cards - Compact Fixed Height */}
          <div className="animate-fade-in-up delay-2">
            <MicroclimateGlanceCard onGo={onGo} activeFarm={activeFarm} apiTemp={apiTemp} apiHum={apiHum} apiLight={apiLight} coolingActive={coolingActive} />
          </div>
          <div className="animate-fade-in-up delay-3">
            <SoilCropHealthGlanceCard onGo={onGo} activeFarm={activeFarm} apiSoilMoist={apiSoilMoist} apiSoilTemp={apiSoilTemp} crops={crops} />
          </div>
          <div className="animate-fade-in-up delay-4 flex flex-col row-span-2">
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
              activeFarm={activeFarm}
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

  // Map sensor types to categories
  const getSensorCategory = (sensorType) => {
    if (!sensorType) return 'irrigation';
    const s = sensorType.toLowerCase();
    if (s.includes('temperature') || s.includes('temp')) return 'temperature';
    if (s.includes('humidity') || s.includes('humid')) return 'humidity';
    if (s.includes('soil') || s.includes('moisture')) return 'soil';
    if (s.includes('water') || s.includes('irrigation') || s.includes('pump')) return 'irrigation';
    return 'irrigation';
  };

  // Generate descriptive analysis with consequences
  const getAlertAnalysis = (alert, category) => {
    const currentValue = alert.actual_value;
    const threshold = alert.threshold;
    const isExceeding = currentValue > threshold;

    const analysisMap = {
      temperature: () => {
        if (isExceeding) {
          return isEn
            ? `Temperature exceeds optimal threshold (${threshold}°C). Current: ${currentValue}°C. High temperatures may cause heat stress to crops, reduce crop quality, increase water consumption, and accelerate plant maturation.`
            : `درجة الحرارة تتجاوز الحد الأمثل (${threshold}°م). القيمة الحالية: ${currentValue}°م. قد تؤدي الحرارة المرتفعة إلى إجهاد حراري للمحاصيل وتقليل الجودة وزيادة استهلاك المياه وتسريع النضج.`;
        } else {
          return isEn
            ? `Temperature is below optimal threshold (${threshold}°C). Current: ${currentValue}°C. Low temperatures slow crop growth, reduce metabolic activity, and increase vulnerability to diseases.`
            : `درجة الحرارة أقل من الحد الأمثل (${threshold}°م). القيمة الحالية: ${currentValue}°م. قد تؤدي الحرارة المنخفضة إلى إبطاء نمو المحاصيل وتقليل النشاط الأيضي وزيادة عرضة الإصابة بالأمراض.`;
        }
      },
      humidity: () => {
        if (isExceeding) {
          return isEn
            ? `Humidity exceeds optimal level (${threshold}%). Current: ${currentValue}%. High humidity increases risk of fungal diseases, reduces nutrient absorption, and creates condensation that promotes pathogen growth.`
            : `الرطوبة تتجاوز المستوى الأمثل (${threshold}%). القيمة الحالية: ${currentValue}%. قد ترفع الرطوبة المرتفعة من خطر الأمراض الفطرية وتقلل امتصاص العناصر الغذائية وتعزز نمو الممرضات.`;
        } else {
          return isEn
            ? `Humidity is below optimal level (${threshold}%). Current: ${currentValue}%. Low humidity causes water stress, increases transpiration, slows growth, and makes plants more susceptible to pests.`
            : `الرطوبة أقل من المستوى الأمثل (${threshold}%). القيمة الحالية: ${currentValue}%. قد تسبب الرطوبة المنخفضة إجهاد مائي وزيادة النتح وإبطاء النمو وزيادة عرضة الآفات.`;
        }
      },
      soil: () => {
        if (isExceeding) {
          return isEn
            ? `Soil moisture exceeds optimal level (${threshold}%). Current: ${currentValue}%. Excess moisture causes root rot, reduces oxygen availability, promotes fungal diseases, and impairs nutrient absorption.`
            : `رطوبة التربة تتجاوز المستوى الأمثل (${threshold}%). القيمة الحالية: ${currentValue}%. قد يسبب الإفراط في الرطوبة تعفن الجذور وتقليل توفر الأكسجين وتعزيز الأمراض الفطرية وضعف امتصاص العناصر الغذائية.`;
        } else {
          return isEn
            ? `Soil moisture is below optimal level (${threshold}%). Current: ${currentValue}%. Low soil moisture causes water stress, reduces nutrient availability, slows crop development, and increases vulnerability to drought.`
            : `رطوبة التربة أقل من المستوى الأمثل (${threshold}%). القيمة الحالية: ${currentValue}%. قد تسبب الرطوبة المنخفضة إجهاد مائي وتقليل توفر العناصر الغذائية وإبطاء التطور وزيادة عرضة الجفاف.`;
        }
      },
      irrigation: () => {
        return isEn
          ? `Water usage requires attention. Current: ${currentValue} units. Proper irrigation ensures optimal crop health and resource efficiency.`
          : `استهلاك المياه يتطلب انتباهاً. القيمة الحالية: ${currentValue} وحدة. يضمن الري المناسب صحة المحصول المثلى وكفاءة الموارد.`;
      }
    };

    return (analysisMap[category] || analysisMap.irrigation)();
  };

  // Generate mode-aware action
  const getAlertAction = (alert, category, isAutoMode) => {
    const actionMap = {
      temperature: () => {
        const isExceeding = alert.actual_value > alert.threshold;
        if (isAutoMode) {
          return isExceeding
            ? isEn
              ? 'The system will increase ventilation rate and activate cooling mechanisms to bring temperature within optimal range.'
              : 'سيقوم النظام بزيادة معدل التهوية وتفعيل آليات التبريد لإعادة درجة الحرارة إلى النطاق الأمثل.'
            : isEn
              ? 'The system will reduce ventilation and adjust heating if needed to maintain optimal temperature.'
              : 'سيقوم النظام بتقليل التهوية وتعديل التدفئة إذا لزم الأمر للحفاظ على درجة حرارة مثلى.';
        } else {
          return isExceeding
            ? isEn
              ? 'Increase ventilation rate and activate cooling systems to bring temperature within optimal range (18-27°C).'
              : 'قم بزيادة معدل التهوية وتفعيل نظم التبريد لإعادة درجة الحرارة إلى النطاق الأمثل (18-27°م).'
            : isEn
              ? 'Reduce ventilation and activate heating if needed to maintain optimal temperature range.'
              : 'قلل التهوية وفعّل التدفئة إذا لزم الأمر للحفاظ على النطاق الأمثل للحرارة.';
        }
      },
      humidity: () => {
        const isExceeding = alert.actual_value > alert.threshold;
        if (isAutoMode) {
          return isExceeding
            ? isEn
              ? 'The system will increase air circulation and ventilation to reduce humidity levels.'
              : 'سيقوم النظام بزيادة الدوران الهوائي والتهوية لتقليل مستويات الرطوبة.'
            : isEn
              ? 'The system will reduce ventilation and activate humidification if available.'
              : 'سيقوم النظام بتقليل التهوية وتفعيل الترطيب إذا كان متاحاً.';
        } else {
          return isExceeding
            ? isEn
              ? 'Increase air circulation and ventilation to reduce humidity below optimal level (60-75%).'
              : 'قم بزيادة الدوران الهوائي والتهوية لتقليل الرطوبة تحت المستوى الأمثل (60-75%).'
            : isEn
              ? 'Reduce ventilation and activate misting systems if available to maintain humidity.'
              : 'قلل التهوية وفعّل نظم الرش إذا كانت متاحة للحفاظ على الرطوبة.';
        }
      },
      soil: () => {
        const isExceeding = alert.actual_value > alert.threshold;
        if (isAutoMode) {
          return isExceeding
            ? isEn
              ? 'The system will suspend irrigation and increase drainage to reduce soil moisture.'
              : 'سيقوم النظام بإيقاف الري وزيادة الصرف لتقليل رطوبة التربة.'
            : isEn
              ? 'The system will activate irrigation to restore soil moisture to optimal level.'
              : 'سيقوم النظام بتفعيل الري لاستعادة رطوبة التربة إلى المستوى الأمثل.';
        } else {
          return isExceeding
            ? isEn
              ? 'Suspend irrigation and increase drainage to reduce soil moisture to optimal level (35-50%).'
              : 'قم بإيقاف الري وزيادة الصرف لتقليل رطوبة التربة إلى المستوى الأمثل (35-50%).'
            : isEn
              ? 'Activate irrigation to restore soil moisture to optimal level.'
              : 'قم بتفعيل الري لاستعادة رطوبة التربة إلى المستوى الأمثل.';
        }
      },
      irrigation: () => {
        if (isAutoMode) {
          return isEn
            ? 'The system will adjust irrigation schedule to maintain water efficiency.'
            : 'سيقوم النظام بتعديل جدول الري للحفاظ على كفاءة المياه.';
        } else {
          return isEn
            ? 'Review and adjust irrigation settings to optimize water usage.'
            : 'قم بمراجعة وتعديل إعدادات الري لتحسين استخدام المياه.';
        }
      }
    };

    return (actionMap[category] || actionMap.irrigation)();
  };

  // استخدم نفس الأيقونات والألوان من التوصيات
  const getAlertTheme = (category, severity) => {
    const isUrgent = severity === 'high' || severity === 'critical';

    // احصل على الـ theme من التوصيات
    const recommendationTheme = getRecommendationTheme(category);

    return {
      ...recommendationTheme,
      bg: isUrgent ?
        (category === 'irrigation' ? 'bg-blue-50/30' :
         category === 'temperature' ? 'bg-amber-50/30' :
         category === 'humidity' ? 'bg-slate-50/30' : 'bg-amber-50/40')
        : recommendationTheme.bg,
      text: isUrgent ?
        (category === 'irrigation' ? 'text-blue-800' :
         category === 'temperature' ? 'text-amber-800' :
         category === 'humidity' ? 'text-slate-800' : 'text-amber-900')
        : recommendationTheme.text,
      actionText: isUrgent ?
        (category === 'irrigation' ? 'text-blue-700' :
         category === 'temperature' ? 'text-amber-700' :
         category === 'humidity' ? 'text-slate-700' : 'text-amber-800')
        : recommendationTheme.actionText,
      actionBg: isUrgent ?
        (category === 'irrigation' ? 'bg-blue-50/40' :
         category === 'temperature' ? 'bg-amber-50/40' :
         category === 'humidity' ? 'bg-slate-50/40' : 'bg-amber-50/50')
        : recommendationTheme.actionBg
    };
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
        title={isEn ? "System Alerts" : "تنبيهات النظام اللحظية"}
        subtitle={
          alerts.length > 0
            ? `${alerts.length} ${isEn ? 'Active' : 'نشطة'}`
            : isEn ? "System Stable" : "النظام مستقر تماماً"
        }
      />
      <div className="flex-1 mt-4 overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-4">
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
              <AlertCard key={alert.id || i} alert={alert} isEn={isEn} globalAutoMode={globalAutoMode} onAccept={onAccept} onFeedback={handleAlertFeedback} feedbackState={alertFeedback} showThanks={showAlertThanks} />
            ))}
          </>
        )}
      </div>
    </CardShell>
  );
}

function AlertItem({ onGo, alert, isEn, getAlertTheme, getSensorCategory, getAlertAnalysis, getAlertAction, onFeedback, globalAutoMode, alertFeedback, showAlertThanks, onAccept }) {
  const isRtl = !isEn;
  const isManualMode = !globalAutoMode;

  const category =
    alert.sensor_type?.includes('temperature') ||
    alert.sensor_type?.includes('humidity') ? 'climate' :
    alert.sensor_type?.includes('soil') ? 'soil' :
    alert.sensor_type?.includes('water') ||
    alert.sensor_type?.includes('irrigation') ? 'irrigation' : 'system';

  const actionType =
    category === 'climate' ? 'cool' :
    category === 'irrigation' ? 'irrigate' : 'irrigate';

  const categoryLabel = isEn
    ? (category === 'climate' ? 'Climate & Ventilation' :
       category === 'soil'    ? 'Soil Health' :
       category === 'irrigation' ? 'Irrigation' : 'System')
    : (category === 'climate' ? 'المناخ والتهوية' :
       category === 'soil'    ? 'صحة التربة' :
       category === 'irrigation' ? 'الري' : 'النظام');

  const severityColor =
    alert.severity === 'critical' || alert.severity === 'high'
      ? 'bg-red-50 text-red-700 border-red-200' :
    alert.severity === 'warning'  
      ? 'bg-amber-50 text-amber-700 border-amber-200' :
      'bg-blue-50 text-blue-700 border-blue-200';

  const severityLabel = isEn
    ? (alert.severity === 'critical' || alert.severity === 'high' ? 'Critical' :
       alert.severity === 'warning'  ? 'Warning' : 'Info')
    : (alert.severity === 'critical' || alert.severity === 'high' ? 'حرج' :
       alert.severity === 'warning'  ? 'تحذير' : 'معلومة');

  return (
    <div className={`flex flex-col gap-0 bg-white rounded-2xl border overflow-hidden
      ${alert.severity === 'critical' ? 'border-red-200' :
        alert.severity === 'warning' ? 'border-amber-200' : 'border-blue-200'}`}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border
          ${alert.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
            alert.severity === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-blue-50 text-blue-700 border-blue-200'}`}>
          {alert.severity === 'critical' ? (isEn ? 'Critical' : 'حرج') :
           alert.severity === 'warning' ? (isEn ? 'Warning' : 'تحذير') :
           (isEn ? 'Info' : 'معلومة')}
        </span>
        <span className="text-sm font-black text-gray-700">{categoryLabel}</span>
      </div>

      {/* Message */}
      <div className="px-4 pb-3">
        <p className={`text-sm font-bold text-gray-800 leading-relaxed
          ${isRtl ? 'text-right' : 'text-left'}`}>
          {alert.message || alert.description || 
            (isEn ? 'System alert detected' : 'تم رصد تنبيه من النظام')}
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 mx-0" />

      {/* Action row */}
      <div className={`flex items-center justify-between px-4 py-2.5
        ${isRtl ? 'flex-row-reverse' : ''}`}>
        
        {/* Rating - LEFT side */}
        <div className="flex items-center gap-2">
          <button onClick={() => alert.onRate?.('up')}
            className="w-7 h-7 rounded-xl bg-gray-50 border border-gray-200
              flex items-center justify-center hover:bg-emerald-50
              hover:border-emerald-200 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
          </button>
          <button onClick={() => alert.onRate?.('down')}
            className="w-7 h-7 rounded-xl bg-gray-50 border border-gray-200
              flex items-center justify-center hover:bg-red-50
              hover:border-red-200 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
              <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
            </svg>
          </button>
          <span className="text-[11px] text-gray-400 font-bold">
            {isEn ? 'Helpful?' : 'مناسب؟'}
          </span>
        </div>

        {/* Auto action - RIGHT side */}
        {isManualMode ? (
          <div className="flex gap-2">
            <button onClick={() => alert.onConfirm?.()}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white
                font-black text-xs hover:bg-emerald-700 transition-colors">
              {isEn ? 'Confirm' : 'تأكيد'}
            </button>
            <button onClick={() => alert.onIgnore?.()}
              className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-500
                font-black text-xs hover:bg-gray-200 transition-colors">
              {isEn ? 'Ignore' : 'تجاهل'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
            bg-emerald-50 border border-emerald-200">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black text-emerald-700">
              {(() => {
                if (category === 'climate') {
                  return isEn ? "Fans & Ventilation Activated Automatically" : "تم تشغيل المروحة والتهوية تلقائياً";
                }
                if (category === 'irrigation') {
                  return isEn ? "Irrigation Pump Activated Automatically" : "تم تشغيل مضخة الري تلقائياً";
                }
                if (category === 'soil') {
                  return isEn ? "Soil Environment Adjusted Automatically" : "تم ضبط بيئة التربة تلقائياً";
                }
                return isEn ? "Auto executed" : "تم التنفيذ تلقائياً";
              })()}
            </span>
          </div>
        )}
      </div>

      {/* Timestamp */}
      {(alert.created_at || alert.timestamp) && (
        <div className={`px-4 pb-2 text-[10px] text-gray-300 font-bold
          ${isRtl ? 'text-right' : 'text-left'}`}>
          {(() => {
            const date = new Date(alert.created_at || alert.timestamp);
            const diffMs = Date.now() - date.getTime();
            const diffMin = Math.floor(diffMs / 60000);
            const diffHr = Math.floor(diffMin / 60);
            if (diffMin < 1) return isEn ? 'Just now' : 'الآن';
            if (diffMin < 60) return isEn ? `${diffMin} min ago` : `منذ ${diffMin} دقيقة`;
            if (diffHr < 24) return isEn ? `${diffHr}h ago` : `منذ ${diffHr} ساعة`;
            return date.toLocaleTimeString(isEn ? 'en' : 'ar-SA', 
              { hour: '2-digit', minute: '2-digit' });
          })()}
        </div>
      )}
    </div>
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

function SoilCropHealthGlanceCard({ onGo, activeFarm, apiSoilMoist, apiSoilTemp, crops = [] }) {
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

      <div className={`mt-4 flex items-end justify-between gap-4 ${isEn ? 'flex-row-reverse' : ''}`}>
        <div className={`flex flex-col gap-5 ${isEn ? 'items-end text-right' : 'items-start text-right'}`}>
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

      {/* Modern Multi-Crop Display Section */}
      {crops.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-gray-100/60 flex flex-col gap-2">
           <div className={`text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 ${isEn ? 'flex-row-reverse' : ''}`}>
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
             {isEn ? 'Monitored Crops' : 'المحاصيل المراقبة'}
           </div>
           <div className={`flex flex-wrap gap-2 ${isEn ? 'flex-row-reverse' : ''}`}>
              {crops.slice(0, 4).map((crop, idx) => (
                <div key={crop + idx} className="group/crop flex items-center gap-2 px-2.5 py-1.5 bg-gray-50/80 hover:bg-emerald-50 rounded-xl border border-gray-100/50 hover:border-emerald-100/50 transition-all duration-300">
                   <span className="text-lg filter group-hover/crop:drop-shadow-sm transition-all">{getCropIcon(crop)}</span>
                   <span className="text-[12px] font-black text-gray-700 group-hover/crop:text-emerald-800 transition-colors">{getCropName(crop, isEn)}</span>
                </div>
              ))}
              {crops.length > 4 && (
                <div className="flex items-center justify-center px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] font-black text-emerald-700">
                  +{crops.length - 4}
                </div>
              )}
           </div>
        </div>
      )}
      </div>
    </CardShell>
  );
}

function IrrigationGlanceCard({ onGo, globalAutoMode, activeFarm, dashboardData, water, power }) {
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  
  const waterPercent = dashboardData?.water_tank_level || 0;
  const energyKwh = power || 0;
  const irrigationData = dashboardData;

  return (
    <CardShell className="p-4 md:p-5 h-full cursor-pointer card-interactive group relative overflow-hidden flex flex-col justify-between" onClick={() => onGo("irrigation")} dir={isEn ? "ltr" : "rtl"}>
      <div className="animate-fade-in delay-3 flex flex-col gap-4 h-full">
        <CardTopRow 
          title={isEn ? "Irrigation Management" : "إدارة الري"} 
          subtitle={<LastUpdatedTimer seconds={0} ar="آخر تحديث" en="Last Update" isEn={isEn} />} 
          icon={<IrrigationSmartIcon />} 
          isEn={isEn}
          iconBg="bg-emerald-50"
          iconColor="text-[#059669]"
        />

        {/* Pump Status */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${isEn ? '' : 'flex-row-reverse'}
          ${dashboardData?.irrigation_status === "active"
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-gray-50 border border-gray-200'}`}>
          <div className={`flex items-center gap-2 ${isEn ? '' : 'flex-row-reverse'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${dashboardData?.irrigation_status === "active" ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className={`text-xs font-bold ${dashboardData?.irrigation_status === "active" ? 'text-emerald-600' : 'text-gray-400'}`}>
              {dashboardData?.irrigation_status === "active" ? (isEn ? 'Active' : 'نشطة') : (isEn ? 'Standby' : 'استعداد')}
            </span>
          </div>
          <span className={`text-sm font-black ${dashboardData?.irrigation_status === "active" ? 'text-emerald-700' : 'text-gray-500'}`}>
            {dashboardData?.irrigation_status === "active"
              ? (isEn ? 'Pump is running' : 'المضخة تعمل')
              : (isEn ? 'Pump is off' : 'المضخة مغلقة')}
          </span>
        </div>

        {/* Water Circle */}
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="relative w-36 h-36">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10"/>
              <circle cx="60" cy="60" r="50" fill="none"
                stroke="#3b82f6" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${Math.min((water / 1000) * 314, 314)} 314`}/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-gray-800 leading-none">{Math.round(water)}</span>
              <span className="text-[11px] font-bold text-gray-400 mt-0.5">{isEn ? 'L today' : 'لتر اليوم'}</span>
            </div>
          </div>

          {/* Water change vs yesterday */}
          {irrigationData?.water_change_pct !== undefined && (
            <div className={`mt-2 text-xs font-black flex items-center gap-1
              ${isEn ? '' : 'flex-row-reverse'}
              ${irrigationData.water_change_pct < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                {irrigationData.water_change_pct < 0
                  ? <polyline points="18 15 12 9 6 15"/>
                  : <polyline points="6 9 12 15 18 9"/>}
              </svg>
              {Math.abs(Math.round(irrigationData.water_change_pct))}% {isEn ? 'vs yesterday' : 'من أمس'}
            </div>
          )}
        </div>

        {/* Electricity row - RIGHT side label, LEFT side percentage */}
        <div className={`flex items-center gap-3 px-1 ${isEn ? 'justify-between' : 'justify-end'}`} dir="ltr">
          {(irrigationData?.energy_change_pct || 0) !== 0 && (
            <span className={`text-xs font-black
              ${(irrigationData?.energy_change_pct || 0) < 0 ? 'text-emerald-600' : 'text-amber-500'}`}>
              {(irrigationData?.energy_change_pct || 0) < 0 ? '↓' : '↑'}
              {Math.abs(Math.round(irrigationData?.energy_change_pct || 0))}%
            </span>
          )}
          <div className={`flex items-center gap-2 ${isEn ? '' : 'flex-row-reverse'}`}>
            <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <span className="text-xs text-gray-500 font-bold">{isEn ? 'Energy' : 'الكهرباء'}</span>
            <span className="text-sm font-black text-gray-700">
              {energyKwh < 1 ? (energyKwh * 1000).toFixed(1) : energyKwh.toFixed(1)}
            </span>
            <span className={`text-[10px] font-bold text-gray-400 ${isEn ? '' : 'order-last'}`}>
              {energyKwh < 1 ? (isEn ? 'Wh' : 'واط ساعي') : (isEn ? 'kWh' : 'كيلو واط')}
            </span>
          </div>
        </div>
        <div className="hidden">
          {waterPercent}
          </div>
      </div>
    </CardShell>
  );
}

function DSSGlanceCard({ onGo, globalAutoMode, activeFarm, farmId }) {
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  const isRtl = !isEn;
  const [interactedIds, setInteractedIds] = useState({});
  const [feedback, setFeedback] = useState({});
  const [showThanksIds, setShowThanksIds] = useState([]);
  const [recommendationStatus, setRecommendationStatus] = useState({});

  const handleFeedback = async (id, type) => {
    // تحديث الواجهة المحلية فوراً
    setFeedback(prev => ({ ...prev, [id]: type }));
    setShowThanksIds(prev => [...prev, id]);
    setTimeout(() => setShowThanksIds(prev => prev.filter(i => i !== id)), 2000);

    // إرسال الفيدباك إلى الـ Backend للتعلم المستمر
    const helpful = type === 'up';
    await submitRecommendationFeedback(farmId, id, helpful);
  };

  const handleRecommendationDecision = (id, decision) => {
    setRecommendationStatus(prev => ({ ...prev, [id]: decision }));
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
  })) : [];

  const getRecSubject = (type) => {
    switch (type) {
      case 'irrigation': return isEn ? 'Water efficiency' : 'تقليل الاستهلاك';
      case 'heat': return isEn ? 'Temperature risk' : 'تنظيم الحرارة';
      case 'humidity': return isEn ? 'Humidity control' : 'ضبط الرطوبة';
      case 'climate': return isEn ? 'Climate balance' : 'توازن المناخ';
      case 'soil': return isEn ? 'Soil health' : 'صحة التربة';
      default: return isEn ? 'Operational guidance' : 'توجيه المزرعة';
    }
  };

  const getRecActionText = (item) => {
    if (item.suggestion) return item.suggestion;
    switch (item.type) {
      case 'irrigation':
        return isEn
          ? 'Adjust irrigation settings to conserve water without affecting crop health.'
          : 'اضبط نظام الري لتوفير الماء دون التأثير على صحة المحصول.';
      case 'heat':
        return isEn
          ? 'Improve shading and ventilation to lower greenhouse temperature.'
          : 'حسّن التظليل والتهوية لخفض درجة حرارة الصوبة.';
      case 'humidity':
        return isEn
          ? 'Increase airflow and reduce humidity build-up around plants.'
          : 'زد تدفق الهواء وقلل تراكم الرطوبة حول النباتات.';
      case 'soil':
        return isEn
          ? 'Keep soil moisture steady by reducing over-irrigation.'
          : 'حافظ على رطوبة التربة عبر تقليل الإفراط في الري.';
      default:
        return isEn
          ? 'Apply the recommended adjustment and monitor results.'
          : 'طبق التعديل الموصى به ومتابعة النتائج.';
    }
  };

  const T_Subtitle = isEn ? "Data-driven actions to optimize farm performance" : "إجراءات مدروسة لتحسين أداء المزرعة";

  const handleAction = (e, idx, type) => {
    e.stopPropagation();
    setInteractedIds(prev => ({ ...prev, [idx]: type }));
  };

  return (
    <CardShell className="p-4 md:p-5 h-full cursor-pointer card-interactive group flex flex-col justify-between" onClick={() => onGo("dss")}>
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

      <div
        className={`flex-1 mt-4 overflow-y-auto max-h-[400px] flex flex-col gap-3 ${isRtl ? 'pl-2' : 'pr-2'}`}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db transparent'
        }}
      >
        <style>{`
          .scrollbar-thin::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          .scrollbar-thin::-webkit-scrollbar-track {
            background: transparent;
          }
          .scrollbar-thin::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 3px;
          }
          .scrollbar-thin::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
          }
        `}</style>

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
                severity: rec.severity || 'normal'
              }}
              farmId={farmId}
              globalAutoMode={globalAutoMode}
              isEn={isEn}
              onExecute={async (category, farmId) => {
                await executeRecommendation(category, farmId);
                handleRecommendationDecision(rec.id, 'accepted');
              }}
              onIgnore={() => handleRecommendationDecision(rec.id, 'rejected')}
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

function DigitalTwinCommandCenterCard({ onOpenAssets, alertsCount = 0, counts = {} }) {
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
              <MinimalStat value={counts.sensors || 0} label={isEn ? 'Sensors' : 'حساسات'} />
              <MinimalStat value={counts.pumps || 0} label={isEn ? 'Pumps' : 'مضخات'} />
              <MinimalStat value={counts.cooling || 0} label={isEn ? 'Cooling' : 'تبريد'} />
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
