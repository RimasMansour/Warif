import { useMemo, useState, useEffect } from 'react';
import { translations } from '../../i18n';
import { SensorTopBar, CardShell, IrrigationSmartIcon, EmptyState } from './DashboardShared';
import { IrrigationActionButton, SustainabilityLineChart } from './DashboardCharts';
import { formatLastUpdated } from './dashboardUtils';
import { useLatestSensors, useIrrigationStatus, useIrrigationPrediction, useSensorHistory, useIrrigationResources, useRecommendations } from '../../hooks/useWarifData';
import { getLabelForRange } from './dashboardUtils';
import { stopFarmIrrigation, triggerAutoIrrigation } from '../../services/api';

function LastUpdatedTimer({ seconds, ar, en, isEn }) {
  const [localSec, setLocalSec] = useState(seconds);
  useEffect(() => {
    const interval = setInterval(() => setLocalSec(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  return <div className="text-[12px] text-gray-400 mt-1 font-medium">{formatLastUpdated(localSec, ar, en)}</div>;
}

export function IrrigationPage({ onBack, globalAutoMode, activeFarm, onOpenManual, sharedSensors }) {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  const T = {
    // ... translations ...
    title: isEn ? "Irrigation Management" : "إدارة الري",
    subtitle: isEn ? "Smart water and energy management via real-time analysis." : "إدارة ذكية لموارد المياه والطاقة عبر التحليل اللحظي لبيئة المحمية.",
    flowRate: isEn ? "Live Flow Rate" : "معدل التدفق اللحظي",
    latestRecs: isEn ? "Smart Recommendations" : "أحدث التوصيات الذكية",
    realTime: isEn ? "Real-time" : "تحليل فوري",
    dssSub: isEn ? "Justification for current irrigation decisions." : "تبريرات اتخاذ القرار الحالي للري",
    why: isEn ? "Why?" : "السبب:",
    flowManagement: isEn ? "Water Flow Control" : "إدارة تدفق المياه",
    controlSub: isEn ? "Direct manual control of pumps." : "تحكم يدوي مباشر بالمضخات",
    startManual: isEn ? "Start Manual Irrigation" : "بدء الري اليدوي الآن",
    stopAll: isEn ? "Stop All Valves" : "إيقاف كافة المحابس",
    flushNetwork: isEn ? "Flush Drip Network" : "غسيل شبكة التنقيط",
    totalDailyWater: isEn ? "Total Daily Water Usage" : " الاستهلاك اليومي للمياه",
    totalDailyPower: isEn ? "Daily Power Consumption" : "الاستهلاك اليومي للكهرباء",
    dailyWaterSub: isEn ? "Cumulative water draw since start of day" : "إجمالي سحب المياه التراكمي منذ بداية اليوم",
    dailyPowerSub: isEn ? "Total energy draw since start of day" : "إجمالي سحب الطاقة منذ بداية اليوم",
    fromYesterday: isEn ? "from yesterday" : "من أمس",
    liters: isEn ? "Liters" : "لتر",
    kwh: isEn ? "kWh" : "كيلوواط",
    trendTitle: isEn ? "Unified Resource Consumption Analysis" : "تحليل استهلاك الموارد الموحد",
    xAxisTitle: isEn ? "Time" : "الوقت",
    yAxisTitle: isEn ? "Resource Usage Rate (%)" : "معدل استهلاك الموارد (٪)",
    waterLabel: isEn ? "Water Consumption" : "استهلاك المياه",
    powerLabel: isEn ? "Power Consumption" : "استهلاك الكهرباء",
    lastUpdateAr: "آخر تحديث",
    lastUpdateEn: "Last Update",
    noRecsTitle: isEn ? "Irrigation Under Control" : "عمليات الري تحت السيطرة.",
    noRecsSub: isEn ? "No smart recommendations required at this time." : "لا توجد توصيات ذكية مطلوبة في الوقت الحالي.",
    autoActiveTitle: isEn ? "System Managed Automatically" : "النظام يدار تلقائياً الآن.",
    autoActiveSub: isEn ? "All manual control buttons are locked to maintain greenhouse stability." : "جميع أزرار التحكم اليدوي مقفلة لحفظ استقرار المحمية.",
  };


  const [range, setRange] = useState("M");
  const [activeAction, setActiveAction] = useState("");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeProcessing, setActiveProcessing] = useState(""); 
  const [showSuccess, setShowSuccess] = useState(""); 

  const [feedback, setFeedback] = useState({});
  const [showThanksIds, setShowThanksIds] = useState([]);
  const [recommendationStatus, setRecommendationStatus] = useState({});

  const handleFeedback = (id, type) => {
    setFeedback(prev => ({ ...prev, [id]: type }));
    setShowThanksIds(prev => [...prev, id]);
    setTimeout(() => setShowThanksIds(prev => prev.filter(i => i !== id)), 2000);
  };

  const handleRecommendationDecision = (id, decision) => {
    setRecommendationStatus(prev => ({ ...prev, [id]: decision }));
  };

  const { data: localSensors } = useLatestSensors(10000);
  const livesensors = sharedSensors || localSensors;
  const farmId = JSON.parse(localStorage.getItem('warif_user') || '{}').farmId || 1;
  const { data: irrigationData } = useIrrigationStatus(farmId);
  const { data: resourceData } = useIrrigationResources(farmId, 15000);
  const { data: mlPrediction } = useIrrigationPrediction(farmId, livesensors);

  const [autoTriggered, setAutoTriggered] = useState(false);

  // UX Improvement: Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (globalAutoMode && mlPrediction?.irrigation_needed && !autoTriggered && irrigationData?.status !== 'active') {
      setAutoTriggered(true);
      triggerAutoIrrigation(farmId, 15)
        .then(() => setTimeout(() => setAutoTriggered(false), 60000))
        .catch(() => setAutoTriggered(false));
    }
  }, [globalAutoMode, mlPrediction, irrigationData, farmId, autoTriggered]);
  
  const currentFlow = irrigationData?.status === 'active' ? 75 : 0;
  const waterUsage  = resourceData?.water_usage_liters ?? 0;
  const powerUsage  = resourceData?.power_usage_kwh ?? 0;

  const historyLimit = range === 'D' ? 24 : range === 'W' ? 7 : range === 'M' ? 30 : 12;
  const { data: rawWater } = useSensorHistory('water_usage', historyLimit);
  const { data: rawPower } = useSensorHistory('power_usage', historyLimit);

  const { data: apiRecs } = useRecommendations(farmId);
  const recommendations = useMemo(() => {
    if (!apiRecs) return [];
    return apiRecs
      .filter(r => r.category === 'irrigation')
      .map(r => ({
        text: r.message,
        reasoning: r.reasoning || r.message
      }));
  }, [apiRecs]);

  const dualSeries = useMemo(() => {
    const targetLen = range === 'D' ? 24 : range === 'W' ? 7 : range === 'M' ? 30 : 12;
    const points = Array.from({ length: targetLen }, (_, i) => ({
      label: (() => {
        const daysAr = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
        const daysEn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
        const monthsEn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        if (range === 'D') return `${i}:00`;
        if (range === 'W') return isEn ? daysEn[i % 7] : daysAr[i % 7];
        if (range === 'M') return `${i + 1}`;
        if (range === 'Y') return isEn ? monthsEn[i % 12] : monthsAr[i % 12];
        return `${i}`;
      })(),
      water: 0,
      power: 0,
      value: 0,
      hasData: false
    }));

    // Function to map a timestamp to the correct fixed index
    const getIndex = (ts) => {
      const d = new Date(ts);
      if (range === 'D') return d.getHours();
      if (range === 'W') return d.getDay(); // 0=Sun, 6=Sat
      if (range === 'M') return Math.min(targetLen - 1, d.getDate() - 1);
      if (range === 'Y') return d.getMonth();
      return -1;
    };

    // Fill data into the fixed slots
    rawWater?.forEach(item => {
      const idx = getIndex(item.timestamp);
      if (idx >= 0 && idx < targetLen) {
        points[idx].water = item.value;
        points[idx].value = item.value;
        points[idx].hasData = true;
      }
    });

    rawPower?.forEach(item => {
      const idx = getIndex(item.timestamp);
      if (idx >= 0 && idx < targetLen) {
        points[idx].power = item.value;
        points[idx].hasData = true;
      }
    });

    return points;
  }, [rawWater, rawPower, range, isEn]);


  return (
    <div className="w-full px-4 md:px-8 py-5 page-enter" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-[1150px] mx-auto flex flex-col gap-6">

        <SensorTopBar
          title={T.title}
          subtitle={T.subtitle}
          icon={<IrrigationSmartIcon />}
          onBack={onBack}
          onExport={() => {
            const dateStr = new Date().toLocaleDateString(isEn ? 'en-US' : 'ar-SA');
            const csvPrefix = isEn ? "Resource Consumption Report\nPower,Water,Date\n" : "\ufeffتقرير استهلاك الموارد\nطاقة,مياه,التاريخ\n";
            const csv = csvPrefix + "100,200," + dateStr;
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", isEn ? `irrigation_report_${dateStr}.csv` : `تقرير_الري_${dateStr}.csv`);
            link.click();
          }}
          T={translations[lang]}
          isRtl={isRtl}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="animate-fade-in-up delay-1 h-full">
            <CardShell className="p-6 h-full card-interactive overflow-hidden relative">
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-emerald-50 rounded-full blur-3xl opacity-60 animate-pulse" />
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight flex items-center justify-between">
                  {T.flowRate}
                </div>
                <LastUpdatedTimer seconds={0} ar={T.lastUpdateAr} en={T.lastUpdateEn} isEn={isEn} />
              </div>

              <div className="mt-8 flex items-center justify-center relative">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-100/50" />
                    <circle
                      cx="50" cy="50" r="42" stroke={`url(#flowGradPage-${currentFlow})`} strokeWidth="8"
                      strokeDasharray={264} strokeDashoffset={264 - (264 * Math.round(currentFlow)) / 100}
                      strokeLinecap="round" fill="transparent" className="transition-all duration-1000 ease-out"
                    />
                    <defs>
                      <linearGradient id={`flowGradPage-${currentFlow}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={currentFlow > 0 ? "#10b981" : "#ef4444"} />
                        <stop offset="100%" stopColor={currentFlow > 0 ? "#3b82f6" : "#f87171"} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className={`text-3xl font-black tracking-tighter ${currentFlow > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {currentFlow > 0 ? "ON" : "OFF"}
                    </span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{isEn ? "Flow" : "تدفق"}</span>
                  </div>
                </div>
              </div>

              <div className={`mt-4 text-center text-[11px] font-medium leading-relaxed px-2 ${currentFlow === 0 ? 'text-gray-400' : 'text-emerald-700'}`}>
                {currentFlow === 0 
                  ? (isEn ? "No water flow detected. Pump is idle." : "لا يوجد تدفق مياه حالياً. المضخة في وضع الاستعداد.")
                  : (isEn ? "Water is flowing actively through the network." : "المياه تتدفق بشكل نشط عبر الشبكة الآن.")}
              </div>
            </CardShell>
          </div>

          <div className="animate-fade-in-up delay-2 h-full">
            <CardShell className="p-6 h-full card-interactive">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                  {T.latestRecs} 
                  <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-lg border border-emerald-200/50 font-black tracking-tighter uppercase">{T.realTime}</span>
                </div>
                <div className="text-[12px] text-gray-400 mt-1 font-medium">{T.dssSub}</div>
              </div>
              <ul className="mt-6 flex flex-col gap-5 flex-1 max-h-[400px] overflow-y-auto">
                {recommendations.length > 0 ? (
                  recommendations.map((rec, i) => (
                    <li key={i} className={`p-4 rounded-xl border bg-emerald-50/30 border-emerald-100/50 animate-fade-in ${isRtl ? 'text-right' : 'text-left'}`}>
                      <div className={`flex flex-col justify-between gap-5`}>
                        
                        {/* أزرار التقييم على اليسار دائماً */}
                        <div className="flex items-start gap-5">
                          <div className="flex flex-col items-center gap-3 min-w-[80px]">
                            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center mb-1">
                              {isEn ? 'Rate' : 'تقييم'}
                            </div>
                            <div className="flex flex-col items-center gap-2">
                              <button
                                onClick={() => handleFeedback(rec.id || i, 'up')}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${feedback[rec.id || i] === 'up' ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50'}`}
                                title={isEn ? 'Helpful' : 'مفيدة'}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/></svg>
                              </button>
                              <button
                                onClick={() => handleFeedback(rec.id || i, 'down')}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${feedback[rec.id || i] === 'down' ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50'}`}
                                title={isEn ? 'Not helpful' : 'غير مفيدة'}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                              </button>
                            </div>

                            {/* Feedback Confirmation */}
                            {showThanksIds.includes(rec.id || i) && (
                              <div className="mt-2 text-center text-[8px] font-bold text-emerald-700 animate-fade-in">
                                {isEn ? 'Thanks!' : 'شكراً!'}
                              </div>
                            )}
                          </div>

                          <div className="flex-1">
                            {/* العنوان */}
                            <div className={`flex items-start gap-2 mb-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                              <h4 className={`text-[14px] font-black leading-tight text-emerald-700`}>
                                {isEn ? 'Recommendation:' : 'التوصية:'} {rec.text}
                              </h4>
                            </div>

                            {/* التحليل */}
                            {rec.reasoning && (
                              <div className="bg-gray-50/50 rounded-2xl p-3 border border-gray-100/50 mb-3">
                                <div className="text-[12px] font-bold text-gray-800 mb-1">{isEn ? 'Analysis:' : 'التحليل:'}</div>
                                <div className="text-[12px] text-gray-800 leading-relaxed">{rec.reasoning}</div>
                              </div>
                            )}

                            {/* التوصية أو الإجراء */}
                            <div className="bg-emerald-50/30 rounded-2xl p-3 border border-emerald-100/50">
                              <div className="text-[12px] font-bold text-emerald-800 mb-1">{isEn ? 'Action:' : 'الإجراء:'}</div>
                              <div className="text-[12px] text-gray-800 leading-relaxed">{rec.text}</div>
                            </div>

                            {/* النتيجة المتوقعة */}
                            {rec.benefit && (
                              <div className="bg-purple-50/30 rounded-2xl p-3 border border-purple-100/50 mt-3">
                                <div className="text-[12px] font-bold text-purple-800 mb-1">{isEn ? 'Expected Result:' : 'النتيجة المتوقعة:'}</div>
                                <div className="text-[12px] text-gray-800 leading-relaxed">{rec.benefit}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* الزرين الإضافية في المود اليدوي */}
                        {!globalAutoMode && (
                          <div className="flex flex-col gap-2 mt-4">
                            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center mb-1">
                              {isEn ? 'Execute Now' : 'نفذ الآن'}
                            </div>
                            {recommendationStatus[rec.id || i] ? (
                              <div className={`px-4 py-2 rounded-xl text-[12px] font-black text-center border ${recommendationStatus[rec.id || i] === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                {recommendationStatus[rec.id || i] === 'accepted' ? (isEn ? 'Executed' : 'تم التنفيذ') : (isEn ? 'Ignored' : 'تم التجاهل')}
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleRecommendationDecision(rec.id || i, 'accepted')}
                                  className="flex-1 px-3 py-2 bg-emerald-600 text-white text-[11px] font-black rounded-lg hover:bg-emerald-700 transition-all shadow-sm active:scale-95 flex items-center justify-center"
                                >
                                  {isEn ? 'Execute' : 'نفذ'}
                                </button>
                                <button 
                                  onClick={() => handleRecommendationDecision(rec.id || i, 'rejected')}
                                  className="flex-1 px-3 py-2 bg-white border border-gray-100 text-gray-500 text-[11px] font-bold rounded-lg hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center"
                                >
                                  {isEn ? 'Ignore' : 'تجاهل'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  ))
                ) : (
                  <EmptyState compact={true} title={T.noRecsTitle} subtitle={T.noRecsSub} />
                )}
              </ul>
            </CardShell>
          </div>

          <div className="animate-fade-in-up delay-3 h-full">
            <CardShell className="p-6 h-full card-interactive">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight">{T.flowManagement}</div>
                <div className="text-[12px] text-gray-400 mt-1 font-medium mb-5">{T.controlSub}</div>
              </div>

              {globalAutoMode ? (
                <EmptyState 
                  compact={true} variant="success" title={T.autoActiveTitle} subtitle={T.autoActiveSub}
                  icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                />
              ) : (
                <div className="mt-6 flex flex-col gap-3">
                  <IrrigationActionButton 
                    active={activeAction === "irrigate"} onClick={() => onOpenManual && onOpenManual()}
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>} isRtl={isRtl}
                  >
                    <span className="text-[14px] font-black">{T.startManual}</span>
                  </IrrigationActionButton>
                  
                  <IrrigationActionButton 
                    active={activeAction === "stop"} 
                    onClick={async () => {
                      setActiveAction("stop"); setIsProcessing(true); setActiveProcessing("stop");
                      try {
                        await stopFarmIrrigation(farmId);
                        setIsProcessing(false); setShowSuccess("stop");
                        setTimeout(() => setShowSuccess(""), 6000);
                      } catch (e) { setIsProcessing(false); }
                    }}
                    icon={isProcessing && activeProcessing === "stop" ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>}
                    isRtl={isRtl}
                  >
                    <span className="text-[14px] font-black">{isProcessing && activeProcessing === "stop" ? (isEn ? "Stopping..." : "جاري الإيقاف...") : T.stopAll}</span>
                  </IrrigationActionButton>
                  {showSuccess === "stop" && (
                    <div className="mt-2 px-4 py-2.5 rounded-2xl border text-xs font-black flex items-center gap-2 animate-pulse bg-red-50 text-red-700 border-red-100">
                      <span>{isEn ? "All Valves Closed" : "تم إغلاق كافة المحابس"}</span>
                    </div>
                  )}
                </div>
              )}
            </CardShell>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="animate-fade-in-up delay-4 h-full">
            <CardShell className="p-6 relative overflow-hidden bg-white border border-gray-100/50 h-full card-interactive">
              <div className="flex items-center justify-between mb-4">
                <div className={isRtl ? 'text-right' : 'text-left'}>
                  <div className="text-lg font-bold text-gray-800 tracking-tight">{T.totalDailyWater}</div>
                  <div className="text-[12px] text-gray-400 font-medium mt-0.5">{T.dailyWaterSub}</div>
                </div>
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100/30 shadow-sm"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg></div>
              </div>
              <div className="flex items-center justify-between">
                 <div className="text-4xl font-black text-blue-600 tracking-tight">{waterUsage} <span className="text-sm font-bold text-gray-400">{T.liters}</span></div>
                 <div className={`text-xs font-black px-2.5 py-1 rounded-lg border shadow-sm ${ (resourceData?.water_diff_percent || 0) <= 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-700 bg-red-50 border-red-100'}`}>
                   {resourceData?.water_diff_percent !== undefined ? `${resourceData.water_diff_percent > 0 ? '+' : ''}${resourceData.water_diff_percent}%` : '-12%'} {T.fromYesterday}
                 </div>
              </div>
              <div className="mt-6">
                <div className="h-3.5 w-full bg-blue-50 rounded-full overflow-hidden shadow-inner relative">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.4)]" style={{ width: `${Math.min(100, (waterUsage / 500) * 100)}%` }} />
                </div>
              </div>
            </CardShell>
          </div>

          <div className="animate-fade-in-up delay-5 h-full">
            <CardShell className="p-6 relative overflow-hidden bg-white border border-gray-100/50 h-full card-interactive">
              <div className="flex items-center justify-between mb-4">
                <div className={isRtl ? 'text-right' : 'text-left'}>
                  <div className="text-lg font-bold text-gray-800 tracking-tight">{T.totalDailyPower}</div>
                  <div className="text-[12px] text-gray-400 font-medium mt-0.5">{T.dailyPowerSub}</div>
                </div>
                <div className="w-10 h-10 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center border border-yellow-100/30 shadow-sm"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
              </div>
              <div className="flex items-center justify-between">
                 <div className="text-4xl font-black text-yellow-600 tracking-tight">{powerUsage} <span className="text-sm font-bold text-gray-400">{T.kwh}</span></div>
                 <div className={`text-xs font-black px-2.5 py-1 rounded-lg border shadow-sm ${ (resourceData?.power_diff_percent || 0) <= 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-700 bg-red-50 border-red-100'}`}>
                   {resourceData?.power_diff_percent !== undefined ? `${resourceData.power_diff_percent > 0 ? '+' : ''}${resourceData.power_diff_percent}%` : '-5%'} {T.fromYesterday}
                 </div>
              </div>
              <div className="mt-6">
                <div className="h-3.5 w-full bg-yellow-50 rounded-full overflow-hidden shadow-inner relative">
                  <div className="h-full bg-yellow-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(234,179,8,0.4)]" style={{ width: `${Math.min(100, (powerUsage / 50) * 100)}%` }} />
                </div>
              </div>
            </CardShell>
          </div>
        </div>

        <div className="animate-fade-in-up delay-6 mb-4">
           <SustainabilityLineChart 
             range={range} onRangeChange={setRange} data={dualSeries} metricName={T.trendTitle}
             xAxisTitle={T.xAxisTitle} yAxisTitle={T.yAxisTitle} T={translations[lang]} isRtl={isRtl}
           />
        </div>
      </div>
    </div>
  );
}
