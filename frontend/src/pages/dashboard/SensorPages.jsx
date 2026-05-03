import { useMemo, useState, useEffect } from 'react';
import { translations } from '../../i18n';
import { 
  SensorTopBar, 
  CardShell, 
  PlantSoilIcon, 
  WindSharedIcon, 
  EmptyState 
} from './DashboardShared';
import { HealthStyleBarChart, IrrigationActionButton } from './DashboardCharts';

import { 
  generateDataForRange, 
  formatLastUpdated 
} from './dashboardUtils';
import { useLatestSensors, triggerManualCooling, useSensorHistory, useRecommendations } from '../../hooks/useWarifData';
import { getLabelForRange } from './dashboardUtils';

/* =========================================================
   1. Microclimate Module (المناخ والتهوية)
========================================================= */
export function MicroclimatePage({ onBack, globalAutoMode, activeFarm, sharedSensors }) {
  const [seconds, setSeconds] = useState(0);
  const [activeAction, setActiveAction] = useState("");

  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  const T = {
    title: isEn ? "Climate & Ventilation" : "المناخ والتهوية",
    subtitle: isEn ? "Smart analysis of temperature and air humidity." : "تحليل ذكي لدرجات الحرارة ورطوبة الهواء المحيط بالمحاصيل.",
    readings: isEn ? "Sensor Readings" : "قراءات الحساسات",
    temp: isEn ? "Air Temp" : "حرارة الهواء",
    hum: isEn ? "Air Hum" : "رطوبة الهواء",
    recs: isEn ? "Climate Recs" : "توصيات المناخ",
    smartAnalysis: isEn ? "Smart Analysis" : "تحليل ذكي",
    recsSub: isEn ? "Suggested actions to maintain stability." : "إجراءات مقترحة للحفاظ على استقرار المحيط",
    reason: isEn ? "Reason:" : "السبب:",
    control: isEn ? "Climate Control" : "التحكم في مناخ المزرعة",
    autoSub: isEn ? "Based on central automation status" : "يعتمد على حالة الأتمتة المركزية",
    autoActiveTitle: isEn ? "System Managed Automatically" : "النظام يدار تلقائياً الآن.",
    autoActiveSub: isEn ? "All manual control buttons are locked to maintain greenhouse stability." : "جميع أزرار التحكم اليدوي مقفلة لحفظ استقرار المحمية.",
    startCooling: isEn ? "Start Manual Cooling" : "بدء التبريد اليدوي",
    stopFans: isEn ? "Stop Fans" : "إيقاف المراوح",
    trendTitle: isEn ? "Climate Trend Analysis" : "تحليل الميول المناخية",
    trendSub: isEn ? "Tracking thermal changes for the digital twin." : "تتبع التغيرات الزمنية في الحرارة والرطوبة للتوأم الرقمي",
    climateLog: isEn ? "Microclimate Bio-Log Patterns" : "أنماط السجل الحيوي للمناخ والتهوية",
    climateLogSub: isEn ? "Historical sensor pattern discovery." : "اكتشاف الأنماط التاريخية للحساسات.",
    tempChart: isEn ? "Temperature Trend" : "مسار درجة الحرارة",
    humChart: isEn ? "Air Humidity Trend" : "مسار رطوبة الهواء",
    lightChart: isEn ? "Light Intensity Trend" : "مسار شدة الإضاءة",
    tempY: isEn ? "Temp (°C)" : "درجة الحرارة (°C)",
    humY: isEn ? "Humidity (%)" : "رطوبة الهواء (٪)",
    lightY: isEn ? "Lux" : "لوكس",
    lastUpdateAr: "آخر تحديث",
    lastUpdateEn: "Last Update",
    noRecsTitle: isEn ? "All Systems Stable" : "كافة الأنظمة مستقرة.",
    noRecsSub: isEn ? "No specific recommendations at the moment." : "لا توجد توصيات محددة حالياً.",
  };

  const handleExport = () => {
    alert(isEn ? "Exporting Microclimate Report..." : "جاري تصدير تقرير المناخ والتهوية...");
  };

  useEffect(() => {
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeFarm]);

  const [range, setRange] = useState("D");
  const { data: localSensors } = useLatestSensors(10000);
  const livesensors = sharedSensors || localSensors;
  const temp = livesensors?.air_temperature ?? 0;
  const hum  = livesensors?.air_humidity    ?? 0;
  const light = livesensors?.light_intensity ?? 0;
  const coolingActive = livesensors?.coolingActive ?? false;
  const lastUpdateLabel = formatLastUpdated(seconds, T.lastUpdateAr, T.lastUpdateEn);

  const historyLimit = range === 'D' ? 24 : range === 'W' ? 7 : range === 'M' ? 30 : 12;
  const { data: rawTemp } = useSensorHistory('air_temperature', historyLimit);
  const { data: rawHum } = useSensorHistory('air_humidity', historyLimit);
  const { data: rawLight } = useSensorHistory('light_intensity', historyLimit);

  const formatPoints = (rawData) => {
    const now = new Date();
    const daysAr = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const daysEn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const monthsEn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    if (range === 'D') {
      return Array.from({ length: 24 }, (_, i) => {
        const label = `${i}:00`;
        const item = rawData?.find(r => new Date(r.timestamp).getHours() === i);
        return { label, value: item?.value ?? 0 };
      });
    }
    if (range === 'W') {
      return Array.from({ length: 7 }, (_, i) => {
        const label = isEn ? daysEn[i] : daysAr[i];
        const item = rawData?.find(r => new Date(r.timestamp).getDay() === i);
        return { label, value: item?.value ?? 0 };
      });
    }
    if (range === 'M') {
      return Array.from({ length: 30 }, (_, i) => {
        const label = `${i + 1}`;
        const item = rawData?.find(r => new Date(r.timestamp).getDate() === i + 1);
        return { label, value: item?.value ?? 0 };
      });
    }
    if (range === 'Y') {
      return Array.from({ length: 12 }, (_, i) => {
        const label = isEn ? monthsEn[i] : monthsAr[i];
        const item = rawData?.find(r => new Date(r.timestamp).getMonth() === i);
        return { label, value: item?.value ?? 0 };
      });
    }
    return [];
  };

  const tempSeries = useMemo(() => formatPoints(rawTemp), [rawTemp, range, isEn]);
  const humSeries = useMemo(() => formatPoints(rawHum), [rawHum, range, isEn]);
  const lightSeries = useMemo(() => formatPoints(rawLight), [rawLight, range, isEn]);

  const farmId = JSON.parse(localStorage.getItem('warif_user') || '{}').farmId || 1;
  const { data: apiRecs } = useRecommendations(farmId);
  const recommendations = useMemo(() => {
    if (!apiRecs) return [];
    return apiRecs.map(r => ({
      text: r.message,
      reasoning: r.message
    }));
  }, [apiRecs]);

  return (
    <div className="w-full px-4 md:px-8 py-5 page-enter" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-[1150px] mx-auto flex flex-col gap-6">

        <SensorTopBar
          title={T.title}
          subtitle={T.subtitle}
          icon={<WindSharedIcon />}
          onBack={onBack}
          onExport={handleExport}
          T={translations[lang]}
          isRtl={isRtl}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="animate-fade-in-up delay-1 h-full">
            <CardShell className="p-5 flex flex-col gap-4 h-full card-interactive">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight leading-tight">{T.readings}</div>
                <div className="text-[12px] font-medium text-gray-400 mt-1 mb-2">{lastUpdateLabel}</div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all group">
                  <span className="text-[13px] font-bold text-gray-500 group-hover:text-gray-700">{T.temp}</span>
                  <span className="text-2xl font-black text-gray-800">{temp.toFixed(1)}°C</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all group">
                  <span className="text-[13px] font-bold text-gray-500 group-hover:text-gray-700">{T.hum}</span>
                  <span className="text-2xl font-black text-gray-800">{hum.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all group">
                  <span className="text-[13px] font-bold text-gray-500 group-hover:text-gray-700">{isEn ? 'Light Intensity' : 'شدة الإضاءة'}</span>
                  <span className="text-2xl font-black text-gray-800">{Math.round(light).toLocaleString()} <span className="text-[14px]">Lux</span></span>
                </div>
              </div>
            </CardShell>
          </div>

          <div className="animate-fade-in-up delay-2 h-full">
            <CardShell className="p-6 flex flex-col gap-4 h-full card-interactive">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight leading-tight flex items-center gap-2">
                  {T.recs} 
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-200/50 font-black tracking-tighter uppercase">{T.smartAnalysis}</span>
                </div>
                <div className="text-[12px] font-medium text-gray-400 mt-1 mb-2">{T.recsSub}</div>
              </div>
              <ul className="flex flex-col gap-5 flex-1">
                {recommendations.length > 0 ? (
                  recommendations.slice(0, 2).map((rec, i) => (
                    <li key={i} className={`flex gap-3 group/rec ${isRtl ? 'text-right' : 'text-left'}`}>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      <div className="flex flex-col gap-1.5">
                        <div className="text-[14px] font-black text-gray-800 leading-tight group-hover/rec:text-emerald-700 transition-colors uppercase tracking-tight">{rec.text}</div>
                        <div className={`text-[12px] font-medium text-gray-500 leading-relaxed ${isRtl ? 'border-r-2 pr-3 border-emerald-500/20' : 'border-l-2 pl-3 border-emerald-500/20'}`}>
                          <span className="font-black text-emerald-600 mx-1">{T.reason}</span>
                          {rec.reasoning}
                        </div>
                      </div>
                    </li>
                  ))
                ) : (
                  <EmptyState 
                    compact={true}
                    title={T.noRecsTitle}
                    subtitle={T.noRecsSub}
                  />
                )}
              </ul>
            </CardShell>
          </div>

          <div className="animate-fade-in-up delay-3 h-full">
            <CardShell className="p-6 flex flex-col gap-4 h-full card-interactive">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight leading-tight">{T.control}</div>
                <div className="text-[12px] font-medium text-gray-400 mt-1 mb-2">{T.autoSub}</div>
              </div>
              {globalAutoMode ? (
                <EmptyState 
                  compact={true}
                  variant="success"
                  title={T.autoActiveTitle}
                  subtitle={T.autoActiveSub}
                  icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="sr-only">Climate Control Actions</span>
                  <IrrigationActionButton 
                    active={activeAction === "cool" || coolingActive} onClick={() => { setActiveAction("cool"); triggerManualCooling(); }}
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20l4-4 4 4"/></svg>}
                    isRtl={isRtl}
                  >
                    {coolingActive ? (isEn ? "Cooling Active..." : "جاري التبريد...") : T.startCooling}
                  </IrrigationActionButton>
                  <IrrigationActionButton 
                    active={activeAction === "stop"} onClick={() => setActiveAction("stop")}
                    icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12L12 3C15 3 18 6 18 9S15 12 12 12Z" /><path d="M12 12L21 12C21 15 18 18 15 18S12 15 12 12Z" /><path d="M12 12L12 21C9 21 6 18 6 15S9 12 12 12Z" /><path d="M12 12L3 12C3 9 6 6 9 6S12 9 12 12Z" /></svg>}
                    isRtl={isRtl}
                  >
                    {T.stopFans}
                  </IrrigationActionButton>
                </div>
              )}
            </CardShell>
          </div>
        </div>

        <div className="animate-fade-in-up delay-4 mt-2">
          <div className={`mb-4 ${isRtl ? 'text-right' : 'text-left'}`}>
            <div className="text-xl font-black text-gray-800 tracking-tight leading-tight">{T.climateLog}</div>
            <div className="text-[12px] font-medium text-gray-400 mt-1">{T.climateLogSub}</div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HealthStyleBarChart 
              range={range} onRangeChange={setRange} data={tempSeries} 
              unit="°C" metricName={T.tempChart} color="#10b981" 
              yAxisTitle={T.tempY}
              T={translations[lang]}
              isRtl={isRtl}
            />
            <HealthStyleBarChart 
              range={range} onRangeChange={setRange} data={humSeries} 
              unit="٪" metricName={T.humChart} color="#10b981" 
              yAxisTitle={T.humY}
              T={translations[lang]}
              isRtl={isRtl}
            />
            <div className="lg:col-span-2">
              <HealthStyleBarChart 
                range={range} onRangeChange={setRange} data={lightSeries} 
                unit=" Lux" metricName={T.lightChart} color="#f59e0b" 
                yAxisTitle={T.lightY}
                T={translations[lang]}
                isRtl={isRtl}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   2. Soil Module (بيئة وصحة التربة)
========================================================= */
export function SoilRootDataPage({ onBack, globalAutoMode, activeFarm, sharedSensors }) {
  const [seconds, setSeconds] = useState(0);

  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  const T = {
    title: isEn ? "Soil & Crop Health" : "بيئة وصحة التربة",
    subtitle: isEn ? "Monitoring soil vitality, moisture, and temperature." : "مراقبة حيوية التربة وتقييم رطوبتها وحرارتها.",
    soilData: isEn ? "Soil Readings" : "قياسات التربة",
    liveSub: isEn ? "Last Update" : "آخر تحديث",
    soilTemp: isEn ? "Soil Temp" : "حرارة التربة",
    soilMoist: isEn ? "Soil Moisture" : "رطوبة التربة",
    soilRecs: isEn ? "Soil Recs" : "توصيات التربة",
    smartAnalysis: isEn ? "Smart Analysis" : "تحليل ذكي",
    reason: isEn ? "Reason:" : "السبب:",
    bioTitle: isEn ? "Soil Biological Log" : "السجل الحيوي للتربة",
    bioSub: isEn ? "Tracking changes in productivity parameters." : "رصد تغيرات المعايير المؤثرة بالإنتاجية",
    tempChart: isEn ? "Soil Temp Patterns" : "أنماط حرارة التربة",
    moistChart: isEn ? "Soil Moisture Patterns" : "أنماط رطوبة التربة المكتشفة",
    tempY: isEn ? "Soil Temp (°C)" : "حرارة التربة (°C)",
    moistY: isEn ? "Soil Moisture (%)" : "رطوبة التربة (٪)",
    lastUpdateAr: "آخر تحديث",
    lastUpdateEn: "Last Update",
    noRecsTitle: isEn ? "Soil Conditions Optimal" : "ظروف التربة مثالية.",
    noRecsSub: isEn ? "No recommendations needed right now." : "لا توجد توصيات مطلوبة حالياً.",
    autoActiveTitle: isEn ? "System Managed Automatically" : "النظام يدار تلقائياً الآن.",
    autoActiveSub: isEn ? "All manual control buttons are locked to maintain greenhouse stability." : "جميع أزرار التحكم اليدوي مقفلة لحفظ استقرار المحمية.",
  };

  const handleExport = () => {
    alert(isEn ? "Exporting Soil Vitality Report..." : "جاري تصدير تقرير حيوية التربة...");
  };

  useEffect(() => {
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeFarm]);

  const [range, setRange] = useState("D");
  const { data: localSensors2 } = useLatestSensors(10000);
  const livesensors2 = sharedSensors || localSensors2;
  const soilTemp  = livesensors2?.soil_temperature ?? 0;
  const soilMoist = livesensors2?.soil_moisture    ?? 0;
  const lastUpdateLabel = formatLastUpdated(seconds, T.lastUpdateAr, T.lastUpdateEn);

  const historyLimit = range === 'D' ? 24 : range === 'W' ? 7 : range === 'M' ? 30 : 12;
  const { data: rawSoilTemp } = useSensorHistory('soil_temperature', historyLimit);
  const { data: rawSoilMoist } = useSensorHistory('soil_moisture', historyLimit);

  const formatPoints = (rawData) => {
    const now = new Date();
    const daysAr = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const daysEn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const monthsEn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    if (range === 'D') {
      return Array.from({ length: 24 }, (_, i) => {
        const label = `${i}:00`;
        const item = rawData?.find(r => new Date(r.timestamp).getHours() === i);
        return { label, value: item?.value ?? 0 };
      });
    }
    if (range === 'W') {
      return Array.from({ length: 7 }, (_, i) => {
        const label = isEn ? daysEn[i] : daysAr[i];
        const item = rawData?.find(r => new Date(r.timestamp).getDay() === i);
        return { label, value: item?.value ?? 0 };
      });
    }
    if (range === 'M') {
      return Array.from({ length: 30 }, (_, i) => {
        const label = `${i + 1}`;
        const item = rawData?.find(r => new Date(r.timestamp).getDate() === i + 1);
        return { label, value: item?.value ?? 0 };
      });
    }
    if (range === 'Y') {
      return Array.from({ length: 12 }, (_, i) => {
        const label = isEn ? monthsEn[i] : monthsAr[i];
        const item = rawData?.find(r => new Date(r.timestamp).getMonth() === i);
        return { label, value: item?.value ?? 0 };
      });
    }
    return [];
  };

  const soilTempSeries = useMemo(() => formatPoints(rawSoilTemp), [rawSoilTemp, range, isEn]);
  const soilMoistSeries = useMemo(() => formatPoints(rawSoilMoist), [rawSoilMoist, range, isEn]);

  const farmId = JSON.parse(localStorage.getItem('warif_user') || '{}').farmId || 1;
  const { data: apiRecs } = useRecommendations(farmId);
  const soilRecs = useMemo(() => {
    if (!apiRecs) return [];
    return apiRecs.map(r => ({
      text: r.message,
      reasoning: r.message
    }));
  }, [apiRecs]);

  return (
    <div className="w-full px-4 md:px-8 py-5 page-enter" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-[1150px] mx-auto flex flex-col gap-6">

        <SensorTopBar
          title={T.title}
          subtitle={T.subtitle}
          icon={<PlantSoilIcon />}
          onBack={onBack}
          onExport={handleExport}
          T={translations[lang]}
          isRtl={isRtl}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="animate-fade-in-up delay-1 h-full">
            <CardShell className="p-5 flex flex-col gap-4 bg-white border-gray-100 shadow-sm min-h-[220px] h-full card-interactive">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight leading-tight">{T.soilData}</div>
                <div className="text-[12px] font-medium text-gray-400 mt-1 mb-2">{lastUpdateLabel}</div>
              </div>
              <div className="flex-1 flex flex-col gap-4 justify-center">
                <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all group">
                  <span className="text-[13px] font-bold text-gray-500 group-hover:text-gray-700">{T.soilTemp}</span>
                  <span className="text-2xl font-black text-gray-800">{soilTemp.toFixed(1)}°C</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all group">
                  <span className="text-[13px] font-bold text-gray-500 group-hover:text-gray-700">{T.soilMoist}</span>
                  <span className="text-2xl font-black text-gray-800">{soilMoist.toFixed(0)}%</span>
                </div>
              </div>
            </CardShell>
          </div>

          <div className="animate-fade-in-up delay-2 h-full">
            <CardShell className="p-6 flex flex-col gap-4 bg-white border-gray-100 shadow-sm min-h-[220px] h-full card-interactive">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight leading-tight flex items-center gap-2">
                  {T.soilRecs} 
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-200/50 font-black tracking-tighter uppercase">{T.smartAnalysis}</span>
                </div>
                <div className="text-[12px] font-medium text-gray-400 mt-1 mb-2">{isEn ? 'Suggested actions for root health.' : 'إجراءات مقترحة للحفاظ على صحة وسلامة الجذور.'}</div>
              </div>
              <ul className="flex flex-col gap-5 flex-1">
                {soilRecs.length > 0 ? (
                  soilRecs.slice(0, 2).map((rec, i) => (
                    <li key={i} className={`flex gap-3 group/rec ${isRtl ? 'text-right' : 'text-left'}`}>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      <div className="flex flex-col gap-1.5">
                        <div className="text-[14px] font-black text-gray-800 leading-tight group-hover/rec:text-emerald-700 transition-colors uppercase tracking-tight">{rec.text}</div>
                        <div className={`text-[12px] font-medium text-gray-500 leading-relaxed ${isRtl ? 'border-r-2 pr-3 border-emerald-500/20' : 'border-l-2 pl-3 border-emerald-500/20'}`}>
                          <span className="font-black text-emerald-600 mx-1">{T.reason}</span>
                          {rec.reasoning}
                        </div>
                      </div>
                    </li>
                  ))
                ) : (
                  <EmptyState 
                    compact={true}
                    title={T.noRecsTitle}
                    subtitle={T.noRecsSub}
                  />
                )}
              </ul>
            </CardShell>
          </div>
        </div>

        <div className="animate-fade-in-up delay-3 mt-2">
          <div className={`mb-4 ${isRtl ? 'text-right' : 'text-left'}`}>
            <div className="text-xl font-black text-gray-800 tracking-tight leading-tight">{T.bioTitle}</div>
            <div className="text-[12px] font-medium text-gray-400 mt-1">{T.bioSub}</div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HealthStyleBarChart 
              range={range} onRangeChange={setRange} data={soilTempSeries} 
              unit="°C" metricName={T.tempChart} color="#10b981" 
              yAxisTitle={T.tempY}
              T={translations[lang]}
              isRtl={isRtl}
            />
            <HealthStyleBarChart 
              range={range} onRangeChange={setRange} data={soilMoistSeries} 
              unit="٪" metricName={T.moistChart} color="#10b981" 
              yAxisTitle={T.moistY}
              T={translations[lang]}
              isRtl={isRtl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
