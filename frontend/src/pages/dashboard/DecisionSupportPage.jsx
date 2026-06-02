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

function recommendationTime(rec) {
  const time = new Date(rec.created_at || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function recommendationDayKey(rec) {
  const time = recommendationTime(rec);
  if (!time) return '';
  return new Date(time).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
}

function dayKeyFromDate(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
}

function recommendationStatus(rec) {
  const actionStatus = rec.action_status;
  const decisionState = rec.decision_state?.state;
  if (actionStatus === 'stale' || decisionState === 'stale') return 'stale';
  if (actionStatus === 'legacy' || decisionState === 'legacy') return 'legacy';
  if (actionStatus === 'executed' || decisionState === 'completed') return 'completed';
  if (actionStatus === 'executing' || decisionState === 'executing') return 'pending';
  if (actionStatus === 'deferred' || actionStatus === 'ignored' || decisionState === 'blocked') return 'blocked';
  return 'pending';
}

function deferredReason(rec, isEn) {
  const category = String(rec.category || rec.type || '').toLowerCase();
  const text = `${rec.message || ''} ${rec.reasoning || ''} ${rec.data_insight || ''}`.toLowerCase();
  if (
    (category === 'irrigation' || category === 'water' || category === 'soil_moisture') &&
    (text.includes('ليل') || text.includes('night') || text.includes('فطر') || text.includes('fungal'))
  ) {
    return isEn
      ? 'The system did not start irrigation because the current period is nighttime. Watering now can keep leaves or soil wet for longer and increase fungal disease risk, so irrigation will be re-evaluated when safety conditions improve.'
      : 'لم يشغّل النظام الري لأن الوقت الحالي فترة ليلية. الري الآن قد يبقي الأوراق أو التربة رطبة لفترة أطول ويزيد خطر الأمراض الفطرية، لذلك سيُعاد تقييم الري عند تحسن شروط السلامة.';
  }
  return isEn
    ? 'The system delayed this recommendation because current safety conditions are not suitable.'
    : 'أجّل النظام هذه التوصية لأن شروط السلامة الحالية غير مناسبة.';
}

function inferredDecisionState(rec, isEn) {
  if (rec.decision_state) return rec.decision_state;
  const category = String(rec.category || rec.type || '').toLowerCase();
  if (rec.action_status === 'deferred') {
    const reason = deferredReason(rec, isEn);
    return {
      state: 'blocked',
      label: category === 'irrigation' || category === 'water' || category === 'soil_moisture'
        ? (isEn ? 'Irrigation Deferred' : 'ري مؤجل')
        : (isEn ? 'Deferred' : 'مؤجل'),
      label_en: category === 'irrigation' || category === 'water' || category === 'soil_moisture'
        ? 'Irrigation Deferred'
        : 'Deferred',
      reason,
      reason_en: deferredReason(rec, true),
    };
  }
  if (rec.action_status === 'legacy' || rec.action_status === 'auto') {
    if (category === 'irrigation' || category === 'water' || category === 'soil_moisture') {
      const reason = deferredReason(rec, isEn);
      return {
        state: 'blocked',
        label: isEn ? 'Irrigation Deferred' : 'ري مؤجل',
        label_en: 'Irrigation Deferred',
        reason,
        reason_en: deferredReason(rec, true),
      };
    }
    return {
      state: 'monitoring',
      label: isEn ? 'No Action Needed Now' : 'لا يتطلب إجراء الآن',
      label_en: 'No Action Needed Now',
      reason: isEn
        ? 'The latest readings do not require a device command right now. The system will re-evaluate this recommendation when new sensor data arrives.'
        : 'القراءات الحالية لا تحتاج أمر جهاز الآن. سيعيد النظام تقييم هذه التوصية عند وصول قراءة حساسات جديدة.',
      reason_en: 'The latest readings do not require a device command right now. The system will re-evaluate this recommendation when new sensor data arrives.',
    };
  }
  if (rec.action_status === 'executed') {
    return {
      state: 'completed',
      label: isEn ? 'Executed' : 'تم التنفيذ',
      label_en: 'Executed',
      reason: '',
      reason_en: '',
    };
  }
  if (rec.action_status === 'executing') {
    return {
      state: 'executing',
      label: isEn ? 'In Progress' : 'قيد التنفيذ',
      label_en: 'In Progress',
      reason: isEn
        ? 'The related device command is active and the system is monitoring the latest readings.'
        : 'أمر الجهاز المرتبط قيد العمل، والنظام يراقب أحدث القراءات.',
      reason_en: 'The related device command is active and the system is monitoring the latest readings.',
    };
  }
  return null;
}

export function DecisionSupportPage({ onBack, farmId, globalAutoMode }) {
  const [showThanksIds, setShowThanksIds] = useState([]);
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState(() => dayKeyFromDate(new Date()));

  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  const T = {
    title: isEn ? "Decision Support" : "التوصيات والقرارات الذكية",
    subtitle: isEn ? "Track and optimize AI decisions based on your data." : "تتبع وتحسين قرارات الذكاء الاصطناعي بناءً على بيانات المحمية.",
  };

  const { data: apiRecs, error: recsError } = useRecommendations(farmId, {
    includeAlerts: true,
    includeState: false,
    limit: 5000,
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
        decision_state: inferredDecisionState(r, isEn),
        feedback: r.helpful === true ? 'up' : r.helpful === false ? 'down' : null,
        created_at: r.created_at,
        status: r.is_read ? 'accepted' : 'pending',
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
  }, [allRecommendations]);

  const handleFeedback = async (id, val) => {
    setLocalRecs(prev => prev.map(rec => rec.id === id ? { ...rec, feedback: val } : rec));
    if (!showThanksIds.includes(id)) {
      setShowThanksIds(prev => [...prev, id]);
    }
    const item = localRecs.find(rec => rec.id === id);
    const rawId = item?.rawId || String(id).replace(/^(recommendation|alert|api)-/, '');
    return submitRecommendationFeedback(farmId, rawId, val === 'up');
  };

  const _handleDecision = async (id, val) => {
    setLocalRecs(prev => prev.map(rec => rec.id === id ? { ...rec, status: val } : rec));
    if (val === 'accepted') {
      const item = localRecs.find(rec => rec.id === id);
      await markRecommendationRead(farmId, String(item?.rawId || id).replace(/^(recommendation|api)-/, ''));
    }
  };

  const scopeFilters = useMemo(() => {
    const weekdaysAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const weekdaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - index);
      return {
        key: dayKeyFromDate(date),
        label: isEn ? weekdaysEn[date.getDay()] : weekdaysAr[date.getDay()],
      };
    });
  }, [isEn]);

  const decisionFilters = useMemo(() => [
    { key: 'all', label: isEn ? 'All' : 'الكل' },
    { key: 'blocked', label: isEn ? 'Deferred' : 'مؤجل' },
    { key: 'completed', label: isEn ? 'Executed' : 'تم التنفيذ' },
  ], [isEn]);
  const stateStyles = {
    all: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    blocked: 'border-amber-100 bg-amber-50 text-amber-700',
    completed: 'border-teal-100 bg-teal-50 text-teal-700',
  };
  const scopeCounts = useMemo(() => {
    const counts = Object.fromEntries(scopeFilters.map(item => [item.key, 0]));
    localRecs.forEach(rec => {
      const key = recommendationDayKey(rec);
      if (key in counts) counts[key] += 1;
    });
    return counts;
  }, [localRecs, scopeFilters]);
  useEffect(() => {
    if ((scopeCounts[scopeFilter] || 0) > 0) return;
    const firstPopulatedDay = scopeFilters.find(filter => (scopeCounts[filter.key] || 0) > 0);
    if (firstPopulatedDay) {
      const id = window.setTimeout(() => setScopeFilter(firstPopulatedDay.key), 0);
      return () => window.clearTimeout(id);
    }
  }, [scopeCounts, scopeFilter, scopeFilters]);
  const scopedRecs = useMemo(() => {
    return localRecs.filter(rec => {
      return recommendationDayKey(rec) === scopeFilter;
    });
  }, [localRecs, scopeFilter]);
  const decisionCounts = useMemo(() => {
    const counts = Object.fromEntries(decisionFilters.map(item => [item.key, 0]));
    counts.all = scopedRecs.length;
    scopedRecs.forEach(rec => {
      const state = recommendationStatus(rec);
      counts[state] = (counts[state] || 0) + 1;
    });
    return counts;
  }, [decisionFilters, scopedRecs]);
  const visibleRecs = useMemo(() => (
    decisionFilter === 'all'
      ? scopedRecs
      : scopedRecs.filter(rec => recommendationStatus(rec) === decisionFilter)
  ), [decisionFilter, scopedRecs]);
  const currentScopeLabel = scopeFilters.find(filter => filter.key === scopeFilter)?.label || (isEn ? 'Recommendations' : 'التوصيات');

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
                {scopeFilters.reduce((total, filter) => total + (scopeCounts[filter.key] || 0), 0)}
             </div>
             <div>
                <div className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">{isEn ? "Last 7 Days" : "توصيات آخر 7 أيام"}</div>
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
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-black transition-all ${active ? 'border-sky-100 bg-sky-50 text-sky-700' : 'bg-white/80 border-gray-100 text-gray-500 hover:bg-gray-50'}`}
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
          <div className="flex flex-col gap-4 animate-fade-in-up delay-2">
            <div className={`text-[14px] font-bold text-gray-800 flex items-center gap-3 mt-2`}>
              <span className="text-xs font-black text-emerald-700 bg-emerald-50/50 px-3 py-1 rounded-xl border border-emerald-100/30 uppercase tracking-widest">{currentScopeLabel}</span>
              <div className="h-px bg-gray-100 flex-1" />
            </div>

            <div className="flex flex-col gap-4">
              {visibleRecs.map((item) => (
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
                  onDismiss={(id) => setLocalRecs(prev => prev.filter(rec => rec.id !== id))}
                  onFeedback={handleFeedback}
                  feedbackState={feedbackState}
                  showThanks={showThanksIds}
                  compact={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
