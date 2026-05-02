import { useMemo, useState, useEffect } from 'react';
import { translations } from '../../i18n';
import { SensorTopBar, CardShell, IrrigationSmartIcon, EmptyState } from './DashboardShared';
import { IrrigationActionButton, IrrigationDonut, SustainabilityLineChart } from './DashboardCharts';
import { formatLastUpdated } from './dashboardUtils';
import { useLatestSensors, useIrrigationStatus, useIrrigationPrediction, useSensorHistory, useIrrigationResources, useRecommendations } from '../../hooks/useWarifData';
import { getLabelForRange } from './dashboardUtils';
import { stopIrrigation, stopFarmIrrigation, triggerAutoIrrigation } from '../../services/api';

export function IrrigationPage({ onBack, globalAutoMode, activeFarm, onOpenManual, sharedSensors }) {
  const [seconds, setSeconds] = useState(0);

  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  const T = {
    title: isEn ? "Irrigation Management" : "إدارة الري",
    subtitle: isEn ? "Smart water and energy management via real-time analysis." : "إدارة ذكية لموارد المياه والطاقة عبر التحليل اللحظي لبيئة المحمية.",
    flowRate: isEn ? "Live Flow Rate" : "معدل التدفق اللحظي",
    latestRecs: isEn ? "Smart Recommendations" : "أحدث التوصيات الذكية",
    realTime: isEn ? "Real-time" : "تحليل فوري",
    dssSub: isEn ? "Justification for current irrigation decisions." : "تبريرات اتخاذ القرار الحالي للري",
    why: isEn ? "Why?" : "السبب:",
    rec1Title: isEn ? "Irrigation Within Optimal Range" : "معدل الري ضمن النطاق المثالي",
    rec1Desc: isEn ? "Continue current settings based on stable soil moisture." : "يُنصح بالاستمرار على الإعدادات الحالية بناءً على رطوبة التربة المستقرة.",
    rec2Title: isEn ? "Avoid Peak-Hour Manual Irrigation" : "تجنب الري اليدوي وقت الذروة",
    rec2Desc: isEn ? "Reduce evaporation loss under thermal restriction (12–15)." : "تقليل الفاقد بالتبخر وتحت تأثير الحظر الحراري (12–15).",
    flowManagement: isEn ? "Water Flow Control" : "إدارة تدفق المياه",
    controlSub: isEn ? "Direct manual control of pumps." : "تحكم يدوي مباشر بالمضخات",
    autoActive: isEn ? "Automation system schedules irrigation based on actual soil needs." : "نظام الأتمتة يقوم بجدولة الري بناءً على حاجة التربة الفعلية.",
    startManual: isEn ? "Start Manual Irrigation" : "بدء الري اليدوي الآن",
    stopAll: isEn ? "Stop All Valves" : "إيقاف كافة المحابس",
    flushNetwork: isEn ? "Flush Drip Network" : "غسيل شبكة التنقيط",
    totalDailyWater: isEn ? "Total Daily Water Usage" : "إجمالي الاستهلاك اليومي",
    totalDailyPower: isEn ? "Daily Power Consumption" : "الاستهلاك اليومي للكهرباء",
    dailyWaterSub: isEn ? "Cumulative water draw since start of day" : "سحب المياه التراكمي منذ بداية اليوم",
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
    manualSettings: isEn ? "Irrigation Settings" : "إعدادات الري",
    quantity: isEn ? "Quantity (Liters)" : "كمية الري (لتر)",
    durationLabel: isEn ? "Duration (Minutes)" : "مدة الري (بالدقائق)",
    confirmAction: isEn ? "Confirm & Start" : "تأكيد وبدء التشغيل",
    autoActiveTitle: isEn ? "System Managed Automatically" : "النظام يدار تلقائياً الآن.",
    autoActiveSub: isEn ? "All manual control buttons are locked to maintain greenhouse stability." : "جميع أزرار التحكم اليدوي مقفلة لحفظ استقرار المحمية.",
  };

  useEffect(() => {
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeFarm]);

  const [range, setRange] = useState("M");
  const [activeAction, setActiveAction] = useState("");
  
  // Manual Irrigation Settings States
  const [manualAmount, setManualAmount] = useState(50);
  const [duration, setDuration] = useState(15);

  // Feedback states
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeProcessing, setActiveProcessing] = useState(""); // "irrigate", "stop", "flush"
  const [showSuccess, setShowSuccess] = useState(""); // "irrigate", "stop", "flush"
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { data: localSensors } = useLatestSensors(10000);
  const livesensors = sharedSensors || localSensors;
  const farmId = JSON.parse(localStorage.getItem('warif_user') || '{}').farmId || 1;
  const { data: irrigationData } = useIrrigationStatus(farmId);
  const { data: resourceData } = useIrrigationResources(farmId, 15000);
  const { data: mlPrediction } = useIrrigationPrediction(farmId, livesensors);

  // Auto mode: trigger irrigation when ML recommends it
  const [autoTriggered, setAutoTriggered] = useState(false);
  useEffect(() => {
    if (
      globalAutoMode &&
      mlPrediction?.irrigation_needed &&
      !autoTriggered &&
      irrigationData?.status !== 'active'
    ) {
      setAutoTriggered(true);
      triggerAutoIrrigation(farmId, 15)
        .then(() => setTimeout(() => setAutoTriggered(false), 60000))
        .catch(() => setAutoTriggered(false));
    }
  }, [globalAutoMode, mlPrediction, irrigationData, farmId, autoTriggered]);
  
  // Real data only (defaulting to 0 if API hasn't loaded yet)
  const soilMoist = livesensors?.soil_moisture ?? 0;
  const currentFlow = irrigationData?.status === 'active' ? 75 : 0;
  const waterUsage  = resourceData?.water_usage_liters ?? 0;
  const powerUsage  = resourceData?.power_usage_kwh ?? 0;
  const fanActive   = resourceData?.fan_active ?? false;

  // Fetch historical data for charts
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
    const points = [];
    const maxLen = Math.max(rawWater?.length || 0, rawPower?.length || 0);
    const len = Math.max(range === 'D' ? 24 : range === 'W' ? 7 : range === 'M' ? 30 : 12, maxLen);
    
    for (let i = 0; i < len; i++) {
      const wItem = rawWater?.[i];
      const pItem = rawPower?.[i];
      
      let water = wItem?.value ?? 0;
      let power = pItem?.value ?? 0;
      
      let label = getLabelForRange(range, i, wItem?.timestamp || pItem?.timestamp, isEn);
      
      points.push({ label, water, power, value: water }); 
    }
    return points;
  }, [rawWater, rawPower, range, isEn]);


  const lastUpdateLabel = formatLastUpdated(seconds, T.lastUpdateAr, T.lastUpdateEn);

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
              {/* Flow Animation Background Element */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-emerald-50 rounded-full blur-3xl opacity-60 animate-pulse" />
              
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight flex items-center justify-between">
                  {T.flowRate}
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                  </div>
                </div>
                <div className="text-[12px] text-gray-400 mt-1 font-medium">{lastUpdateLabel}</div>
              </div>

              <div className="mt-8 flex items-center justify-center relative">
                <div className="relative w-36 h-36 flex items-center justify-center">
                  {/* Custom Gauge SVG with Dynamic Colors */}
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 176 176">
                    <circle cx="88" cy="88" r="76" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-gray-100/50" />
                    <circle
                      cx="88" cy="88" r="76" stroke={`url(#flowGradient-${Math.round(currentFlow)})`} strokeWidth="10"
                      strokeDasharray={477} strokeDashoffset={477 - (477 * Math.round(currentFlow)) / 100}
                      strokeLinecap="round" fill="transparent" className="transition-all duration-1000 ease-out"
                    />
                    <defs>
                      <linearGradient id={`flowGradient-${Math.round(currentFlow)}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={currentFlow >= 80 ? "#10b981" : currentFlow >= 40 ? "#f59e0b" : "#ef4444"} />
                        <stop offset="100%" stopColor={currentFlow >= 80 ? "#3b82f6" : currentFlow >= 40 ? "#fbbf24" : "#f87171"} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className={`text-3xl font-black tracking-tighter ${currentFlow >= 80 ? 'text-emerald-600' : currentFlow >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                      {Math.round(currentFlow)}%
                    </span>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest mt-0.5">{isEn ? "Live Flow" : "تدفق مباشر"}</span>
                  </div>
                </div>
              </div>

              <div className={`mt-6 ${currentFlow >= 80 ? 'bg-emerald-50/50 border-emerald-100/50' : currentFlow >= 40 ? 'bg-amber-50/50 border-amber-100/50' : 'bg-red-50/50 border-red-100/50'} backdrop-blur-sm border rounded-2xl py-2.5 px-4 flex items-center justify-between shadow-sm`}>
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full animate-ping ${currentFlow >= 80 ? 'bg-emerald-500' : currentFlow >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} />
                   <span className={`text-[12px] font-bold ${currentFlow >= 80 ? 'text-emerald-800' : currentFlow >= 40 ? 'text-amber-800' : 'text-red-800'}`}>{isEn ? "Current Rate" : "المعدل الحالي"}</span>
                </div>
                <span className={`text-[14px] font-black ${currentFlow >= 80 ? 'text-emerald-600' : currentFlow >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{Math.round(currentFlow)}%</span>
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
            {mlPrediction && (
              <div className={`p-4 rounded-2xl border-2 mb-4 ${
                mlPrediction.irrigation_needed 
                  ? 'bg-amber-50 border-amber-200' 
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-black text-gray-800">
                      {isEn ? 'AI Irrigation Decision' : 'قرار الري بالذكاء الاصطناعي'}
                    </div>
                    <div className={`text-[12px] font-bold mt-1 ${
                      mlPrediction.irrigation_needed ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {mlPrediction.irrigation_needed 
                        ? (isEn ? 'Irrigation Needed' : 'يحتاج ري') 
                        : (isEn ? 'No Irrigation Needed' : 'لا يحتاج ري')}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {isEn ? 'Confidence' : 'الثقة'}: {(mlPrediction.confidence * 100).toFixed(0)}%
                      {' | '}{isEn ? 'Model' : 'النموذج'}: {mlPrediction.model_version || mlPrediction.model}
                    </div>
                  </div>
                  <div className={`text-3xl ${
                    mlPrediction.irrigation_needed ? '💧' : '✅'
                  }`}>
                    {mlPrediction.irrigation_needed ? '💧' : '✅'}
                  </div>
                </div>
              </div>
            )}
            <ul className="mt-6 flex flex-col gap-5 flex-1">
              {recommendations.length > 0 ? (
                recommendations.slice(0, 2).map((rec, i) => (
                  <li key={i} className={`flex gap-3 group/rec ${isRtl ? 'text-right' : 'text-left'}`}>
                     <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                     <div className="flex flex-col gap-1.5">
                        <div className="text-[14px] font-black text-gray-800 leading-tight group-hover/rec:text-emerald-700 transition-colors uppercase tracking-tight">{rec.text}</div>
                        <div className={`text-[12px] font-medium text-gray-500 leading-relaxed ${isRtl ? 'border-r-2 pr-3 border-emerald-500/20' : 'border-l-2 pl-3 border-emerald-500/20'}`}>
                           <span className="font-black text-emerald-600 mx-1">{T.why}</span> {rec.reasoning}
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
            <CardShell className="p-6 h-full card-interactive">
            <div className={isRtl ? 'text-right' : 'text-left'}>
              <div className="text-xl font-black text-gray-800 tracking-tight">{T.flowManagement}</div>
              <div className="text-[12px] text-gray-400 mt-1 font-medium mb-5">{T.controlSub}</div>
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
              <div className="mt-6 flex flex-col gap-3">
                <IrrigationActionButton 
                  active={activeAction === "irrigate"} 
                  onClick={() => onOpenManual && onOpenManual()}
                  icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
                  isRtl={isRtl}
                >
                  <span className="text-[14px] font-black">{T.startManual}</span>
                </IrrigationActionButton>
                
                <IrrigationActionButton 
                  active={activeAction === "stop"} 
                  onClick={async () => {
                    setActiveAction("stop");
                    setIsProcessing(true);
                    setActiveProcessing("stop");
                    try {
                      const farmId = JSON.parse(localStorage.getItem('warif_user') || '{}').farmId || 1;
                      await stopFarmIrrigation(farmId);
                      setIsProcessing(false);
                      setShowSuccess("stop");
                      setTimeout(() => setShowSuccess(""), 3000);
                    } catch (e) {
                      setIsProcessing(false);
                      console.error("Stop irrigation failed", e);
                    }
                  }}
                  icon={isProcessing && activeProcessing === "stop" ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>
                  )}
                  isRtl={isRtl}
                >
                  <span className="text-[14px] font-black">
                    {isProcessing && activeProcessing === "stop" ? (isEn ? "Stopping..." : "جاري الإيقاف...") : T.stopAll}
                  </span>
                </IrrigationActionButton>
                {showSuccess === "stop" && (
                   <div className="p-2 bg-red-50 text-red-700 rounded-xl border border-red-100 text-xs font-black flex items-center justify-center gap-2 animate-pulse mt-1">
                      {isEn ? "All Valves Closed" : "تم إغلاق كافة المحابس"}
                   </div>
                )}
                
                <IrrigationActionButton 
                  active={activeAction === "flush"} 
                  onClick={() => {
                    setActiveAction("flush");
                    setIsProcessing(true);
                    setActiveProcessing("flush");
                    setTimeout(() => {
                      setIsProcessing(false);
                      setShowSuccess("flush");
                      setTimeout(() => setShowSuccess(""), 4000);
                    }, 1500);
                  }}
                  icon={isProcessing && activeProcessing === "flush" ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                  )}
                  isRtl={isRtl}
                >
                  <span className="text-[14px] font-black">
                    {isProcessing && activeProcessing === "flush" ? (isEn ? "Flushing..." : "جاري الغسيل...") : T.flushNetwork}
                  </span>
                </IrrigationActionButton>
                {showSuccess === "flush" && (
                   <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 text-xs font-black flex items-center justify-center gap-2 animate-pulse mt-1">
                      {isEn ? "Network Flushed Successfully" : "تم تنظيف الشبكة بنجاح"}
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
              <div className={`flex items-center justify-between mb-4`}>
                <div className={isRtl ? 'text-right' : 'text-left'}>
                  <div className="text-lg font-bold text-gray-800 tracking-tight">{T.totalDailyWater}</div>
                  <div className="text-[12px] text-gray-400 font-medium mt-0.5">{T.dailyWaterSub}</div>
                </div>
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100/30">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                </div>
              </div>
              <div className={`flex items-center justify-between`}>
                 <div className={`text-4xl font-black text-blue-600 tracking-tight`}>
                   {waterUsage} <span className="text-sm font-bold text-gray-400 tracking-normal">{T.liters}</span>
                 </div>
                                  <div className={`text-xs font-black px-2.5 py-1 rounded-lg border shadow-sm ${ (resourceData?.water_diff_percent || 0) <= 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-700 bg-red-50 border-red-100'}`}>
                   {resourceData?.water_diff_percent !== undefined ? `${resourceData.water_diff_percent > 0 ? '+' : ''}${resourceData.water_diff_percent}%` : '-12%'} {T.fromYesterday}
                 </div>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <div className="h-2 w-full bg-blue-50 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (waterUsage / 500) * 100)}%` }} />
                </div>
              </div>
            </CardShell>
          </div>

          <div className="animate-fade-in-up delay-5 h-full">
            <CardShell className="p-6 relative overflow-hidden bg-white border border-gray-100/50 h-full card-interactive">
            <div className={`flex items-center justify-between mb-4`}>
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-lg font-bold text-gray-800 tracking-tight">{T.totalDailyPower}</div>
                <div className="text-[12px] text-gray-400 font-medium mt-0.5">{T.dailyPowerSub}</div>
              </div>
              <div className="w-10 h-10 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center border border-yellow-100/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
            </div>
            <div className={`flex items-center justify-between`}>
               <div className={`text-4xl font-black text-yellow-600 tracking-tight`}>
                 {powerUsage} <span className="text-sm font-bold text-gray-400 tracking-normal">{T.kwh}</span>
               </div>
               <div className={`text-xs font-black px-2.5 py-1 rounded-lg border shadow-sm ${ (resourceData?.power_diff_percent || 0) <= 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-red-700 bg-red-50 border-red-100'}`}>
                 {resourceData?.power_diff_percent !== undefined ? `${resourceData.power_diff_percent > 0 ? '+' : ''}${resourceData.power_diff_percent}%` : '-5%'} {T.fromYesterday}
               </div>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <div className="h-2 w-full bg-yellow-50 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (powerUsage / 50) * 100)}%` }} />
              </div>
            </div>
          </CardShell>
        </div>
      </div>

        <div className="animate-fade-in-up delay-6 mb-4">
           <SustainabilityLineChart 
             range={range} 
             onRangeChange={setRange} 
             data={dualSeries} 
             metricName={T.trendTitle}
             xAxisTitle={T.xAxisTitle}
             yAxisTitle={T.yAxisTitle}
             T={translations[lang]}
             isRtl={isRtl}
           />
        </div>
      </div>

    </div>
  );
}
