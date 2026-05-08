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
  EmptyState,
  getRecommendationTheme,
  RecommendationCard
} from './DashboardShared';
import { formatLastUpdated } from './dashboardUtils';
import { useLatestSensors, useRecommendations, executeRecommendation, submitRecommendationFeedback } from '../../hooks/useWarifData';

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
        reasoning: r.data_insight || r.reasoning || '',
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
    // In manual mode, show API recommendations as actionable items for user review
    // In auto mode, show all recommendations (both auto and manual)
    setLocalRecs(filtered);
  }, [allRecommendations, globalAutoMode]);

  const handleFeedback = async (id, val) => {
    // تحديث الواجهة المحلية فوراً
    setLocalRecs(prev => prev.map(rec => rec.id === id ? { ...rec, feedback: val } : rec));
    if (!showThanksIds.includes(id)) {
      setShowThanksIds(prev => [...prev, id]);
    }

    // إرسال الفيدباك إلى الـ Backend للتعلم المستمر
    try {
      const helpful = val === 'up';
      const recId = id.replace('api-', '');
      const token = localStorage.getItem('warif_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';

      const response = await fetch(
        `${API_BASE}/api/v1/recommendations/${farmId}/feedback/${recId}`,
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
    
                <div className="flex flex-col gap-4">
                  {weekRecs.map((item, idx) => (
                    <RecommendationCard
                      key={item.id}
                      rec={{
                        id: item.id,
                        title: item.title,
                        message: item.suggestion || item.title,
                        reasoning: item.reasoning,
                        category: item.type || 'irrigation',
                        severity: item.severity || 'normal'
                      }}
                      farmId={farmId}
                      globalAutoMode={globalAutoMode}
                      isEn={isEn}
                      onExecute={executeRecommendation}
                      onIgnore={() => {}}
                      onFeedback={handleFeedback}
                      feedbackState={{}}
                      showThanks={showThanksIds}
                      compact={false}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
