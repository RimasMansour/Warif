import React, { useMemo, useState, useEffect } from 'react';
import { translations } from '../../i18n';
import { 
  SensorTopBar, 
  CardShell, 
  TempSunIcon, 
  AirHumidityIcon, 
  PlantSoilIcon, 
  IrrigationSmartIcon,
  ListIcon,
  WindSharedIcon 
} from './dashboardShared';
import { formatLastUpdated, getAllCombinedRecommendations } from './dashboardUtils';

export function DecisionSupportPage({ onBack, activeFarm, globalAutoMode }) {
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
    thanks: isEn ? "Thanks for your feedback!" : "شكراً لتقييمك!",
  };

  const getRecStyles = (type) => {
    switch (type) {
      case 'heat': 
        return { 
          icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.7V3a2 2 0 0 0-4 0v11.7a4.5 4.5 0 1 0 4 0z"/></svg>,
          colors: "bg-[#FFF7ED] border-[#fed7aa]/40 text-[#F97316]" 
        };
      case 'humidity': 
        return { 
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22c4.4 0 8-3.6 8-8 0-6-8-12-8-12S4 8 4 14c0 4.4 3.6 8 8 8z" />
              <path d="M2 13h5c1 0 1 1 2 1s1-1 2-1h2" />
              <path d="M2 17h5c1 0 1 1 2 1s1-1 2-1h2" />
              <path d="M2 9h5c1 0 1 1 2 1s1-1 2-1h2" />
            </svg>
          ),
      case 'climate': 
        return { 
          icon: <WindSharedIcon />, 
          colors: "bg-blue-50 border-blue-100/50 text-[#0EA5E9]" 
        };
      case 'irrigation': 
        return { 
          icon: <IrrigationSmartIcon />, 
          colors: "bg-emerald-50 border-emerald-100/50 text-[#059669]" 
        };
      case 'soil': 
        return { 
          icon: <PlantSoilIcon />, 
          colors: "bg-emerald-50 border-emerald-100/50 text-[#059669]" 
        };
      default: 
        return { 
          icon: <ListIcon />, 
          colors: "bg-emerald-50 border-emerald-100/50 text-[#059669]" 
        };
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const allRecommendations = useMemo(() => {
    return getAllCombinedRecommendations(activeFarm, isEn);
  }, [activeFarm, isEn]);

  const [localRecs, setLocalRecs] = useState([]);

  useEffect(() => {
    let filtered = allRecommendations;
    if (!globalAutoMode) {
      filtered = filtered.filter(r => r.mode === 'manual');
    }
    setLocalRecs(filtered);
  }, [allRecommendations, globalAutoMode]);

  const handleFeedback = (id, val) => {
    setLocalRecs(prev => prev.map(rec => rec.id === id ? { ...rec, feedback: val } : rec));
  };

  const handleDecision = (id, val) => {
    setLocalRecs(prev => prev.map(rec => rec.id === id ? { ...rec, status: val } : rec));
  };

  const sections = isEn ? ["This Week", "Last Week"] : ["هذا الأسبوع", "الأسبوع الماضي"];

  return (
    <div className="w-full h-full px-4 md:px-8 py-4 overflow-auto page-enter" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-[1100px] mx-auto flex flex-col gap-5 pb-8">
        
        <SensorTopBar
          title={T.title}
          subtitle={T.subtitle}
          icon={<ListIcon size={22} />}
          onBack={onBack}
          T={translations[lang]}
          isRtl={isRtl}
        />

        {/* Compact Intelligence Dashboard */}
        <div className="animate-fade-in-up delay-1">
          <div className="bg-white/80 backdrop-blur-md p-4 rounded-[24px] border border-emerald-100 flex items-center gap-3 w-full md:w-fit min-w-[280px] shadow-sm">
             <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] text-[#059669] flex items-center justify-center border border-[#d1fae5]/40">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
             </div>
             <div>
                <div className="text-[20px] font-black text-gray-800 leading-none">١٢٤</div>
                <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mt-1.5">{isEn ? "Actions Executed" : "إجمالي الإجراءات المنفذة"}</div>
             </div>
          </div>
        </div>

        {sections.map((week, sIdx) => {
          const weekRecs = localRecs.filter(r => r.week === week);
          if (weekRecs.length === 0) return null;

          return (
            <div key={week} className={`flex flex-col gap-4 animate-fade-in-up delay-${sIdx + 2}`}>
              <div className={`text-[14px] font-bold text-gray-800 flex items-center gap-3 mt-2`}>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50/50 px-3 py-1 rounded-xl border border-emerald-100/30 uppercase tracking-widest">{week}</span>
                <div className="h-px bg-gray-100 flex-1" />
              </div>
  
              <div className="grid grid-cols-1 gap-4">
                {weekRecs.map((item, idx) => {
                  const styles = getRecStyles(item.type);
                  return (
                    <CardShell key={item.id} className="relative overflow-hidden card-interactive p-4 rounded-[24px] border-gray-100 bg-white">
                      <div className={`flex flex-col lg:flex-row lg:items-start justify-between gap-5 ${isRtl ? 'text-right' : 'text-left'}`}>
                        
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm transition-all ${styles.colors}`}>
                            {React.isValidElement(styles.icon) ? React.cloneElement(styles.icon, { size: 22, strokeWidth: 1.8 }) : styles.icon}
                          </div>
 
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`text-[12px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider ${item.mode === 'auto' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-amber-500 text-white border-amber-400'}`}>
                              {item.mode === 'auto' ? T.autoAction : T.manualRec}
                            </span>
                            <span className="text-[12px] text-gray-400 font-bold">• {item.time}</span>
                            <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                               <div className="w-1 h-1 rounded-full bg-emerald-500" />
                               <span className="text-[9px] font-black text-gray-400 uppercase">{isEn ? 'Conf.' : 'الثقة'}: ٩٦٪</span>
                            </div>
                          </div>
                          
                          <div className="text-[15px] font-black text-gray-900 mb-1 tracking-tight leading-tight uppercase">{item.title}</div>
                          <div className="text-[12px] text-gray-500 font-semibold leading-relaxed mb-4 line-clamp-2">{item.desc}</div>
 
                          {/* Compact Reasoning */}
                          <div className={`bg-gray-50/50 rounded-2xl p-3 border border-gray-100`}>
                             <div className={`flex items-center gap-2 text-[11px] font-black text-emerald-700 mb-1 uppercase`}>
                               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                               {T.reasoning}
                             </div>
                             <div className="text-[11px] text-gray-600 leading-normal font-bold italic border-r-2 border-emerald-500/20 pr-3">
                               {item.reasoning}
                             </div>
                          </div>
                        </div>
                      </div>

                      {/* Compact Action Interface */}
                      <div className={`flex flex-col items-center lg:items-end justify-center min-w-[150px] lg:border-r border-gray-100 ${isRtl ? 'lg:pr-6' : 'lg:pl-6'}`}>
                        {(item.mode === 'auto' || globalAutoMode) ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 font-black text-[10px] uppercase">
                               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                               {T.executed}
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleFeedback(item.id, 'up')}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${item.feedback === 'up' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-400 hover:text-emerald-600'}`}
                              >
                                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                              </button>
                              <button 
                                onClick={() => handleFeedback(item.id, 'down')}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${item.feedback === 'down' ? 'bg-red-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-400 hover:text-red-600'}`}
                              >
                                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 w-full">
                            {item.status === 'pending' ? (
                              <>
                                <button 
                                  onClick={() => handleDecision(item.id, 'accepted')}
                                  className="w-full px-4 py-2 bg-emerald-600 text-white text-[12px] font-black rounded-xl hover:bg-emerald-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                                >
                                  {T.accept}
                                </button>
                                <button 
                                  onClick={() => handleDecision(item.id, 'rejected')}
                                  className="w-full px-4 py-2 bg-white border border-gray-100 text-gray-500 text-[12px] font-bold rounded-xl hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center gap-2"
                                >
                                  {T.reject}
                                </button>
                              </>
                            ) : (
                              <div className={`px-4 py-2 rounded-xl text-[12px] font-black flex items-center gap-2 justify-center border ${item.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                {item.status === 'accepted' ? (
                                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> {T.executed}</>
                                ) : (
                                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> {T.rejected}</>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                    </CardShell>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
