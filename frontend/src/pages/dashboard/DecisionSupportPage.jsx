import React, { useMemo, useState, useEffect } from 'react';
import { translations } from '../../i18n';
import {
  SensorTopBar,
  CardShell,
  ListIcon,
  EmptyState,
  RecommendationCard
} from './DashboardShared';
import { useRecommendations, executeRecommendation, submitRecommendationFeedback, submitRecommendationAction } from '../../hooks/useWarifData';
import { markRecommendationRead } from '../../services/api';

export function DecisionSupportPage({ onBack, activeFarm, farmId, globalAutoMode, sharedSensors }) {
  const [showThanksIds, setShowThanksIds] = useState([]);

  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  const T = {
    title: isEn ? "Decision Support" : "التوصيات والقرارات الذكية",
    subtitle: isEn ? "Track and optimize AI decisions based on your data." : "تتبع وتحسين قرارات الذكاء الاصطناعي بناءً على بيانات المحمية.",
  };

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { data: apiRecs, error: recsError } = useRecommendations(farmId, {
    limit: 1000,
    since: weekStart
  });


  const allRecommendations = useMemo(() => {
    if (apiRecs && apiRecs.length > 0) {
      return apiRecs.map(r => ({
        id: `${r.source || 'recommendation'}-${r.id}`,
        rawId: r.id,
        source: r.source || 'recommendation',
        mode: 'auto',
        type: r.category || 'general',
        title: r.message || 'توصية',
        reasoning: r.data_insight || r.reasoning || '',
        severity: r.severity || 'normal',
        action_status: r.action_status,
        feedback: r.helpful === true ? 'up' : r.helpful === false ? 'down' : null,
        created_at: r.created_at,
        status: r.is_read ? 'accepted' : 'pending',
        week: isEn ? 'This Week' : 'هذا الأسبوع',
        farmIndices: [0, 1, 2],
      }));
    }
    return [];
  }, [apiRecs, isEn]);

  const [localRecs, setLocalRecs] = useState([]);
  const feedbackState = useMemo(() => (
    Object.fromEntries(localRecs.filter(rec => rec.feedback).map(rec => [rec.id, rec.feedback]))
  ), [localRecs]);

  useEffect(() => {
    let filtered = allRecommendations;
    // In manual mode, show API recommendations as actionable items for user review
    // In auto mode, show all recommendations (both auto and manual)
    setLocalRecs(filtered);
  }, [allRecommendations, globalAutoMode]);

  const handleFeedback = async (id, val) => {
    setLocalRecs(prev => prev.map(rec => rec.id === id ? { ...rec, feedback: val } : rec));
    if (!showThanksIds.includes(id)) {
      setShowThanksIds(prev => [...prev, id]);
    }
    const item = localRecs.find(rec => rec.id === id);
    const rawId = item?.rawId || String(id).replace(/^(recommendation|alert|api)-/, '');
    await submitRecommendationFeedback(farmId, rawId, val === 'up');
  };

  const handleDecision = async (id, val) => {
    setLocalRecs(prev => prev.map(rec => rec.id === id ? { ...rec, status: val } : rec));
    if (val === 'accepted') {
      const item = localRecs.find(rec => rec.id === id);
      await markRecommendationRead(farmId, String(item?.rawId || id).replace(/^(recommendation|api)-/, ''));
    }
  };

  const sections = isEn ? ["This Week", "Last Week"] : ["هذا الأسبوع", "الأسبوع الماضي"];

  return (
    <div className="w-full px-4 md:px-8 py-5 page-enter" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-[1150px] mx-auto flex flex-col gap-5 pb-8">
        
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
                        rawId: item.rawId,
                        title: item.title,
                        message: item.suggestion || item.title,
                        reasoning: item.reasoning,
                        category: item.type || 'irrigation',
                        severity: item.severity || 'normal',
                        action_status: item.action_status,
                        created_at: item.created_at,
                        source: item.source
                      }}
                      farmId={farmId}
                      globalAutoMode={globalAutoMode}
                      isEn={isEn}
                      onExecute={executeRecommendation}
                      onActionChange={(id, status) => submitRecommendationAction(farmId, id, status)}
                      onIgnore={() => {}}
                      onFeedback={handleFeedback}
                      feedbackState={feedbackState}
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
