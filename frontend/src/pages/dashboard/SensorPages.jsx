import { useMemo, useState, useEffect } from 'react';
import { translations } from '../../i18n';
import { 
  SensorTopBar, 
  CardShell, 
  PlantSoilIcon,
  WindIcon
} from './dashboardShared';
import { HealthStyleBarChart, IrrigationActionButton } from './dashboardCharts';

import { 
  generateDataForRange, 
  sensorBuildRecommendationsTemperature, 
  sensorBuildRecommendationsHumidity, 
  sensorBuildRecommendationsSoil,
  formatLastUpdated,
  getLiveFarmData
} from './dashboardUtils';

/* =========================================================
   1. Microclimate Module (المناخ والتهوية)
========================================================= */
export function MicroclimatePage({ onBack, globalAutoMode, activeFarm }) {
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
    autoActive: isEn ? "System is managed automatically. Manual controls are locked for stability." : "النظام يدار تلقائياً الآن. جميع أزرار التحكم اليدوي مقفلة لحفظ استقرار المحمية.",
    startCooling: isEn ? "Start Manual Cooling" : "بدء التبريد اليدوي",
    stopFans: isEn ? "Stop Fans" : "إيقاف المراوح",
    trendTitle: isEn ? "Climate Trend Analysis" : "تحليل الميول المناخية",
    trendSub: isEn ? "Tracking thermal changes for the digital twin." : "تتبع التغيرات الزمنية في الحرارة والرطوبة للتوأم الرقمي",
    climateLog: isEn ? "Microclimate Bio-Log Patterns" : "أنماط السجل الحيوي للمناخ والتهوية",
    climateLogSub: isEn ? "Historical sensor pattern discovery." : "اكتشاف الأنماط التاريخية للحساسات.",
    tempChart: isEn ? "Temperature Trend" : "مسار درجة الحرارة",
    humChart: isEn ? "Air Humidity Trend" : "مسار رطوبة الهواء",
    tempY: isEn ? "Temp (°C)" : "درجة الحرارة (°C)",
    humY: isEn ? "Humidity (%)" : "رطوبة الهواء (٪)",
    lastUpdateAr: "آخر تحديث",
    lastUpdateEn: "Last Update",
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

  const [range, setRange] = useState("W");
  const data = getLiveFarmData(activeFarm);
  const lastUpdateLabel = formatLastUpdated(seconds, T.lastUpdateAr, T.lastUpdateEn);

  const tempSeries = useMemo(() => generateDataForRange(range, { 
    base: 28, amp: 8, noise: 3, min: 10, max: 45, seed: 42, farmIndex: activeFarm
  }), [range, activeFarm]);
  
  const humSeries = useMemo(() => generateDataForRange(range, { 
    base: 55, amp: 12, noise: 5, min: 20, max: 95, seed: 101, farmIndex: activeFarm
  }), [range, activeFarm]);

  const recommendations = useMemo(() => [
    ...sensorBuildRecommendationsTemperature(data.temp),
    ...sensorBuildRecommendationsHumidity(data.hum)
  ], [data.temp, data.hum]);

  return (
    <div className="w-full h-full px-4 md:px-8 py-5 overflow-auto page-enter" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-[1150px] mx-auto flex flex-col gap-6">

        <SensorTopBar
          title={T.title}
          subtitle={T.subtitle}
          icon={<WindIcon />}
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
                  <span className="text-2xl font-black text-gray-800">{data.temp.toFixed(1)}°C</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all group">
                  <span className="text-[13px] font-bold text-gray-500 group-hover:text-gray-700">{T.hum}</span>
                  <span className="text-2xl font-black text-gray-800">{data.hum.toFixed(0)}٪</span>
                </div>
              </div>
            </CardShell>
          </div>

          <div className="animate-fade-in-up delay-2 h-full">
            <CardShell className="p-6 flex flex-col gap-4 h-full card-interactive">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight leading-tight flex items-center gap-2">
                  {T.recs} 
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-200/50 font-black tracking-tighter uppercase">{T.smartAnalysis}</span>
                </div>
                <div className="text-[12px] font-medium text-gray-400 mt-1 mb-2">{T.recsSub}</div>
              </div>
              <ul className="flex flex-col gap-5">
                {recommendations.slice(0, 2).map((rec, i) => (
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
                ))}
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
                <div className="bg-emerald-50/40 rounded-2xl p-4 text-center border border-emerald-100/30 flex items-center justify-center flex-1">
                  <div className="text-emerald-800 font-black text-[12px] leading-relaxed">{T.autoActive}</div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="sr-only">Climate Control Actions</span>
                  <IrrigationActionButton 
                    active={activeAction === "cool"} onClick={() => setActiveAction("cool")}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16M12 4v16M20 8l-4 4 4 4M4 8l4 4-4 4"/></svg>}
                    isRtl={isRtl}
                  >
                    {T.startCooling}
                  </IrrigationActionButton>
                  <IrrigationActionButton 
                    active={activeAction === "stop"} onClick={() => setActiveAction("stop")}
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>}
                    isRtl={isRtl}
                  >
                    {T.stopFans}
                  </IrrigationActionButton>
                </div>
              )}
            </CardShell>
          </div>
        </div>

        <div className="animate-fade-in-up delay-4">
          <CardShell className="p-6 card-interactive">
            <div className={`mb-2 ${isRtl ? 'text-right' : 'text-left'}`}>
              <div className="text-lg font-bold text-gray-800 tracking-tight leading-tight">{T.climateLog}</div>
              <div className="text-[12px] font-medium text-gray-400 mt-0.5">{T.climateLogSub}</div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   2. Soil Module (بيئة وصحة التربة)
