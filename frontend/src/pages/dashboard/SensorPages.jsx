import { useMemo, useState, useEffect } from 'react';
import { translations } from '../../i18n';
import { 
  SensorTopBar, 
  CardShell, 
  PlantSoilIcon, 
  WindSharedIcon, 
  EmptyState,
  getRecommendationTheme
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
export function MicroclimatePage({ onBack, globalAutoMode, activeFarm, farmId, sharedSensors }) {
  const [seconds, setSeconds] = useState(0);
  const [activeAction, setActiveAction] = useState("");
  const [fanRunning, setFanRunning] = useState(false);
  const [fanAction, setFanAction] = useState(null); // 'started' or 'stopped'
  const [coolingActive, setCoolingActive] = useState(false);
  const [coolingAction, setCoolingAction] = useState(null); // 'started' or 'stopped'

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
              <div className="flex flex-col gap-3 flex-1 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {recommendations.length > 0 ? (
                  recommendations.map((rec, i) => {
                    const theme = getRecommendationTheme('temperature', rec.text);
                    return (
                      <div key={i} className={`p-3 rounded-[24px] border flex flex-col ${theme.bg} ${theme.border} shadow-sm transition-all animate-fade-in`}>
                       <div className={`flex-1 overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-2 ${isRtl ? 'text-right' : 'text-left'}`}>
                          <div className="flex items-start gap-3">
                             <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm transition-all ${theme.iconBg}`}>
                               {theme.icon}
                             </div>
                             <div className="flex-1">
                               <h4 className={`text-[13px] font-black leading-tight ${theme.text} mt-2`}>
                                 {isEn ? 'Recommendation:' : 'التوصية:'} {rec.text}
                               </h4>
                             </div>
                          </div>

                          {rec.reasoning && (
                            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-2 border border-gray-100/50 mt-1">
                              <div className="text-[11px] font-bold text-gray-800 mb-0.5">{isEn ? 'Analysis:' : 'التحليل:'}</div>
                              <div className="text-[11px] text-gray-800 leading-relaxed">{rec.reasoning}</div>
                            </div>
                          )}

                          <div className={`${theme.actionBg} rounded-xl p-2 border ${theme.actionBorder}`}>
                            <div className={`text-[11px] font-bold ${theme.actionText} mb-0.5`}>{isEn ? 'Action:' : 'الإجراء:'}</div>
                            <div className="text-[11px] text-gray-800 leading-relaxed">{rec.text}</div>
                          </div>

                          {rec.benefit && (
                            <div className="bg-purple-50/30 rounded-xl p-2 border border-purple-100/50">
                              <div className="text-[11px] font-bold text-purple-800 mb-0.5">{isEn ? 'Expected Result:' : 'النتيجة المتوقعة:'}</div>
                              <div className="text-[11px] text-gray-800 leading-relaxed">{rec.benefit}</div>
                            </div>
                          )}

                          {!globalAutoMode && (
                            <div className="mt-2">
                              {recommendationStatus[rec.id || i] ? (
                                <div className={`px-4 py-1.5 rounded-xl text-[11px] font-black text-center border ${recommendationStatus[rec.id || i] === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                  {recommendationStatus[rec.id || i] === 'accepted' ? (isEn ? 'Executed' : 'تم التنفيذ') : (isEn ? 'Ignored' : 'تم التجاهل')}
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleRecommendationDecision(rec.id || i, 'accepted')}
                                    className="flex-1 px-3 py-1.5 bg-emerald-600 text-white text-[11px] font-black rounded-xl hover:bg-emerald-700 transition-all shadow-sm active:scale-95 flex items-center justify-center"
                                  >
                                    {isEn ? 'Execute' : 'نفذ'}
                                  </button>
                                  <button 
                                    onClick={() => handleRecommendationDecision(rec.id || i, 'rejected')}
                                    className="flex-1 px-3 py-1.5 bg-white border border-gray-100 text-gray-500 text-[11px] font-bold rounded-xl hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center"
                                  >
                                    {isEn ? 'Ignore' : 'تجاهل'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                       </div>

                       {/* Feedback Section at the bottom */}
                       <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0 relative">
                         <span className="text-[11px] font-bold text-gray-500">
                           {isEn ? 'Was this helpful?' : 'هل كان مفيدًا؟'}
                         </span>
                         <div className="flex items-center gap-2">
                           <button
                             onClick={() => handleFeedback(rec.id || i, 'down')}
                             className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${feedback[rec.id || i] === 'down' ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50'}`}
                             title={isEn ? 'Not helpful' : 'غير مفيدة'}
                           >
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                           </button>
                           <button
                             onClick={() => handleFeedback(rec.id || i, 'up')}
                             className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${feedback[rec.id || i] === 'up' ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50'}`}
                             title={isEn ? 'Helpful' : 'مفيدة'}
                           >
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/></svg>
                           </button>
                         </div>
                         {showThanksIds.includes(rec.id || i) && (
                           <div className="absolute top-[-25px] left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white px-2 py-1 rounded-md text-[9px] font-bold animate-fade-in z-10 shadow-lg">
                             {isEn ? 'Thanks!' : 'شكراً!'}
                           </div>
                         )}
                       </div>
                      </div>
                    );
                  })
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
                <div className="flex flex-col gap-2">
                  <span className="sr-only">Climate Control Actions</span>
                  <div className="flex flex-col gap-1">
                    <IrrigationActionButton 
                      active={coolingActive} 
                      onClick={() => {
                        if (!coolingActive) {
                          // Turning ON
                          setCoolingActive(true);
                          setFanRunning(false); // Turn off standalone fan mode
                          setCoolingAction('started');
                          setFanAction('started'); 
                          setActiveAction('cool');
                          triggerManualCooling && triggerManualCooling('start');
                        } else {
                          // Turning OFF
                          setCoolingActive(false);
                          setCoolingAction('stopped');
                          setActiveAction('cool');
                          triggerManualCooling && triggerManualCooling('stop');
                        }
                        setTimeout(() => setActiveAction(null), 6000);
                      }}
                      icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20l4-4 4 4"/></svg>}
                      isRtl={isRtl}
                    >
                      {coolingActive ? (isEn ? "Stop Cooler & Fans" : "إيقاف المكيف والمراوح") : (isEn ? "Start Cooler & Fans" : "تشغيل المكيف والمراوح")}
                    </IrrigationActionButton>
                    <div className="text-[10px] text-gray-400 font-medium px-1 mb-1">
                      {isEn ? "Evaporative Cooler + Fans — Integrated Cooling" : "المكيف الصحراوي + المراوح — وحدة تبريد متكاملة"}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <IrrigationActionButton 
                      active={fanRunning} 
                      onClick={() => {
                        if (!fanRunning) {
                          setFanRunning(true);
                          setCoolingActive(false); // Turn off integrated cooling mode
                          setFanAction('started');
                        } else {
                          setFanRunning(false);
                          setFanAction('stopped');
                        }
                        setActiveAction('fan');
                        setTimeout(() => setActiveAction(null), 6000);
                      }}
                      icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12L12 3C15 3 18 6 18 9S15 12 12 12Z" /><path d="M12 12L21 12C21 15 18 18 15 18S12 15 12 12Z" /><path d="M12 12L12 21C9 21 6 18 6 15S9 12 12 12Z" /><path d="M12 12L3 12C3 9 6 6 9 6S12 9 12 12Z" /></svg>}
                      isRtl={isRtl}
                    >
                      {fanRunning ? (isEn ? "Stop Fans" : "إيقاف المراوح") : (isEn ? "Start Fans Only" : "تشغيل المراوح فقط")}
                    </IrrigationActionButton>
                    <div className="text-[10px] text-gray-400 font-medium px-1 mb-1">
                      {isEn ? "Ventilation without cooling — suitable for humidity reduction" : "تهوية بدون تبريد — مناسب لتخفيض الرطوبة"}
                    </div>
                  </div>

                  {activeAction === 'cool' && (
                    <div className={`mt-2 px-4 py-2.5 rounded-2xl border text-xs font-black flex items-center gap-2 animate-pulse
                      ${coolingAction === 'started'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                      <span>
                        {coolingAction === 'started'
                          ? (isEn ? '✓ Cooling unit started — AC and Fans running together' : '✓ تم تشغيل وحدة التبريد — المكيف والمراوح يعملان معاً')
                          : (isEn ? '✓ Cooling unit stopped — System in standby' : '✓ تم إيقاف وحدة التبريد — النظام في وضع الاستعداد')}
                      </span>
                    </div>
                  )}

                  {activeAction === 'fan' && (
                    <div className={`mt-2 px-4 py-2.5 rounded-2xl border text-xs font-black flex items-center gap-2 animate-pulse
                      ${fanAction === 'started'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                      <span>
                        {fanAction === 'started'
                          ? (isEn ? '✓ Fans started — Reducing temperature' : '✓ تم تشغيل المراوح — يعمل النظام على خفض درجة الحرارة')
                          : (isEn ? '✓ Fans stopped — System in standby' : '✓ تم إيقاف المراوح — النظام في وضع الاستعداد')}
                      </span>
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
export function SoilRootDataPage({ onBack, globalAutoMode, activeFarm, farmId, sharedSensors }) {
  const [seconds, setSeconds] = useState(0);

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
                  soilRecs.map((rec, i) => {
                    const theme = getRecommendationTheme('soil', rec.text);
                    return (
                    <div key={i} className={`p-3 rounded-[24px] border flex flex-col ${theme.bg} ${theme.border} shadow-sm transition-all animate-fade-in`}>
                       <div className={`flex-1 overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-2 ${isRtl ? 'text-right' : 'text-left'}`}>
                          <div className="flex items-start gap-3">
                             <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm transition-all ${theme.iconBg}`}>
                               {theme.icon}
                             </div>
                             <div className="flex-1">
                               <h4 className={`text-[13px] font-black leading-tight ${theme.text} mt-2`}>
                                 {isEn ? 'Recommendation:' : 'التوصية:'} {rec.text}
                               </h4>
                             </div>
                          </div>

                          {rec.reasoning && (
                            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-2 border border-gray-100/50 mt-1">
                              <div className="text-[11px] font-bold text-gray-800 mb-0.5">{isEn ? 'Analysis:' : 'التحليل:'}</div>
                              <div className="text-[11px] text-gray-800 leading-relaxed">{rec.reasoning}</div>
                            </div>
                          )}

                          <div className={`${theme.actionBg} rounded-xl p-2 border ${theme.actionBorder}`}>
                            <div className={`text-[11px] font-bold ${theme.actionText} mb-0.5`}>{isEn ? 'Action:' : 'الإجراء:'}</div>
                            <div className="text-[11px] text-gray-800 leading-relaxed">{rec.text}</div>
                          </div>

                          {rec.benefit && (
                            <div className="bg-purple-50/30 rounded-xl p-2 border border-purple-100/50">
                              <div className="text-[11px] font-bold text-purple-800 mb-0.5">{isEn ? 'Expected Result:' : 'النتيجة المتوقعة:'}</div>
                              <div className="text-[11px] text-gray-800 leading-relaxed">{rec.benefit}</div>
                            </div>
                          )}

                          {!globalAutoMode && (
                            <div className="mt-2">
                              {recommendationStatus[rec.id || i] ? (
                                <div className={`px-4 py-1.5 rounded-xl text-[11px] font-black text-center border ${recommendationStatus[rec.id || i] === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                  {recommendationStatus[rec.id || i] === 'accepted' ? (isEn ? 'Executed' : 'تم التنفيذ') : (isEn ? 'Ignored' : 'تم التجاهل')}
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleRecommendationDecision(rec.id || i, 'accepted')}
                                    className="flex-1 px-3 py-1.5 bg-emerald-600 text-white text-[11px] font-black rounded-xl hover:bg-emerald-700 transition-all shadow-sm active:scale-95 flex items-center justify-center"
                                  >
                                    {isEn ? 'Execute' : 'نفذ'}
                                  </button>
                                  <button 
                                    onClick={() => handleRecommendationDecision(rec.id || i, 'rejected')}
                                    className="flex-1 px-3 py-1.5 bg-white border border-gray-100 text-gray-500 text-[11px] font-bold rounded-xl hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center"
                                  >
                                    {isEn ? 'Ignore' : 'تجاهل'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                       </div>

                       {/* Feedback Section at the bottom */}
                       <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between gap-2 shrink-0 relative">
                         <span className="text-[11px] font-bold text-gray-500">
                           {isEn ? 'Was this helpful?' : 'هل كان مفيدًا؟'}
                         </span>
                         <div className="flex items-center gap-2">
                           <button
                             onClick={() => handleFeedback(rec.id || i, 'down')}
                             className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${feedback[rec.id || i] === 'down' ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50'}`}
                             title={isEn ? 'Not helpful' : 'غير مفيدة'}
                           >
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                           </button>
                           <button
                             onClick={() => handleFeedback(rec.id || i, 'up')}
                             className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${feedback[rec.id || i] === 'up' ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50'}`}
                             title={isEn ? 'Helpful' : 'مفيدة'}
                           >
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/></svg>
                           </button>
                         </div>
                         {showThanksIds.includes(rec.id || i) && (
                           <div className="absolute top-[-25px] left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white px-2 py-1 rounded-md text-[9px] font-bold animate-fade-in z-10 shadow-lg">
                             {isEn ? 'Thanks!' : 'شكراً!'}
                           </div>
                         )}
                       </div>
                      </div>
                    );
                  })
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
