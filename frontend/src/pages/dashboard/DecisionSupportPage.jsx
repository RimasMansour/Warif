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
  WindSharedIcon,
  EmptyState
} from './DashboardShared';
import { formatLastUpdated } from './dashboardUtils';
import { useLatestSensors, useRecommendations } from '../../hooks/useWarifData';

export function DecisionSupportPage({ onBack, activeFarm, farmId, globalAutoMode, sharedSensors }) {
  const [seconds, setSeconds] = useState(0);
  const [showThanksIds, setShowThanksIds] = useState([]);

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
    thanks: isEn ? "Thanks for your contribution!" : "شكراً لمساهمتك",
    noActions: isEn ? "No smart actions recorded yet." : "لا توجد إجراءات ذكية مسجلة حالياً.",
    noActionsSub: isEn ? "AI logic will appear here as the system monitors your farm." : "ستظهر هنا قرارات الذكاء الاصطناعي بمجرد تحليل بيانات المزرعة.",
  };

  const getRecStyles = (type) => {
    switch (type) {
      case 'heat': 
        return { 
          icon: <TempSunIcon />,
          border: isRtl ? "border-r-4 border-r-orange-400" : "border-l-4 border-l-orange-400",
          iconBg: "bg-orange-50 text-orange-500 border-orange-100"
        };
      case 'humidity': 
        return { 
          icon: <AirHumidityIcon />,
          border: isRtl ? "border-r-4 border-r-sky-400" : "border-l-4 border-l-sky-400",
          iconBg: "bg-sky-50 text-sky-500 border-sky-100"
        };
      case 'climate': 
        return { 
          icon: <WindSharedIcon />, 
          border: isRtl ? "border-r-4 border-r-blue-400" : "border-l-4 border-l-blue-400",
          iconBg: "bg-blue-50 text-blue-500 border-blue-100"
        };
      case 'irrigation': 
        return { 
          icon: <IrrigationSmartIcon />, 
          border: isRtl ? "border-r-4 border-r-emerald-500" : "border-l-4 border-l-emerald-500",
          iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100"
        };
      case 'soil': 
        return { 
          icon: <PlantSoilIcon />, 
          border: isRtl ? "border-r-4 border-r-emerald-600" : "border-l-4 border-l-emerald-600",
          iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100"
        };
      default: 
        return { 
          icon: <ListIcon />, 
          border: isRtl ? "border-r-4 border-r-emerald-500" : "border-l-4 border-l-emerald-500",
          iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100"
        };
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const { data: apiRecs, error: recsError } = useRecommendations(farmId);

  // Debug: Log recommendations state
  React.useEffect(() => {
    console.log(`[DecisionSupport] Farm ID: ${farmId}, Recs: ${apiRecs?.length || 0}, Error: ${recsError}`);
  }, [farmId, apiRecs, recsError]);

  const allRecommendations = useMemo(() => {
    if (apiRecs && apiRecs.length > 0) {
      return apiRecs.map(r => ({
        id: `api-${r.id}`,
        mode: 'auto',
        type: r.category || 'irrigation',
        title: r.message || 'توصية',
        reasoning: r.reasoning || '',
        time: isEn ? 'Just now' : 'الآن',
        status: r.is_read ? 'accepted' : 'pending',
        week: isEn ? 'This Week' : 'هذا الأسبوع',
        farmIndices: [0, 1, 2],
      }));
    }
    return [];
  }, [apiRecs, isEn]);

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
    if (!showThanksIds.includes(id)) {
      setShowThanksIds(prev => [...prev, id]);
    }
  };

  const handleDecision = async (id, val) => {
    setLocalRecs(prev => prev.map(rec => rec.id === id ? { ...rec, status: val } : rec));
    if (val === 'accepted') {
      try {
        const token = localStorage.getItem('warif_token');
        const API_BASE = import.meta.env.VITE_API_URL || '';
        await fetch(`${API_BASE}/api/v1/recommendations/${farmId}/mark-read/${id.replace('api-', '')}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('[DecisionSupport] Failed to mark recommendation as read:', err);
      }
    }
  };

  const sections = isEn ? ["This Week", "Last Week"] : ["هذا الأسبوع", "الأسبوع الماضي"];

  return (
    <div className="w-full px-4 md:px-8 py-4 page-enter" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-[1100px] mx-auto flex flex-col gap-5 pb-8">
        
        <SensorTopBar
          title={T.title}
          subtitle={T.subtitle}
          icon={<ListIcon size={22} strokeWidth={1.7} />}
          onBack={onBack}
          T={translations[lang]}
          isRtl={isRtl}
        />

        {/* Compact Intelligence Dashboard */}
        <div className="animate-fade-in-up delay-1">
          <div className="bg-white/80 backdrop-blur-md p-4 rounded-[24px] border border-emerald-100 flex items-center gap-4 w-full md:w-fit min-w-[280px] shadow-sm">
             <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100/50 shadow-sm font-black text-lg">
                {localRecs.length}
             </div>
             <div>
                <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">{isEn ? "Active Recommendations" : "التوصيات النشطة"}</div>
             </div>
          </div>
        </div>

        {localRecs.length === 0 ? (
          <EmptyState
            title={recsError ? `خطأ: ${recsError}` : (isEn ? "All Systems Optimal" : "جميع الأنظمة في الحالة المثالية")}
            subtitle={recsError ? (isEn ? "Try refreshing" : "حاول إعادة التحميل") : (isEn ? "No actions needed right now. Everything is running perfectly." : "لا توجد توصيات الآن - كل شيء يعمل بشكل مثالي ومتوازن.")}
          />
        ) : (
          sections.map((week, sIdx) => {
            const weekRecs = localRecs.filter(r => r.week === week);
            if (weekRecs.length === 0) return null;

            return (
              <div key={week} className={`flex flex-col gap-4 animate-fade-in-up delay-${sIdx + 2}`}>
                <div className={`text-[14px] font-bold text-gray-800 flex items-center gap-3 mt-2`}>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50/50 px-3 py-1 rounded-xl border border-emerald-100/30 uppercase tracking-widest">{week}</span>
                  <div className="h-px bg-gray-100 flex-1" />
                </div>
    
                <div className="grid grid-cols-1 gap-4">
                  {weekRecs.map((item, idx) => {
                    const styles = getRecStyles(item.type);
                    return (
                      <CardShell key={item.id} className={`relative overflow-hidden card-interactive p-4 rounded-[24px] bg-white border-y border-gray-100 ${isRtl ? 'border-l' : 'border-r'} ${styles.border}`}>
                        <div className={`flex flex-col lg:flex-row lg:items-start justify-between gap-5 ${isRtl ? 'text-right' : 'text-left'}`}>
                          
                          <div className="flex items-start gap-4 flex-1">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm transition-all ${styles.iconBg}`}>
                              {React.isValidElement(styles.icon) ? React.cloneElement(styles.icon, { size: 22, strokeWidth: 1.7 }) : styles.icon}
                            </div>
   
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={`text-xs font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider ${item.mode === 'auto' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                {item.mode === 'auto' ? T.autoAction : T.manualRec}
                              </span>
                              <span className="text-[12px] text-gray-400 font-bold">• {item.time}</span>
                            </div>
                            
                            <div className="text-[16px] font-black text-gray-900 mb-1 tracking-tight leading-tight">{item.title}</div>

                            {/* Professional Details Box */}
                            <div className={`bg-emerald-50/30 rounded-2xl p-3 border border-emerald-100/50`}>
                               <div className="text-[12px] text-gray-800 leading-relaxed font-semibold">
                                 {item.reasoning}
                               </div>
                            </div>
                          </div>
                        </div>
  
                        {/* Compact Action Interface */}
                        <div className={`flex flex-col items-center lg:items-end justify-center min-w-[160px] lg:border-r border-gray-100 ${isRtl ? 'lg:pr-6' : 'lg:pl-6'}`}>
                          {(item.mode === 'auto' || globalAutoMode) ? (
                            <div className="flex flex-col items-center gap-3">
                              <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 font-black text-[11px] uppercase tracking-wider">
                                 {isEn ? 'Action Taken' : 'تم تنفيذ الإجراء'}
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleFeedback(item.id, 'down')}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${item.feedback === 'down' ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50'}`}
                                    title={isEn ? 'Not helpful' : 'غير مفيدة'}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(item.id, 'up')}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${item.feedback === 'up' ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50'}`}
                                    title={isEn ? 'Helpful' : 'مفيدة'}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/></svg>
                                  </button>
                                </div>
  
                                {/* Feedback Confirmation */}
                                {showThanksIds.includes(item.id) && (
                                  <div className="mt-2 text-center text-[10px] font-bold text-emerald-700 animate-fade-in">
                                    {T.thanks}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 w-full">
                              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center mb-1">
                                 {isEn ? 'Authorize' : 'إذن التنفيذ'}
                              </div>
                              {item.status === 'pending' ? (
                                <>
                                  <button 
                                    onClick={() => handleDecision(item.id, 'accepted')}
                                    className="w-full px-4 py-2 bg-emerald-600 text-white text-[12px] font-black rounded-xl hover:bg-emerald-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                                  >
                                    {isEn ? 'Approve' : 'موافقة'}
                                  </button>
                                  <button 
                                    onClick={() => handleDecision(item.id, 'rejected')}
                                    className="w-full px-4 py-2 bg-white border border-gray-100 text-gray-500 text-[12px] font-bold rounded-xl hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center gap-2"
                                  >
                                    {isEn ? 'Later' : 'لاحقاً'}
                                  </button>
                                </>
                              ) : (
                                <div className={`px-4 py-2 rounded-xl text-[12px] font-black text-center border ${item.status === 'accepted' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                  {item.status === 'accepted' ? T.executed : T.rejected}
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
          })
        )}
      </div>
    </div>
  );
}