========================================================= */
export function SoilRootDataPage({ onBack, globalAutoMode, activeFarm }) {
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

  const [range, setRange] = useState("W");
  const data = getLiveFarmData(activeFarm);
  const lastUpdateLabel = formatLastUpdated(seconds, T.lastUpdateAr, T.lastUpdateEn);

  const soilTempSeries = useMemo(() => generateDataForRange(range, { 
    base: 24, amp: 5, noise: 2.5, min: 10, max: 40, seed: 90, farmIndex: activeFarm
  }), [range, activeFarm]);
  
  const soilMoistSeries = useMemo(() => generateDataForRange(range, { 
    base: 42, amp: 10, noise: 4, min: 10, max: 95, seed: 80, farmIndex: activeFarm
  }), [range, activeFarm]);

  const soilRecs = useMemo(() => sensorBuildRecommendationsSoil(data.soilTemp, data.soilMoist), [data.soilTemp, data.soilMoist]);

  return (
    <div className="w-full h-full px-4 md:px-8 py-5 overflow-auto page-enter" dir={isRtl ? 'rtl' : 'ltr'}>
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
                  <span className="text-2xl font-black text-gray-800">{data.soilTemp.toFixed(1)}°C</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all group">
                  <span className="text-[13px] font-bold text-gray-500 group-hover:text-gray-700">{T.soilMoist}</span>
                  <span className="text-2xl font-black text-gray-800">{data.soilMoist.toFixed(0)}٪</span>
                </div>
              </div>
            </CardShell>
          </div>

          <div className="animate-fade-in-up delay-2 h-full">
            <CardShell className="p-6 flex flex-col gap-4 bg-white border-gray-100 shadow-sm min-h-[220px] h-full card-interactive">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-xl font-black text-gray-800 tracking-tight leading-tight flex items-center gap-2">
                  {T.soilRecs} 
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-200/50 font-black tracking-tighter uppercase">{T.smartAnalysis}</span>
                </div>
                <div className="text-[12px] font-medium text-gray-400 mt-1 mb-2">{isEn ? 'Suggested actions for root health.' : 'إجراءات مقترحة للحفاظ على صحة وسلامة الجذور.'}</div>
              </div>
              <ul className="flex flex-col gap-5">
                {soilRecs.slice(0, 2).map((rec, i) => (
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
                ))}
              </ul>
            </CardShell>
          </div>
        </div>

        <div className="animate-fade-in-up delay-3">
          <CardShell className="p-6 card-interactive">
            <div className={`mb-2 ${isRtl ? 'text-right' : 'text-left'}`}>
              <div className="text-lg font-bold text-gray-800 tracking-tight leading-tight">{T.bioTitle}</div>
              <div className="text-[12px] font-medium text-gray-400 mt-1">{T.bioSub}</div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
          </CardShell>
        </div>
      </div>
    </div>
  );
}
