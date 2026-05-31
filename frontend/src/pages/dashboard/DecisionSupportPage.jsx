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

const DAY_MS = 24 * 60 * 60 * 1000;

function recommendationTime(rec) {
  const time = new Date(rec.created_at || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isHandledRecommendation(rec) {
  const actionStatus = rec.action_status;
  const decisionState = rec.decision_state?.state;
  return actionStatus === 'executed' || actionStatus === 'ignored' || decisionState === 'completed';
}

export function DecisionSupportPage({ onBack, farmId, globalAutoMode }) {
  const [showThanksIds, setShowThanksIds] = useState([]);
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('active');

  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  const T = {
    title: isEn ? "Decision Support" : "التوصيات والقرارات الذكية",
    subtitle: isEn ? "Track and optimize AI decisions based on your data." : "تتبع وتحسين قرارات الذكاء الاصطناعي بناءً على بيانات المحمية.",
  };

  const { data: apiRecs, error: recsError } = useRecommendations(farmId, {
    limit: 1000,
  });


  const allRecommendations = useMemo(() => {
    if (apiRecs && apiRecs.length > 0) {
      const sevenDaysAgo = Date.now() - (7 * DAY_MS);
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
        decision_state: r.decision_state,
        feedback: r.helpful === true ? 'up' : r.helpful === false ? 'down' : null,
        created_at: r.created_at,
        status: r.is_read ? 'accepted' : 'pending',
        week: recommendationTime(r) >= sevenDaysAgo ? (isEn ? 'This Week' : 'هذا الأسبوع') : (isEn ? 'Last Week' : 'الأسبوع الماضي'),
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const _handleDecision = async (id, val) => {
    setLocalRecs(prev => prev.map(rec => rec.id === id ? { ...rec, status: val } : rec));
    if (val === 'accepted') {
      const item = localRecs.find(rec => rec.id === id);
      await markRecommendationRead(farmId, String(item?.rawId || id).replace(/^(recommendation|api)-/, ''));
    }
  };

  const sections = isEn ? ["This Week", "Last Week"] : ["هذا الأسبوع", "الأسبوع الماضي"];

  const scopeFilters = useMemo(() => [
    { key: 'active', label: isEn ? 'Active' : 'النشطة' },
    { key: '24h', label: isEn ? '24h' : '24 ساعة' },
    { key: '7d', label: isEn ? '7d' : '7 أيام' },
    { key: 'archive', label: isEn ? 'Archive' : 'الأرشيف' },
    { key: 'all', label: isEn ? 'All' : 'الكل' },
  ], [isEn]);

  const decisionFilters = useMemo(() => [
    { key: 'all', label: isEn ? 'All' : 'الكل' },
    { key: 'pending', label: isEn ? 'Pending' : 'قيد الإرسال' },
    { key: 'executing', label: isEn ? 'Executing' : 'قيد التنفيذ' },
    { key: 'blocked', label: isEn ? 'Deferred' : 'مؤجل' },
    { key: 'completed', label: isEn ? 'Completed' : 'مكتمل' },
    { key: 'failed', label: isEn ? 'Review' : 'يحتاج مراجعة' },
    { key: 'hold', label: isEn ? 'No Action' : 'بدون إجراء' },
  ], [isEn]);
  const stateStyles = {
    all: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    pending: 'border-sky-100 bg-sky-50 text-sky-700',
    executing: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    blocked: 'border-amber-100 bg-amber-50 text-amber-700',
    completed: 'border-teal-100 bg-teal-50 text-teal-700',
    failed: 'border-red-100 bg-red-50 text-red-700',
    hold: 'border-gray-100 bg-gray-50 text-gray-600',
  };
  const scopeStyles = {
    active: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    '24h': 'border-sky-100 bg-sky-50 text-sky-700',
    '7d': 'border-indigo-100 bg-indigo-50 text-indigo-700',
    archive: 'border-gray-200 bg-gray-50 text-gray-600',
    all: 'border-teal-100 bg-teal-50 text-teal-700',
  };
  const scopeCounts = useMemo(() => {
    const now = Date.now();
    const counts = Object.fromEntries(scopeFilters.map(item => [item.key, 0]));
    counts.all = localRecs.length;
    localRecs.forEach(rec => {
      const age = now - recommendationTime(rec);
      const within24h = age >= 0 && age <= DAY_MS;
      const within7d = age >= 0 && age <= 7 * DAY_MS;
      const handled = isHandledRecommendation(rec);
      if (!handled && within7d) counts.active += 1;
      if (within24h) counts['24h'] += 1;
      if (within7d) counts['7d'] += 1;
      if (handled || !within7d) counts.archive += 1;
    });
    return counts;
  }, [localRecs, scopeFilters]);
  const scopedRecs = useMemo(() => {
    const now = Date.now();
    return localRecs.filter(rec => {
      if (scopeFilter === 'all') return true;
      const age = now - recommendationTime(rec);
      const within24h = age >= 0 && age <= DAY_MS;
      const within7d = age >= 0 && age <= 7 * DAY_MS;
      const handled = isHandledRecommendation(rec);
      if (scopeFilter === 'active') return !handled && within7d;
      if (scopeFilter === '24h') return within24h;
      if (scopeFilter === '7d') return within7d;
      if (scopeFilter === 'archive') return handled || !within7d;
      return true;
    });
  }, [localRecs, scopeFilter]);
  const decisionCounts = useMemo(() => {
    const counts = Object.fromEntries(decisionFilters.map(item => [item.key, 0]));
    counts.all = scopedRecs.length;
    scopedRecs.forEach(rec => {
      const state = rec.decision_state?.state || 'hold';
      counts[state] = (counts[state] || 0) + 1;
    });
    return counts;
  }, [decisionFilters, scopedRecs]);
  const visibleRecs = useMemo(() => (
    decisionFilter === 'all'
      ? scopedRecs
      : scopedRecs.filter(rec => (rec.decision_state?.state || 'hold') === decisionFilter)
  ), [decisionFilter, scopedRecs]);

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
                {scopeCounts.active}
             </div>
             <div>
                <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">{isEn ? "Active Recommendations" : "التوصيات النشطة"}</div>
             </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 animate-fade-in-up delay-1">
          {scopeFilters.map(filter => {
            const active = scopeFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setScopeFilter(filter.key)}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-black transition-all ${active ? scopeStyles[filter.key] : 'bg-white/80 border-gray-100 text-gray-500 hover:bg-gray-50'}`}
              >
                {filter.label}
                <span className="ms-1 opacity-70">{scopeCounts[filter.key] || 0}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 animate-fade-in-up delay-1">
          {decisionFilters.map(filter => {
            const active = decisionFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setDecisionFilter(filter.key)}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-black transition-all ${active ? stateStyles[filter.key] : 'bg-white/80 border-gray-100 text-gray-500 hover:bg-gray-50'}`}
              >
                {filter.label}
                <span className="ms-1 opacity-70">{decisionCounts[filter.key] || 0}</span>
              </button>
            );
          })}
        </div>

        {visibleRecs.length === 0 ? (
          <EmptyState
            title={recsError ? `خطأ: ${recsError}` : (isEn ? "All Systems Optimal" : "جميع الأنظمة في الحالة المثالية")}
            subtitle={recsError ? (isEn ? "Try refreshing" : "حاول إعادة التحميل") : (isEn ? "No actions needed right now. Everything is running perfectly." : "لا توجد توصيات الآن - كل شيء يعمل بشكل مثالي ومتوازن.")}
          />
        ) : (
          sections.map((week, sIdx) => {
            const weekRecs = visibleRecs.filter(r => r.week === week);
            if (weekRecs.length === 0) return null;

            return (
              <div key={week} className={`flex flex-col gap-4 animate-fade-in-up delay-${sIdx + 2}`}>
                <div className={`text-[14px] font-bold text-gray-800 flex items-center gap-3 mt-2`}>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50/50 px-3 py-1 rounded-xl border border-emerald-100/30 uppercase tracking-widest">{week}</span>
                  <div className="h-px bg-gray-100 flex-1" />
                </div>
    
                <div className="flex flex-col gap-4">
                  {weekRecs.map((item) => (
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
                        decision_state: item.decision_state,
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
