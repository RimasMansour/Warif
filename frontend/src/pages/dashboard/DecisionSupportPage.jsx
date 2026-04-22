import React, { useMemo, useState, useEffect } from 'react';
import { translations } from '../../i18n';
import { 
  SensorTopBar, 
  CardShell, 
  TempSunIcon, 
  AirHumidityIcon, 
  PlantSoilIcon, 
  IrrigationSmartIcon,
  ListIcon 
} from './dashboardShared';
import { formatLastUpdated, getAllCombinedRecommendations } from './dashboardUtils';

export function DecisionSupportPage({ onBack, activeFarm }) {
  const [seconds, setSeconds] = useState(0);

  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  const T = {
    title: isEn ? "Decision Support & Recs" : "التوصيات والقرارات الذكية",
    subtitle: isEn ? "Track and optimize AI decisions based on your data." : "تتبع وتحسين قرارات الذكاء الاصطناعي بناءً على مدخلاتك لضمان أعلى جودة في إدارة المحمية.",
    engineTitle: isEn ? "Digital Twin Decision Engine" : "محرك قرارات التوأم الرقمي",
    engineDesc: isEn ? "The system adjusts algorithms based on your feedback to improve sustainability." : "يقوم النظام بتعديل خوارزمياته بناءً على تقييماتك لزيادة الدقة والاستدامة.",
    autoAction: isEn ? "Auto Action" : "إجراء تلقائي",
    manualRec: isEn ? "Manual Rec" : "توصية يدوية",
    reasoning: isEn ? "Why?" : "لماذا؟",
    satisfaction: isEn ? "Rate this action:" : "ما مدى رضاك عن هذا الإجراء؟",
    accept: isEn ? "Accept" : "قبول التوصية",
    reject: isEn ? "Reject" : "رفض",
    executed: isEn ? "Executed" : "تم التنفيذ",
    rejected: isEn ? "Rejected" : "تم الرفض",
    thanks: isEn ? "Thanks for feedback!" : "شكراً لمساهمتك!",
    lastDiagnose: isEn ? "Last Diagnose" : "آخر تشخيص",
  };

  useEffect(() => {
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeFarm]);

  // Use shared recommendations engine
  const allRecommendations = useMemo(() => {
    return getAllCombinedRecommendations(activeFarm, isEn);
  }, [activeFarm, isEn]);

  // Icon mapping helper
  const getRecIcon = (type) => {
    switch (type) {
      case 'heat': return <TempSunIcon />;
      case 'humidity': return <AirHumidityIcon />;
      case 'irrigation': return <IrrigationSmartIcon />;
      case 'soil': return <PlantSoilIcon />;
      default: return <ListIcon />;
    }
  };

  const [localRecs, setLocalRecs] = useState([]);

  useEffect(() => {
    setLocalRecs(allRecommendations);
  }, [allRecommendations]);

  const handleFeedback = (id, val) => {
    setLocalRecs(prev => prev.map(rec => rec.id === id ? { ...rec, feedback: val } : rec));
  };

  const handleDecision = (id, val) => {
    setLocalRecs(prev => prev.map(rec => rec.id === id ? { ...rec, status: val } : rec));
  };

  const sections = isEn ? ["This Week", "Last Week"] : ["هذا الأسبوع", "الأسبوع الماضي"];

  return (
    <div className="w-full h-full px-4 md:px-8 py-5 overflow-auto page-enter" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-[1150px] mx-auto flex flex-col gap-6">
        
        <SensorTopBar
          title={T.title}
          subtitle={T.subtitle}
          icon={<ListIcon />}
          onBack={onBack}
          T={translations[lang]}
          isRtl={isRtl}
        />

        {/* Insight Header */}
        <div className="animate-fade-in-up delay-1">
          <div className={`bg-gradient-to-r from-emerald-50 to-emerald-100/30 rounded-2xl border border-emerald-100/50 p-4 flex items-center justify-between shadow-sm`}>
            <div className={`flex items-center gap-4`}>
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center border border-emerald-100 shadow-sm text-emerald-600">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              </div>
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="text-[16px] font-bold text-gray-800 tracking-tight leading-tight">{T.engineTitle}</div>
                <div className="text-[12px] text-emerald-600 font-medium mt-1">{formatLastUpdated(seconds, T.lastDiagnose)}</div>
                <div className="text-[12px] text-gray-500 mt-2 font-medium leading-relaxed max-w-sm">{T.engineDesc}</div>
              </div>
            </div>
          </div>
        </div>

        {sections.map(week => (
          <div key={week} className="flex flex-col gap-4">
                <div className={`text-lg font-bold text-gray-800 tracking-tight flex items-center gap-2 mb-3 pt-4`}>
                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-tighter">{week}</span>
                  <div className="h-px bg-gray-100 flex-1" />
                </div>

            <div className="grid grid-cols-1 gap-4">
              {localRecs.filter(r => r.week === week).map((item, idx) => (
                <CardShell key={item.id} className={`animate-fade-in-up delay-${(idx % 5) + 2} relative overflow-hidden card-interactive p-3`}>
                  <div className={`flex flex-col md:flex-row md:items-start justify-between gap-4 ${isRtl ? 'text-right' : 'text-left'}`}>
                    
                    <div className={`flex items-start gap-3 flex-1`}>
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 text-emerald-600 shadow-sm">
                        {React.cloneElement(getRecIcon(item.type), { size: 16 })}
                      </div>
 
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${item.mode === 'auto' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                            {item.mode === 'auto' ? T.autoAction : T.manualRec}
                          </span>
                          <span className="text-[12px] text-gray-400 font-bold tracking-tight">• {item.time}</span>
                        </div>
                        <div className="text-[14px] font-black text-gray-800 mb-0.5 tracking-tight uppercase leading-tight">{item.title}</div>
                        <div className="text-[12px] text-gray-500 font-semibold leading-relaxed mb-3">{item.desc}</div>
 
                        {/* Explainable AI (XAI) Section */}
                        <div className={`bg-emerald-50/20 rounded-2xl p-3 border border-dashed border-emerald-100 ${isRtl ? '' : 'text-left'}`}>
                           <div className={`flex items-center gap-2 text-[12px] font-black text-emerald-600 mb-1 uppercase tracking-tight`}>
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                             {T.reasoning}
                           </div>
                           <div className="text-[11px] text-gray-600 leading-normal font-bold italic">
                             {item.reasoning}
                           </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Section */}
                    <div className={`flex items-center gap-3 border-t md:border-t-0 pt-4 md:pt-0 ${isRtl ? 'md:border-r md:pr-5' : 'md:border-l md:pl-5'} border-gray-100`}>
                      {item.mode === 'auto' ? (
                        <div className="flex flex-col items-center gap-2 md:items-end">
                          <div className="text-[11px] font-bold text-gray-400">{T.satisfaction}</div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleFeedback(item.id, 'up')}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${item.feedback === 'up' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                            >
                               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                            </button>
                            <button 
                              onClick={() => handleFeedback(item.id, 'down')}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${item.feedback === 'down' ? 'bg-red-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                            >
                               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                            </button>
                          </div>
                          {item.feedback && <span className="text-[10px] font-bold text-emerald-600 animate-fade-in">{T.thanks}</span>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {item.status === 'pending' ? (
                            <>
                              <button 
                                onClick={() => handleDecision(item.id, 'accepted')}
                                className="px-5 py-2.5 bg-emerald-600 text-white text-[13px] font-black rounded-xl hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                              >
                                {T.accept}
                              </button>
                              <button 
                                onClick={() => handleDecision(item.id, 'rejected')}
                                className="px-4 py-2 bg-white border border-gray-200 text-gray-500 text-[13px] font-bold rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                              >
                                {T.reject}
                              </button>
                            </>
                          ) : (
                            <div className={`px-5 py-2.5 rounded-xl text-[13px] font-black flex items-center gap-2 ${item.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' : 'bg-red-50 text-red-600 border border-red-100/50'}`}>
                              {item.status === 'accepted' ? (
                                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> {T.executed}</>
                              ) : (
                                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> {T.rejected}</>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                </CardShell>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
