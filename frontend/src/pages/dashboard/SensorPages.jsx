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
import { HealthStyleBarChart, IrrigationActionButton } from './DashboardCharts';

import {
  generateDataForRange,
  formatLastUpdated
} from './dashboardUtils';
import { useLatestSensors, triggerManualCooling, triggerManualIrrigation, useSensorHistory, useRecommendations, executeRecommendation, submitRecommendationFeedback } from '../../hooks/useWarifData';
import { getLabelForRange } from './dashboardUtils';

/* =========================================================
   1. Microclimate Module (المناخ والتهوية)
========================================================= */
function LightAreaChart({ data, range, onRangeChange, T, isRtl }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const ranges = [
    { key: 'D', label: T.day || 'اليوم' },
    { key: 'W', label: T.week || 'الأسبوع' },
    { key: 'M', label: T.month || 'الشهر' },
    { key: 'Y', label: T.year || 'السنة' },
  ];
  const n = data.length;
  const maxVal = Math.max(...data.map(d => d.value), 100);
  const currentVal = range === 'D'
    ? Math.max(...data.map(d => d.value), 0)
    : (data.reduce((a, b) => a + b.value, 0) / (n || 1));
  const W = 860, H = 360, padL = 120, padR = 80, padT = 24, padB = 82;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const points = data.map((d, i) => ({
    x: padL + (i / Math.max(n - 1, 1)) * chartW,
    y: padT + chartH - (d.value / maxVal) * chartH,
    value: d.value,
    label: d.label,
  }));
  const linePath = points.length < 2 ? '' : points.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `C ${cpx} ${prev.y} ${cpx} ${p.y} ${p.x} ${p.y}`;
  }).join(' ');
  const areaPath = linePath
    ? `${linePath} L ${points[n - 1]?.x} ${padT + chartH} L ${padL} ${padT + chartH} Z`
    : '';
  const getColor = (val) => {
    if (val === 0) return '#9ca3af';
    if (val < 1000) return '#fde68a';
    if (val < 10000) return '#f59e0b';
    if (val < 50000) return '#f97316';
    return '#ef4444';
  };
  const getLabel = (val) => {
    if (val === 0) return isRtl ? 'لا يوجد إضاءة' : 'No light';
    if (val < 200) return isRtl ? 'خافتة جداً' : 'Very dim';
    if (val < 1000) return isRtl ? 'إضاءة داخلية' : 'Indoor';
    if (val < 10000) return isRtl ? 'مضيئة' : 'Bright';
    if (val < 50000) return isRtl ? 'مشرقة جداً' : 'Very bright';
    return isRtl ? 'ضوء شمس مباشر' : 'Direct sunlight';
  };
  const lineColor = getColor(currentVal);
  return (
    <CardShell className="p-5" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center mb-4">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-black text-gray-800 leading-none">
              {T.lightChart || 'مسار شدة الإضاءة'}
            </h2>
            <span className="bg-amber-50 text-amber-600 text-xs px-2 py-0.5 rounded-lg border border-amber-100 font-black uppercase tracking-tighter">
              {T.realtimeAnalysis || 'تحليل فوري'}
            </span>
          </div>
          <div className="text-[13px] font-bold text-gray-400">{getLabel(currentVal)}</div>
        </div>
        <div className="flex flex-col items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm min-w-[110px]">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-gray-800">{Math.round(currentVal).toLocaleString()}</span>
            <span className="text-[11px] font-bold text-gray-400">Lux</span>
          </div>
          <div className="text-[10px] font-black mt-1 uppercase tracking-tighter" style={{ color: lineColor }}>
            {T.periodAverage || 'متوسط الفترة'}
          </div>
        </div>
      </div>
      <div className="flex bg-gray-50 p-1 rounded-xl mb-4 gap-1 w-max mx-auto border border-gray-100 shadow-inner">
        {ranges.map(r => (
          <button key={r.key} onClick={() => onRangeChange(r.key)}
            className={`px-5 py-2 text-xs font-black rounded-lg transition-all duration-300 ${range === r.key ? 'bg-white text-gray-800 shadow-md scale-[1.02]' : 'text-gray-400 hover:text-gray-600'}`}>
            {r.label}
          </button>
        ))}
      </div>
      <div className="w-full max-w-[800px] mx-auto" style={{ maxHeight: '360px' }} onMouseLeave={() => setHoveredIdx(null)}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="block w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="lightAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.3"/>
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.02"/>
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const val = maxVal * ratio;
            const y = padT + chartH - ratio * chartH;
            return (
              <g key={i}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4"/>
                <text x={padL - 45} y={y} dominantBaseline="central" textAnchor="end" fontSize="16" fill="#94a3b8" fontWeight="bold">
                  {val >= 100000
                    ? `${(val / 1000).toFixed(0)}k`
                    : val >= 1000
                    ? `${(val / 1000).toFixed(1)}k`
                    : Math.round(val)}
                </text>
              </g>
            );
          })}
          <text x={40} y={padT + chartH / 2} transform={`rotate(-90, 40, ${padT + chartH / 2})`} textAnchor="middle" fontSize="18" fill="#059669" fontWeight="900" opacity="0.6">
            {isRtl ? 'لوكس' : 'Lux'}
          </text>
          {areaPath && <path d={areaPath} fill="url(#lightAreaGrad)"/>}
          {linePath && <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
          {points.map((p, i) => {
            const show = i % Math.max(1, Math.floor(n / 8)) === 0;
            const isHov = hoveredIdx === i;
            return (
              <g key={i} onMouseEnter={() => setHoveredIdx(i)}>
                <rect x={p.x - 10} y={padT} width={20} height={chartH} fill="transparent" className="cursor-pointer"/>
                {(show || isHov) && (
                  <circle cx={p.x} cy={p.y} r={isHov ? 6 : 3} fill={isHov ? lineColor : '#fff'} stroke={lineColor} strokeWidth="2" className="transition-all duration-200"/>
                )}
                {isHov && (
                  <g pointerEvents="none">
                    <line x1={p.x} y1={padT} x2={p.x} y2={padT + chartH} stroke={lineColor} strokeWidth="1" strokeDasharray="4 3" opacity="0.5"/>
                    <rect x={p.x - 52} y={p.y - 54} width={104} height={38} rx="10" fill="#111827" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.25))"/>
                    <text x={p.x} y={p.y - 30} textAnchor="middle" fontSize="11" fontWeight="900" fill="white">
                      {Math.round(p.value).toLocaleString()} Lux
                    </text>
                    <path d={`M ${p.x - 6} ${p.y - 16} L ${p.x} ${p.y - 8} L ${p.x + 6} ${p.y - 16} Z`} fill="#111827"/>
                  </g>
                )}
              </g>
            );
          })}
          {points.map((p, i) => {
            const show = i % Math.max(1, Math.floor(n / 6)) === 0;
            return show ? (
              <text key={i} x={p.x} y={H - padB + 34} textAnchor="middle" fontSize="14" fill="#94a3b8" fontWeight="bold">
                {p.label}
              </text>
            ) : null;
          })}
          <text
            x={padL + chartW / 2}
            y={H - 10}
            textAnchor="middle"
            fontSize="18"
            fill="#059669"
            fontWeight="900"
            opacity="0.6"
          >
            {isRtl ? 'الوقت' : 'Time'}
          </text>
          <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#e2e8f0" strokeWidth="2"/>
          <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#e2e8f0" strokeWidth="2"/>
        </svg>
      </div>
    </CardShell>
  );
}

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

  const historyLimit = range === 'D' ? 2000 : range === 'W' ? 20000 : range === 'M' ? 45000 : 50000;
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
        const items = rawData?.filter(r => {
          const d = new Date(r.timestamp);
          const localHour = (d.getUTCHours() + 3) % 24;
          return localHour === i;
        }) || [];
        const value = items.length > 0
          ? items.reduce((sum, r) => sum + (r.value || 0), 0) / items.length
          : 0;
        return { label, value: Math.round(value) };
      });
    }
    if (range === 'W') {
      const now = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() - (6 - i));
        const dayOfWeek = targetDate.getDay();
        const label = isEn ? daysEn[dayOfWeek] : daysAr[dayOfWeek];
        const items = rawData?.filter(r => {
          const d = new Date(r.timestamp);
          return d.getDate() === targetDate.getDate() &&
                 d.getMonth() === targetDate.getMonth();
        }) || [];
        const value = items.length > 0
          ? items.reduce((sum, r) => sum + (r.value || 0), 0) / items.length
          : 0;
        return { label, value: Math.round(value) };
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
                  <span className="text-[13px] font-bold text-gray-500 group-hover:text-gray-700">
                    {isEn ? 'Light Intensity' : 'شدة الإضاءة'}
                  </span>
                  <span className="text-2xl font-black text-gray-800">
                    {Math.round(light).toLocaleString()}
                    <span className="text-[14px] font-bold text-gray-400 mr-1">Lux</span>
                  </span>
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
              <div className="flex flex-col gap-3 flex-1 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
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
              <div className="flex flex-col gap-3 flex-1 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
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
