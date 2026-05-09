import { useMemo, useState, useEffect } from 'react';
import { translations } from '../../i18n';
import {
  SensorTopBar,
  CardShell,
  PlantSoilIcon,
  WindSharedIcon,
  EmptyState,
  getRecommendationTheme,
  RecommendationCard
} from './DashboardShared';
import { HealthStyleBarChart, LightAreaChart, IrrigationActionButton } from './DashboardCharts';

import {
  generateDataForRange,
  formatLastUpdated
} from './dashboardUtils';
import { useLatestSensors, triggerManualCooling, triggerManualIrrigation, useSensorHistory, useRecommendations, executeRecommendation, submitRecommendationFeedback } from '../../hooks/useWarifData';
import { getLabelForRange } from './dashboardUtils';

/* =========================================================
   1. Microclimate Module (المناخ والتهوية)
========================================================= */

export function MicroclimatePage({ onBack, globalAutoMode, activeFarm, farmId, sharedSensors }) {
  const [seconds, setSeconds] = useState(0);
  const [activeAction, setActiveAction] = useState("");
  const [fanRunning, setFanRunning] = useState(false);
  const [coolerRunning, setCoolerRunning] = useState(false);

  const [feedback, setFeedback] = useState({});
  const [showThanksIds, setShowThanksIds] = useState([]);
  const [recommendationStatus, setRecommendationStatus] = useState({});

  const handleFeedback = async (id, type) => {
    setFeedback(prev => ({ ...prev, [id]: type }));
    setShowThanksIds(prev => [...prev, id]);
    setTimeout(() => setShowThanksIds(prev => prev.filter(i => i !== id)), 2000);

    // إرسال الفيدباك إلى الـ Backend للتعلم المستمر
    try {
      const helpful = type === 'up';
      const token = localStorage.getItem('warif_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';

      const response = await fetch(
        `${API_BASE}/api/v1/recommendations/${farmId}/feedback/${id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ helpful })
        }
      );
      if (!response.ok) console.error('Failed to save feedback');
    } catch (err) {
      console.error('Error sending feedback:', err);
    }
  };

  const handleRecommendationDecision = (id, decision) => {
    setRecommendationStatus(prev => ({ ...prev, [id]: decision }));
  };

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
    climateLog: isEn ? "Climate & Lighting Sensor Trends" : "مسارات قراءات المناخ والإضاءة",
    climateLogSub: isEn ? "Historical sensor pattern discovery." : "اكتشاف الأنماط التاريخية للحساسات.",
    tempChart: isEn ? "Temperature Trend" : "مسار درجة الحرارة",
    humChart: isEn ? "Air Humidity Trend" : "مسار رطوبة الهواء",
    lightChart: isEn ? "Light Intensity Trend" : "مسار شدة الإضاءة",
    airTempChart: isEn ? 'Air Temperature Trend' : 'مسار درجة حرارة الهواء',
    soilTempChart: isEn ? 'Soil Temperature Patterns' : 'أنماط حرارة التربة',
    soilMoistChart: isEn ? 'Soil Moisture Patterns' : 'أنماط رطوبة التربة المكتشفة',
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
  // const coolingActive = livesensors?.coolingActive ?? false; (Replaced by local state)
  const lastUpdateLabel = formatLastUpdated(seconds, T.lastUpdateAr, T.lastUpdateEn);

  const historyLimit = range === 'D' ? 1500 : range === 'W' ? 3000 : range === 'M' ? 8000 : 15000;
  const { data: rawTemp } = useSensorHistory('air_temperature', historyLimit, 1800000);
  const { data: rawHum } = useSensorHistory('air_humidity', historyLimit, 1800000);
  const { data: rawLight } = useSensorHistory('light_intensity', historyLimit, 1800000);

  const formatPoints = (rawData) => {
    const now = new Date();
    const daysAr = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const daysEn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const monthsEn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    if (range === 'D') {
      const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' });
      const buckets = Array.from({ length: 48 }, () => []);
      rawData?.forEach(r => {
        const itemDate = new Date(r.timestamp);
        if (itemDate.toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' }) !== todayStr) return;
        const localDate = new Date(itemDate.getTime() + 3 * 60 * 60 * 1000);
        const slot = localDate.getUTCHours() * 2 + (localDate.getUTCMinutes() >= 30 ? 1 : 0);
        buckets[slot].push(r.value || 0);
      });
      return buckets.map((items, i) => {
        const hour = Math.floor(i / 2);
        const label = i % 2 === 0 ? `${hour}:00` : `${hour}:30`;
        const value = items.length > 0 ? items.reduce((s, v) => s + v, 0) / items.length : 0;
        return { label, value: Math.round(value * 10) / 10 };
      });
    }
    if (range === 'W') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const buckets = Array.from({ length: 7 }, () => []);
      rawData?.forEach(r => {
        const diffDays = Math.floor((new Date(r.timestamp) - startOfWeek) / 86400000);
        if (diffDays >= 0 && diffDays < 7) buckets[diffDays].push(r.value || 0);
      });
      return buckets.map((items, i) => {
        const targetDate = new Date(startOfWeek);
        targetDate.setDate(startOfWeek.getDate() + i);
        const label = isEn ? daysEn[targetDate.getDay()] : daysAr[targetDate.getDay()];
        const value = items.length > 0 ? items.reduce((s, v) => s + v, 0) / items.length : 0;
        return { label, value: Math.round(value) };
      });
    }
    if (range === 'M') {
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
      const buckets = Array.from({ length: 30 }, () => []);
      rawData?.forEach(r => {
        const diffDays = Math.floor((new Date(r.timestamp) - startDate) / 86400000);
        if (diffDays >= 0 && diffDays < 30) buckets[diffDays].push(r.value || 0);
      });
      return buckets.map((items, i) => {
        const targetDate = new Date(startDate);
        targetDate.setDate(startDate.getDate() + i);
        const value = items.length > 0 ? items.reduce((s, v) => s + v, 0) / items.length : 0;
        return { label: `${targetDate.getDate()}`, value: Math.round(value) };
      });
    }
    if (range === 'Y') {
      const buckets = Array.from({ length: 12 }, () => []);
      rawData?.forEach(r => {
        const d = new Date(r.timestamp);
        const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (monthsAgo >= 0 && monthsAgo < 12) buckets[11 - monthsAgo].push(r.value || 0);
      });
      return buckets.map((items, i) => {
        const targetMonth = (now.getMonth() - 11 + i + 12) % 12;
        const label = isEn ? monthsEn[targetMonth] : monthsAr[targetMonth];
        const value = items.length > 0 ? items.reduce((s, v) => s + v, 0) / items.length : 0;
        return { label, value: Math.round(value) };
      });
    }
    return [];
  };

  const tempSeries = useMemo(() => formatPoints(rawTemp), [rawTemp, range, isEn]);
  const humSeries = useMemo(() => formatPoints(rawHum), [rawHum, range, isEn]);
  const lightSeries = useMemo(() => formatPoints(rawLight), [rawLight, range, isEn]);


  const { data: apiRecs } = useRecommendations(farmId);
  const recommendations = useMemo(() => {
    if (!apiRecs) return [];
    return apiRecs.map(r => ({
      text: r.message,
      reasoning: r.data_insight || r.reasoning || r.message
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
          <div className="animate-fade-in-up delay-1">
            <CardShell className="p-5 flex flex-col gap-4 h-[320px] card-interactive justify-start">
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
                  <span className="text-[13px] font-bold text-gray-500 group-hover:text-gray-700">
                    {isEn ? 'Light Intensity' : 'شدة الإضاءة'}
                  </span>
                  <span className="text-2xl font-black text-gray-800" dir="ltr">
                    {Math.round(light).toLocaleString()} Lux
                  </span>
                </div>
              </div>
            </CardShell>
          </div>

          <div className="animate-fade-in-up delay-2">
            <CardShell className="p-6 flex flex-col gap-4 h-[320px] card-interactive justify-start overflow-hidden">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight leading-tight flex items-center gap-2">
                  {T.recs} 
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-200/50 font-black tracking-tighter uppercase">{T.smartAnalysis}</span>
                </div>
                <div className="text-[12px] font-medium text-gray-400 mt-1 mb-2">{T.recsSub}</div>
              </div>
              <div
                className={`flex flex-col gap-3 flex-1 max-h-[400px] overflow-y-auto ${isRtl ? 'pl-2' : 'pr-2'}`}
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#d1d5db transparent'
                }}
              >
                {recommendations.length > 0 ? (
                  recommendations.map((rec, i) => (
                    <RecommendationCard
                      key={rec.id || i}
                      rec={{
                        id: rec.id || i,
                        title: rec.text,
                        message: rec.text,
                        reasoning: rec.reasoning,
                        category: 'temperature',
                        severity: rec.severity || 'normal'
                      }}
                      farmId={farmId}
                      globalAutoMode={globalAutoMode}
                      isEn={isEn}
                      onExecute={executeRecommendation}
                      onIgnore={() => {}}
                      onFeedback={handleFeedback}
                      feedbackState={feedback}
                      showThanks={showThanksIds}
                      compact={true}
                    />
                  ))
                ) : (
                  <EmptyState
                    compact={true}
                    title={T.noRecsTitle}
                    subtitle={T.noRecsSub}
                  />
                )}
              </div>
            </CardShell>
          </div>

          <div className="animate-fade-in-up delay-3">
            <CardShell className="p-6 flex flex-col gap-4 h-[320px] card-interactive justify-start overflow-hidden">
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
                <div className="flex flex-col gap-3">
                  <span className="sr-only">Climate Control Actions</span>
                  
                  {/* Mode 1: Full Cooling */}
                  <div className="flex flex-col gap-1">
                    <IrrigationActionButton 
                      active={fanRunning && coolerRunning} 
                      onClick={() => {
                        setFanRunning(true);
                        setCoolerRunning(true);
                        setActiveAction('full');
                        triggerManualCooling && triggerManualCooling('full', farmId);
                        setTimeout(() => setActiveAction(""), 5000);
                      }}
                      icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20l4-4 4 4"/></svg>}
                      isRtl={isRtl}
                    >
                      {isEn ? "Full Cooling (Fan + Cooler)" : "تبريد كامل (مروحة + مكيف)"}
                    </IrrigationActionButton>
                  </div>

                  {/* Mode 2: Fan Only */}
                  <div className="flex flex-col gap-1">
                    <IrrigationActionButton 
                      active={fanRunning && !coolerRunning} 
                      onClick={() => {
                        setFanRunning(true);
                        setCoolerRunning(false);
                        setActiveAction('fan_only');
                        triggerManualCooling && triggerManualCooling('fan_only', farmId);
                        setTimeout(() => setActiveAction(""), 5000);
                      }}
                      icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12L12 3C15 3 18 6 18 9S15 12 12 12Z" /><path d="M12 12L21 12C21 15 18 18 15 18S12 15 12 12Z" /><path d="M12 12L12 21C9 21 6 18 6 15S9 12 12 12Z" /><path d="M12 12L3 12C3 9 6 6 9 6S12 9 12 12Z" /></svg>}
                      isRtl={isRtl}
                    >
                      {isEn ? "Ventilation Only (Fan)" : "تهوية فقط (مروحة)"}
                    </IrrigationActionButton>
                  </div>

                  {/* Mode 3: Stop All */}
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => {
                        setFanRunning(false);
                        setCoolerRunning(false);
                        setActiveAction('stop');
                        triggerManualCooling && triggerManualCooling('stop', farmId);
                        setTimeout(() => setActiveAction(""), 5000);
                      }}
                      className="w-full flex items-center justify-center gap-3 p-4 rounded-[20px] bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all font-black"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                      {isEn ? "Stop All Units" : "إيقاف الكل"}
                    </button>
                  </div>

                  {/* Status Indicators */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-2xl border flex flex-col items-center gap-1 ${fanRunning ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                      <span className="text-[10px] font-bold uppercase">{isEn ? 'Fan Status' : 'حالة المروحة'}</span>
                      <span className="text-sm font-black">{fanRunning ? (isEn ? 'ON' : 'تعمل') : (isEn ? 'OFF' : 'متوقفة')}</span>
                    </div>
                    <div className={`p-3 rounded-2xl border flex flex-col items-center gap-1 ${coolerRunning ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                      <span className="text-[10px] font-bold uppercase">{isEn ? 'Cooler Status' : 'حالة المكيف'}</span>
                      <span className="text-sm font-black">{coolerRunning ? (isEn ? 'ON' : 'تعمل') : (isEn ? 'OFF' : 'متوقفة')}</span>
                    </div>
                  </div>

                  {activeAction && (
                    <div className="mt-2 px-4 py-2.5 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 text-xs font-black flex items-center gap-2 animate-pulse">
                      <span>✓ {isEn ? 'Command sent to gateway...' : 'تم إرسال الأمر للوحدة المركزية...'}</span>
                    </div>
                  )}
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
              unit="°C" metricName={T.airTempChart || T.tempChart} color="#10b981" 
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
              <LightAreaChart
                data={lightSeries}
                range={range}
                onRangeChange={setRange}
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
export function SoilRootDataPage({ onBack, globalAutoMode, activeFarm, farmId, sharedSensors }) {
  const [seconds, setSeconds] = useState(0);
  const [pumpRunning, setPumpRunning] = useState(false);
  const [irrigationFeedback, setIrrigationFeedback] = useState(null);

  const [feedback, setFeedback] = useState({});
  const [showThanksIds, setShowThanksIds] = useState([]);
  const [recommendationStatus, setRecommendationStatus] = useState({});

  const handleFeedback = async (id, type) => {
    setFeedback(prev => ({ ...prev, [id]: type }));
    setShowThanksIds(prev => [...prev, id]);
    setTimeout(() => setShowThanksIds(prev => prev.filter(i => i !== id)), 2000);

    // إرسال الفيدباك إلى الـ Backend للتعلم المستمر
    try {
      const helpful = type === 'up';
      const token = localStorage.getItem('warif_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';

      const response = await fetch(
        `${API_BASE}/api/v1/recommendations/${farmId}/feedback/${id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ helpful })
        }
      );
      if (!response.ok) console.error('Failed to save feedback');
    } catch (err) {
      console.error('Error sending feedback:', err);
    }
  };

  const handleRecommendationDecision = (id, decision) => {
    setRecommendationStatus(prev => ({ ...prev, [id]: decision }));
  };

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
    airTempChart: isEn ? 'Air Temperature Trend' : 'مسار درجة حرارة الهواء',
    soilTempChart: isEn ? 'Soil Temperature Patterns' : 'أنماط حرارة التربة',
    soilMoistChart: isEn ? 'Soil Moisture Patterns' : 'أنماط رطوبة التربة المكتشفة',
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

  const historyLimit = range === 'D' ? 1500 : range === 'W' ? 3000 : range === 'M' ? 8000 : 15000;
  const { data: rawSoilTemp } = useSensorHistory('soil_temperature', historyLimit, 1800000);
  const { data: rawSoilMoist } = useSensorHistory('soil_moisture', historyLimit, 1800000);

  const formatPoints = (rawData) => {
    const now = new Date();
    const daysAr = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const daysEn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const monthsEn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    if (range === 'D') {
      const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' });
      const buckets = Array.from({ length: 48 }, () => []);
      rawData?.forEach(r => {
        const itemDate = new Date(r.timestamp);
        if (itemDate.toLocaleDateString('en-US', { timeZone: 'Asia/Riyadh' }) !== todayStr) return;
        const localDate = new Date(itemDate.getTime() + 3 * 60 * 60 * 1000);
        const slot = localDate.getUTCHours() * 2 + (localDate.getUTCMinutes() >= 30 ? 1 : 0);
        buckets[slot].push(r.value || 0);
      });
      return buckets.map((items, i) => {
        const hour = Math.floor(i / 2);
        const label = i % 2 === 0 ? `${hour}:00` : `${hour}:30`;
        const value = items.length > 0 ? items.reduce((s, v) => s + v, 0) / items.length : 0;
        return { label, value: Math.round(value * 10) / 10 };
      });
    }
    if (range === 'W') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const buckets = Array.from({ length: 7 }, () => []);
      rawData?.forEach(r => {
        const diffDays = Math.floor((new Date(r.timestamp) - startOfWeek) / 86400000);
        if (diffDays >= 0 && diffDays < 7) buckets[diffDays].push(r.value || 0);
      });
      return buckets.map((items, i) => {
        const targetDate = new Date(startOfWeek);
        targetDate.setDate(startOfWeek.getDate() + i);
        const label = isEn ? daysEn[targetDate.getDay()] : daysAr[targetDate.getDay()];
        const value = items.length > 0 ? items.reduce((s, v) => s + v, 0) / items.length : 0;
        return { label, value: Math.round(value) };
      });
    }
    if (range === 'M') {
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
      const buckets = Array.from({ length: 30 }, () => []);
      rawData?.forEach(r => {
        const diffDays = Math.floor((new Date(r.timestamp) - startDate) / 86400000);
        if (diffDays >= 0 && diffDays < 30) buckets[diffDays].push(r.value || 0);
      });
      return buckets.map((items, i) => {
        const targetDate = new Date(startDate);
        targetDate.setDate(startDate.getDate() + i);
        const value = items.length > 0 ? items.reduce((s, v) => s + v, 0) / items.length : 0;
        return { label: `${targetDate.getDate()}`, value: Math.round(value) };
      });
    }
    if (range === 'Y') {
      const buckets = Array.from({ length: 12 }, () => []);
      rawData?.forEach(r => {
        const d = new Date(r.timestamp);
        const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (monthsAgo >= 0 && monthsAgo < 12) buckets[11 - monthsAgo].push(r.value || 0);
      });
      return buckets.map((items, i) => {
        const targetMonth = (now.getMonth() - 11 + i + 12) % 12;
        const label = isEn ? monthsEn[targetMonth] : monthsAr[targetMonth];
        const value = items.length > 0 ? items.reduce((s, v) => s + v, 0) / items.length : 0;
        return { label, value: Math.round(value) };
      });
    }
    return [];
  };

  const soilTempSeries = useMemo(() => formatPoints(rawSoilTemp), [rawSoilTemp, range, isEn]);
  const soilMoistSeries = useMemo(() => formatPoints(rawSoilMoist), [rawSoilMoist, range, isEn]);


  const { data: apiRecs } = useRecommendations(farmId);
  const soilRecs = useMemo(() => {
    if (!apiRecs) return [];
    return apiRecs.map(r => ({
      text: r.message,
      reasoning: r.data_insight || r.reasoning || r.message
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
          <div className="animate-fade-in-up delay-1">
            <CardShell className="p-5 flex flex-col gap-4 bg-white border-gray-100 shadow-sm h-[280px] card-interactive justify-start">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight leading-tight">{T.soilData}</div>
                <div className="text-[12px] font-medium text-gray-400 mt-1 mb-3">{lastUpdateLabel}</div>
              </div>
              <div className="flex flex-col gap-2.5">
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

          <div className="animate-fade-in-up delay-2">
            <CardShell className="p-6 flex flex-col gap-3 bg-white border-gray-100 shadow-sm h-[280px] card-interactive justify-start overflow-hidden">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight leading-tight flex items-center gap-2">
                  {T.soilRecs} 
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-200/50 font-black tracking-tighter uppercase">{T.smartAnalysis}</span>
                </div>
                <div className="text-[12px] font-medium text-gray-400 mt-1 mb-2">{isEn ? 'Suggested actions for root health.' : 'إجراءات مقترحة للحفاظ على صحة وسلامة الجذور.'}</div>
              </div>
              <div
                className={`flex flex-col gap-3 flex-1 max-h-[400px] overflow-y-auto ${isRtl ? 'pl-2' : 'pr-2'}`}
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#d1d5db transparent'
                }}
              >
                {soilRecs.length > 0 ? (
                  soilRecs.map((rec, i) => (
                    <RecommendationCard
                      key={rec.id || i}
                      rec={{
                        id: rec.id || i,
                        title: rec.text,
                        message: rec.text,
                        reasoning: rec.reasoning,
                        category: 'soil',
                        severity: rec.severity || 'normal'
                      }}
                      farmId={farmId}
                      globalAutoMode={globalAutoMode}
                      isEn={isEn}
                      onExecute={executeRecommendation}
                      onIgnore={() => {}}
                      onFeedback={handleFeedback}
                      feedbackState={feedback}
                      showThanks={showThanksIds}
                      compact={true}
                    />
                  ))
                ) : (
                  <EmptyState
                    compact={true}
                    title={T.noRecsTitle}
                    subtitle={T.noRecsSub}
                  />
                )}
              </div>
            </CardShell>
          </div>
        </div>

        <div className="animate-fade-in-up delay-4 mt-2">
          <div className={`mb-4 ${isRtl ? 'text-right' : 'text-left'}`}>
            <div className="text-xl font-black text-gray-800 tracking-tight leading-tight">{T.bioTitle}</div>
            <div className="text-[12px] font-medium text-gray-400 mt-1">{T.bioSub}</div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HealthStyleBarChart 
              range={range} onRangeChange={setRange} data={soilTempSeries} 
              unit="°C" metricName={T.soilTempChart || T.tempChart} color="#10b981" 
              yAxisTitle={T.tempY}
              T={translations[lang]}
              isRtl={isRtl}
            />
            <HealthStyleBarChart 
              range={range} onRangeChange={setRange} data={soilMoistSeries} 
              unit="٪" metricName={T.soilMoistChart || T.moistChart} color="#10b981" 
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
