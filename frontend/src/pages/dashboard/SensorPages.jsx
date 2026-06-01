import { useMemo, useState, useEffect } from 'react';
import { translations } from '../../i18n';
import {
  SensorTopBar,
  CardShell,
  PlantSoilIcon,
  WindSharedIcon,
  EmptyState,
  RecommendationCard
} from './DashboardShared';
import { HealthStyleBarChart, LightAreaChart, IrrigationActionButton } from './DashboardCharts';

import { formatLastUpdated } from './dashboardUtils';
import { useLatestSensors, triggerManualCooling, useSensorHistory, useRecommendations, executeRecommendation, submitRecommendationFeedback, submitRecommendationAction, useCoolingStatus } from '../../hooks/useWarifData';

const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const downloadCsvReport = ({ title, fileName, headers, rows }) => {
  const csv = `\ufeff${title}\n${headers.map(csvValue).join(',')}\n${rows.map(row => row.map(csvValue).join(',')).join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatReportTimestamp = (timestamp, isEn) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString(isEn ? 'en-US' : 'ar-SA', { timeZone: 'Asia/Riyadh' });
};

const getReportMinuteKey = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const makkahTime = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  makkahTime.setUTCSeconds(0, 0);
  return makkahTime.toISOString();
};

const buildHistoryRows = (series, isEn) => {
  const rowsByTime = new Map();
  series.forEach(({ label, data }) => {
    data?.forEach(item => {
      const key = getReportMinuteKey(item.timestamp);
      if (!rowsByTime.has(key)) rowsByTime.set(key, { timestamp: item.timestamp });
      rowsByTime.get(key)[label] = item.value ?? '';
    });
  });

  return Array.from(rowsByTime.values())
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(row => [
      formatReportTimestamp(row.timestamp, isEn),
      ...series.map(({ label }) => row[label] ?? '')
    ]);
};

const sectionRows = (title, headers, rows) => [
  [],
  [title],
  headers,
  ...rows
];

/* =========================================================
   1. Microclimate Module (المناخ والتهوية)
========================================================= */

export function MicroclimatePage({ onBack, globalAutoMode, activeFarm, farmId, sharedSensors }) {
   const [seconds, setSeconds] = useState(0);
   const [activeAction, setActiveAction] = useState("");
   const [fanRunning, setFanRunning] = useState(false);
   const [coolerRunning, setCoolerRunning] = useState(false);

  const { status: coolingStatus, refetch: refetchCoolingStatus } = useCoolingStatus(farmId);

  useEffect(() => {
    if (coolingStatus) {
      setFanRunning(coolingStatus.fan);
      setCoolerRunning(coolingStatus.cooler);
    }
  }, [coolingStatus]);

  const [feedback, setFeedback] = useState({});
  const [showThanksIds, setShowThanksIds] = useState([]);
  const [handledRecommendationIds, setHandledRecommendationIds] = useState([]);

  const handleCoolingCommand = async (mode) => {
    if (activeAction) return;
    setActiveAction(mode);
    try {
      await triggerManualCooling(mode, farmId);
      await refetchCoolingStatus();
    } catch (error) {
      console.error('[Warif] Cooling command failed:', error);
    } finally {
      setActiveAction("");
    }
  };

  const handleFeedback = async (id, type) => {
    setFeedback(prev => ({ ...prev, [id]: type }));
    setShowThanksIds(prev => [...prev, id]);
    setTimeout(() => setShowThanksIds(prev => prev.filter(i => i !== id)), 2000);
    const rawId = String(id).replace(/^(recommendation|alert|api)-/, '');
    await submitRecommendationFeedback(farmId, rawId, type === 'up');
  };

  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  const T = {
    title: isEn ? "Climate & Ventilation" : "المناخ والتهوية",
    subtitle: isEn ? "Smart analysis of temperature and air humidity." : "تحليل ذكي لدرجات الحرارة ورطوبة الهواء المحيط بالمحاصيل.",
    readings: isEn ? "Sensor Readings" : "قراءات الحساسات",
    temp: isEn ? "Air Temperature" : "حرارة الهواء",
    hum: isEn ? "Air Humidity" : "رطوبة الهواء",
    recs: isEn ? "Climate Recommendations" : "توصيات المناخ",
    smartAnalysis: isEn ? "Smart Analysis" : "تحليل ذكي",
    recsSub: isEn ? "Suggested actions to maintain greenhouse stability." : "إجراءات مقترحة للحفاظ على استقرار المحمية",
    reason: isEn ? "Reason:" : "السبب:",
    control: isEn ? "Climate Control" : "التحكم في مناخ المزرعة",
    autoSub: isEn ? "Direct manual control of cooling and ventilation." : "تحكم يدوي مباشر بالتبريد والتهوية",
    autoActiveTitle: isEn ? "System Managed Automatically" : "النظام يدار تلقائياً الآن.",
    autoActiveSub: isEn ? "All manual control buttons are locked to maintain greenhouse stability." : "جميع أزرار التحكم اليدوي مقفلة لحفظ استقرار المحمية.",
    startCooling: isEn ? "Start Manual Cooling" : "بدء التبريد اليدوي",
    stopFans: isEn ? "Stop Fans" : "إيقاف المراوح",
    climateLog: isEn ? "Climate & Lighting Readings" : "قراءات المناخ والإضاءة",
    climateLogSub: isEn ? "Sensor data log." : "سجل البيانات للحساسات",
    humChart: isEn ? "Air Humidity" : "رطوبة الهواء",
    airTempChart: isEn ? "Air Temperature" : "درجة حرارة الهواء",
    tempY: isEn ? "Temp (°C)" : "درجة الحرارة (°C)",
    humY: isEn ? "Humidity (%)" : "رطوبة الهواء (٪)",
    lightY: isEn ? "Lux" : "لوكس",
    lastUpdateAr: "آخر تحديث",
    lastUpdateEn: "Last Update",
    noRecsTitle: isEn ? "All Systems Stable" : "جميع الأنظمة مستقرة.",
    noRecsSub: isEn ? "No specific recommendations at the moment." : "لا توجد توصيات محددة حالياً.",
  };

  const handleExport = () => {
    const today = new Date();
    const displayDate = today.toLocaleDateString(isEn ? 'en-US' : 'ar-SA');
    const fileDate = today.toISOString().slice(0, 10);
    const reportRows = [
      ...sectionRows(
        isEn ? 'Current Readings' : 'القراءات الحالية',
        isEn ? ['Metric', 'Value', 'Unit', 'Export Date'] : ['المؤشر', 'القيمة', 'الوحدة', 'تاريخ التصدير'],
        [
          [T.temp, temp.toFixed(1), '°C', displayDate],
          [T.hum, hum.toFixed(0), '%', displayDate],
          [isEn ? 'Light Intensity' : 'شدة الإضاءة', Math.round(light), 'Lux', displayDate],
          [isEn ? 'Automation Mode' : 'وضع الأتمتة', globalAutoMode ? (isEn ? 'Auto' : 'تلقائي') : (isEn ? 'Manual' : 'يدوي'), '', displayDate],
          [isEn ? 'Cooling State' : 'حالة التبريد', coolerRunning ? (isEn ? 'Running' : 'يعمل') : (isEn ? 'Idle' : 'متوقف'), '', displayDate],
          [isEn ? 'Fan State' : 'حالة المراوح', fanRunning ? (isEn ? 'Running' : 'تعمل') : (isEn ? 'Idle' : 'متوقفة'), '', displayDate]
        ]
      ),
      ...sectionRows(
        isEn ? 'Recommendations' : 'التوصيات',
        isEn ? ['Message', 'Reasoning', 'Severity', 'Created At'] : ['التوصية', 'السبب', 'الأولوية', 'تاريخ الإنشاء'],
        recommendations.map(rec => [
          rec.text || '',
          rec.reasoning || '',
          rec.severity || '',
          formatReportTimestamp(rec.created_at, isEn)
        ])
      ),
      ...sectionRows(
        isEn ? 'Complete Historical Chart Data' : 'بيانات الرسم التاريخية الكاملة',
        isEn
          ? ['Timestamp', 'Air Temperature', 'Air Humidity', 'Light Intensity']
          : ['الوقت', 'حرارة الهواء', 'رطوبة الهواء', 'شدة الإضاءة'],
        buildHistoryRows([
          { label: 'temperature', data: allRawTemp },
          { label: 'humidity', data: allRawHum },
          { label: 'light', data: allRawLight }
        ], isEn)
      )
    ];

    downloadCsvReport({
      title: isEn ? 'Microclimate Report' : 'تقرير المناخ والتهوية',
      fileName: isEn ? `microclimate_report_${fileDate}.csv` : `تقرير_المناخ_${fileDate}.csv`,
      headers: [],
      rows: reportRows
    });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeFarm]);

  const [range, setRange] = useState("D");
  const { data: localSensors } = useLatestSensors(3000, farmId);
  const livesensors = sharedSensors || localSensors;
  const temp = livesensors?.air_temperature ?? 0;
  const hum  = livesensors?.air_humidity    ?? 0;
  const light = livesensors?.light_intensity ?? 0;
  const lastUpdateLabel = formatLastUpdated(seconds, T.lastUpdateAr, T.lastUpdateEn);

  const historySince = (() => {
    const now = new Date();
    if (range === 'D') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === 'W') { const d = new Date(now); d.setDate(now.getDate() - now.getDay()); d.setHours(0,0,0,0); return d; }
    if (range === 'M') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (range === 'Y') return new Date(now.getFullYear(), 0, 1);
    return null;
  })();
  const chartBucket = range === 'D' ? 'minute' : range === 'Y' ? 'month' : 'day';
  const reportSince = (() => {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1);
  })();
  const { data: rawTemp } = useSensorHistory('air_temperature', 0, 1800000, historySince, { bucket: chartBucket });
  const { data: rawHum } = useSensorHistory('air_humidity', 0, 1800000, historySince, { bucket: chartBucket });
  const { data: rawLight } = useSensorHistory('light_intensity', 0, 1800000, historySince, { bucket: chartBucket });
  const { data: allRawTemp } = useSensorHistory('air_temperature', 0, 0, reportSince, { bucket: 'minute' });
  const { data: allRawHum } = useSensorHistory('air_humidity', 0, 0, reportSince, { bucket: 'minute' });
  const { data: allRawLight } = useSensorHistory('light_intensity', 0, 0, reportSince, { bucket: 'minute' });

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
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const buckets = Array.from({ length: daysInMonth }, () => []);
      rawData?.forEach(r => {
        const d = new Date(r.timestamp);
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
          buckets[d.getDate() - 1].push(r.value || 0);
        }
      });
      return buckets.map((items, i) => {
        const value = items.length > 0 ? items.reduce((s, v) => s + v, 0) / items.length : 0;
        return { label: `${i + 1}`, value: Math.round(value) };
      });
    }
    if (range === 'Y') {
      const buckets = Array.from({ length: 12 }, () => []);
      rawData?.forEach(r => {
        const d = new Date(r.timestamp);
        if (d.getFullYear() === now.getFullYear()) {
          buckets[d.getMonth()].push(r.value || 0);
        }
      });
      return buckets.map((items, i) => {
        const label = isEn ? monthsEn[i] : monthsAr[i];
        const value = items.length > 0 ? items.reduce((s, v) => s + v, 0) / items.length : 0;
        return { label, value: Math.round(value) };
      });
    }
    return [];
  };

  const tempSeries = useMemo(() => formatPoints(rawTemp), [rawTemp, range, isEn]);
  const humSeries = useMemo(() => formatPoints(rawHum), [rawHum, range, isEn]);
  const lightSeries = useMemo(() => formatPoints(rawLight), [rawLight, range, isEn]);


  const recentRecommendationsSince = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000), []);
  const { data: apiRecs } = useRecommendations(farmId, { since: recentRecommendationsSince });
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const recommendations = useMemo(() => {
    if (!apiRecs) return [];
    return apiRecs
      .filter(r => ['temperature', 'humidity', 'climate', 'air_temperature', 'air_humidity'].includes(String(r.category || r.type || '').toLowerCase()))
      .filter(r => {
        const itemId = `${r.source || 'recommendation'}-${r.id}`;
        return !handledRecommendationIds.includes(itemId) && !handledRecommendationIds.includes(r.id);
      })
      .map(r => ({
        id: `${r.source || 'recommendation'}-${r.id}`,
        rawId: r.id,
        source: r.source || 'recommendation',
        text: r.message,
        reasoning: r.data_insight || r.reasoning || r.message,
        category: r.category || r.type || 'temperature',
        action_status: r.action_status,
        decision_state: r.decision_state,
        feedback: r.helpful === true ? 'up' : r.helpful === false ? 'down' : null,
        severity: r.severity,
        created_at: r.created_at
      }));
  }, [apiRecs, handledRecommendationIds]);

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
              <div className={`flex flex-col gap-3 flex-1 max-h-[400px] overflow-y-auto scrollbar-neutral ${isRtl ? 'pl-2' : 'pr-2'}`}>
                {recommendations.length > 0 ? (
                  recommendations.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      rec={{
                        id: rec.id,
                        rawId: rec.rawId,
                        title: rec.text,
                        message: rec.text,
                        reasoning: rec.reasoning,
                        category: rec.category,
                        severity: rec.severity || 'normal',
                        created_at: rec.created_at,
                        action_status: rec.action_status,
                        decision_state: rec.decision_state
                      }}
                      farmId={farmId}
                      globalAutoMode={globalAutoMode}
                      isEn={isEn}
                      onExecute={executeRecommendation}
                      onActionChange={(id, status) => submitRecommendationAction(farmId, id, status)}
                      autoDismissOnAction={true}
                      onDismiss={(id) => setHandledRecommendationIds(prev => [...new Set([...prev, id])])}
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

          <div className="animate-fade-in-up delay-3 flex flex-col gap-4">
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
                      disabled={Boolean(activeAction)}
                      onClick={() => handleCoolingCommand('full')}
                      icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20l4-4 4 4"/></svg>}
                      isRtl={isRtl}
                    >
                      {activeAction === 'full'
                        ? (isEn ? "Starting..." : "جاري التشغيل...")
                        : (isEn ? "Full Cooling (Fan + Cooler)" : "تبريد كامل (مروحة + مكيف)")}
                    </IrrigationActionButton>
                  </div>

                  {/* Mode 2: Fan Only */}
                  <div className="flex flex-col gap-1">
                    <IrrigationActionButton 
                      active={fanRunning && !coolerRunning} 
                      disabled={Boolean(activeAction)}
                      onClick={() => handleCoolingCommand('fan_only')}
                      icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12L12 3C15 3 18 6 18 9S15 12 12 12Z" /><path d="M12 12L21 12C21 15 18 18 15 18S12 15 12 12Z" /><path d="M12 12L12 21C9 21 6 18 6 15S9 12 12 12Z" /><path d="M12 12L3 12C3 9 6 6 9 6S12 9 12 12Z" /></svg>}
                      isRtl={isRtl}
                    >
                      {activeAction === 'fan_only'
                        ? (isEn ? "Starting..." : "جاري التشغيل...")
                        : (isEn ? "Ventilation Only (Fan)" : "تهوية فقط (مروحة)")}
                    </IrrigationActionButton>
                  </div>

                  {/* Mode 3: Stop All */}
                  {(fanRunning || coolerRunning) && (
                    <div className="flex flex-col gap-1">
                      <button 
                        disabled={Boolean(activeAction)}
                        onClick={() => handleCoolingCommand('stop')}
                        className={`w-full flex items-center justify-center gap-3 p-4 rounded-[20px] bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all font-black animate-fade-in ${activeAction ? 'opacity-60 cursor-wait pointer-events-none' : ''}`}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                        {activeAction === 'stop'
                          ? (isEn ? "Stopping..." : "جاري الإيقاف...")
                          : (isEn ? "Stop All Units" : "إيقاف الكل")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardShell>

            {/* Simple Status Bar */}
            <div className="p-3.5 bg-white/70 backdrop-blur-md rounded-[22px] border border-gray-100/60 shadow-[0_2px_10px_rgba(0,0,0,0.01)] flex items-center justify-between px-6 gap-4 animate-fade-in">
              {/* Fan Indicator */}
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${fanRunning ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-gray-300'}`}></span>
                <svg className={`w-5 h-5 ${fanRunning ? 'animate-spin text-emerald-600' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 12L12 3C15 3 18 6 18 9S15 12 12 12Z" /><path d="M12 12L21 12C21 15 18 18 15 18S12 15 12 12Z" /><path d="M12 12L12 21C9 21 6 18 6 15S9 12 12 12Z" /><path d="M12 12L3 12C3 9 6 6 9 6S12 9 12 12Z" />
                </svg>
                <span className="text-[12px] font-black text-gray-700">{isEn ? 'Fan:' : 'المروحة:'}</span>
                <span className={`text-[12px] font-black ${fanRunning ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {fanRunning ? (isEn ? 'ON' : 'تعمل') : (isEn ? 'OFF' : 'متوقفة')}
                </span>
              </div>

              {/* Separator line */}
              <div className="h-6 w-[1px] bg-gray-200/80"></div>

              {/* Cooler Indicator */}
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${coolerRunning ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse' : 'bg-gray-300'}`}></span>
                <svg className={`w-5 h-5 ${coolerRunning ? 'animate-pulse text-blue-600' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20l4-4 4 4"/>
                </svg>
                <span className="text-[12px] font-black text-gray-700">{isEn ? 'AC:' : 'المكيف:'}</span>
                <span className={`text-[12px] font-black ${coolerRunning ? 'text-blue-600' : 'text-gray-400'}`}>
                  {coolerRunning ? (isEn ? 'ON' : 'يعمل') : (isEn ? 'OFF' : 'متوقف')}
                </span>
              </div>
            </div>
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
  const [pumpRunning, _setPumpRunning] = useState(false);
  const [irrigationFeedback, _setIrrigationFeedback] = useState(null);

  const [feedback, setFeedback] = useState({});
  const [showThanksIds, setShowThanksIds] = useState([]);
  const [handledRecommendationIds, setHandledRecommendationIds] = useState([]);

  const handleFeedback = async (id, type) => {
    setFeedback(prev => ({ ...prev, [id]: type }));
    setShowThanksIds(prev => [...prev, id]);
    setTimeout(() => setShowThanksIds(prev => prev.filter(i => i !== id)), 2000);
    const rawId = String(id).replace(/^(recommendation|alert|api)-/, '');
    await submitRecommendationFeedback(farmId, rawId, type === 'up');
  };

  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  const T = {
    title: isEn ? "Soil & Crop Health" : "بيئة وصحة التربة",
    subtitle: isEn ? "Monitoring soil vitality, moisture, and temperature." : "مراقبة حيوية التربة وتقييم رطوبتها وحرارتها.",
    soilData: isEn ? "Soil Readings" : "قراءات التربة",
    liveSub: isEn ? "Last Update" : "آخر تحديث",
    soilTemp: isEn ? "Soil Temperature" : "حرارة التربة",
    soilMoist: isEn ? "Soil Moisture" : "رطوبة التربة",
    soilRecs: isEn ? "Soil Recommendations" : "توصيات التربة",
    smartAnalysis: isEn ? "Smart Analysis" : "تحليل ذكي",
    bioTitle: isEn ? "Soil Condition Readings" : "قراءات حالة التربة",
    bioSub: isEn ? "Sensor data log." : "سجل البيانات للحساسات",
    tempChart: isEn ? "Soil Temperature" : "حرارة التربة",
    moistChart: isEn ? "Soil Moisture" : "رطوبة التربة",
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
    const today = new Date();
    const displayDate = today.toLocaleDateString(isEn ? 'en-US' : 'ar-SA');
    const fileDate = today.toISOString().slice(0, 10);
    const reportRows = [
      ...sectionRows(
        isEn ? 'Current Readings' : 'القراءات الحالية',
        isEn ? ['Metric', 'Value', 'Unit', 'Export Date'] : ['المؤشر', 'القيمة', 'الوحدة', 'تاريخ التصدير'],
        [
          [T.soilTemp, soilTemp.toFixed(1), '°C', displayDate],
          [T.soilMoist, soilMoist.toFixed(0), '%', displayDate],
          [isEn ? 'Automation Mode' : 'وضع الأتمتة', globalAutoMode ? (isEn ? 'Auto' : 'تلقائي') : (isEn ? 'Manual' : 'يدوي'), '', displayDate],
          [isEn ? 'Pump State' : 'حالة المضخة', pumpRunning ? (isEn ? 'Running' : 'تعمل') : (isEn ? 'Idle' : 'متوقفة'), '', displayDate],
          [isEn ? 'Irrigation Feedback' : 'ملاحظة الري', irrigationFeedback || '', '', displayDate]
        ]
      ),
      ...sectionRows(
        isEn ? 'Recommendations' : 'التوصيات',
        isEn ? ['Message', 'Reasoning', 'Severity', 'Created At'] : ['التوصية', 'السبب', 'الأولوية', 'تاريخ الإنشاء'],
        soilRecs.map(rec => [
          rec.text || '',
          rec.reasoning || '',
          rec.severity || '',
          formatReportTimestamp(rec.created_at, isEn)
        ])
      ),
      ...sectionRows(
        isEn ? 'Complete Historical Chart Data' : 'بيانات الرسم التاريخية الكاملة',
        isEn
          ? ['Timestamp', 'Soil Temperature', 'Soil Moisture']
          : ['الوقت', 'حرارة التربة', 'رطوبة التربة'],
        buildHistoryRows([
          { label: 'soil_temperature', data: allRawSoilTemp },
          { label: 'soil_moisture', data: allRawSoilMoist }
        ], isEn)
      )
    ];

    downloadCsvReport({
      title: isEn ? 'Soil Vitality Report' : 'تقرير حيوية التربة',
      fileName: isEn ? `soil_vitality_report_${fileDate}.csv` : `تقرير_التربة_${fileDate}.csv`,
      headers: [],
      rows: reportRows
    });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeFarm]);

  const [range, setRange] = useState("D");
  const { data: localSensors2 } = useLatestSensors(3000, farmId);
  const livesensors2 = sharedSensors || localSensors2;
  const soilTemp  = livesensors2?.soil_temperature ?? 0;
  const soilMoist = livesensors2?.soil_moisture    ?? 0;
  const lastUpdateLabel = formatLastUpdated(seconds, T.lastUpdateAr, T.lastUpdateEn);

  const historySince2 = (() => {
    const now = new Date();
    if (range === 'D') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === 'W') { const d = new Date(now); d.setDate(now.getDate() - now.getDay()); d.setHours(0,0,0,0); return d; }
    if (range === 'M') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (range === 'Y') return new Date(now.getFullYear(), 0, 1);
    return null;
  })();
  const chartBucket2 = range === 'D' ? 'minute' : range === 'Y' ? 'month' : 'day';
  const reportSince2 = (() => {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1);
  })();
  const { data: rawSoilTemp } = useSensorHistory('soil_temperature', 0, 1800000, historySince2, { bucket: chartBucket2 });
  const { data: rawSoilMoist } = useSensorHistory('soil_moisture', 0, 1800000, historySince2, { bucket: chartBucket2 });
  const { data: allRawSoilTemp } = useSensorHistory('soil_temperature', 0, 0, reportSince2, { bucket: 'minute' });
  const { data: allRawSoilMoist } = useSensorHistory('soil_moisture', 0, 0, reportSince2, { bucket: 'minute' });

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
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const buckets = Array.from({ length: daysInMonth }, () => []);
      rawData?.forEach(r => {
        const d = new Date(r.timestamp);
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
          buckets[d.getDate() - 1].push(r.value || 0);
        }
      });
      return buckets.map((items, i) => {
        const value = items.length > 0 ? items.reduce((s, v) => s + v, 0) / items.length : 0;
        return { label: `${i + 1}`, value: Math.round(value) };
      });
    }
    if (range === 'Y') {
      const buckets = Array.from({ length: 12 }, () => []);
      rawData?.forEach(r => {
        const d = new Date(r.timestamp);
        if (d.getFullYear() === now.getFullYear()) {
          buckets[d.getMonth()].push(r.value || 0);
        }
      });
      return buckets.map((items, i) => {
        const label = isEn ? monthsEn[i] : monthsAr[i];
        const value = items.length > 0 ? items.reduce((s, v) => s + v, 0) / items.length : 0;
        return { label, value: Math.round(value) };
      });
    }
    return [];
  };

  const soilTempSeries = useMemo(() => formatPoints(rawSoilTemp), [rawSoilTemp, range, isEn]);
  const soilMoistSeries = useMemo(() => formatPoints(rawSoilMoist), [rawSoilMoist, range, isEn]);


  const recentRecommendationsSince = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const { data: apiRecs } = useRecommendations(farmId, { since: recentRecommendationsSince });
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const soilRecs = useMemo(() => {
    if (!apiRecs) return [];
    return apiRecs
      .filter(r => {
        const category = String(r.category || r.type || '').toLowerCase();
        const sourceSensor = String(r.source_sensor_type || r.sensor_type || '').toLowerCase();
        const text = `${r.message || ''} ${r.data_insight || ''} ${r.reasoning || ''}`.toLowerCase();
        return ['soil', 'soil_moisture', 'soil_temperature', 'irrigation'].includes(category)
          || ['soil_moisture', 'soil_temperature'].includes(sourceSensor)
          || (category === 'irrigation' && (sourceSensor.includes('soil') || text.includes('soil') || text.includes('تربة')));
      })
      .filter(r => {
        const itemId = `${r.source || 'recommendation'}-${r.id}`;
        return !handledRecommendationIds.includes(itemId) && !handledRecommendationIds.includes(r.id);
      })
      .map(r => ({
        id: `${r.source || 'recommendation'}-${r.id}`,
        rawId: r.id,
        source: r.source || 'recommendation',
        text: r.message,
        reasoning: r.data_insight || r.reasoning || r.message,
        category: r.category || r.type || 'soil',
        action_status: r.action_status,
        decision_state: r.decision_state,
        feedback: r.helpful === true ? 'up' : r.helpful === false ? 'down' : null,
        severity: r.severity,
        created_at: r.created_at
      }));
  }, [apiRecs, handledRecommendationIds]);

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
                <div className="text-[12px] font-medium text-gray-400 mt-1 mb-2">{isEn ? 'Suggested actions for root health.' : 'إجراءات مقترحة للحفاظ على صحة وسلامة التربة.'}</div>
              </div>
              <div className={`flex flex-col gap-3 flex-1 max-h-[400px] overflow-y-auto scrollbar-neutral ${isRtl ? 'pl-2' : 'pr-2'}`}>
                {soilRecs.length > 0 ? (
                  soilRecs.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      rec={{
                        id: rec.id,
                        rawId: rec.rawId,
                        title: rec.text,
                        message: rec.text,
                        reasoning: rec.reasoning,
                        category: rec.category,
                        severity: rec.severity || 'normal',
                        created_at: rec.created_at,
                        action_status: rec.action_status,
                        decision_state: rec.decision_state
                      }}
                      farmId={farmId}
                      globalAutoMode={globalAutoMode}
                      isEn={isEn}
                      onExecute={executeRecommendation}
                      onActionChange={(id, status) => submitRecommendationAction(farmId, id, status)}
                      autoDismissOnAction={true}
                      onDismiss={(id) => setHandledRecommendationIds(prev => [...new Set([...prev, id])])}
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
