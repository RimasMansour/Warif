/**
 * INTEGRATION EXAMPLES
 * How to use the improved RecommendationCard in different pages
 */

// ─────────────────────────────────────────────────────────────────
// EXAMPLE 1: Decision Support Page (Full Details)
// ─────────────────────────────────────────────────────────────────

import { RecommendationCard } from './DashboardShared';

function DecisionSupportPageExample() {
  const isEn = lang === 'en';
  const [recommendations, setRecommendations] = React.useState([]);
  const [feedbackState, setFeedbackState] = React.useState({});

  const handleFeedback = (id, value) => {
    setFeedbackState(prev => ({ ...prev, [id]: value }));
    // Send to API
    submitRecommendationFeedback(farmId, id, value === 'up');
  };

  const handleExecute = async (category, fid) => {
    await executeRecommendation(category, fid);
  };

  return (
    <div dir={isEn ? 'ltr' : 'rtl'}>
      <h1>{isEn ? 'Decision Support' : 'نظام الدعم الذكي'}</h1>

      {/* Grid: Full screen recommendation cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map(rec => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            farmId={farmId}
            isEn={isEn}
            globalAutoMode={autoMode}
            onExecute={handleExecute}
            onIgnore={() => setRecommendations(prev =>
              prev.filter(r => r.id !== rec.id)
            )}
            onFeedback={handleFeedback}
            feedbackState={feedbackState}
            compact={false}  // SHOW FULL DETAILS
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EXAMPLE 2: Home Dashboard (Compact View)
// ─────────────────────────────────────────────────────────────────

function DashboardHomeExample() {
  const isEn = lang === 'en';
  const [topRecs, setTopRecs] = React.useState([]);

  return (
    <div dir={isEn ? 'ltr' : 'rtl'}>
      <section className="mb-8">
        <h2>{isEn ? 'Top Recommendations' : 'أفضل التوصيات'}</h2>

        {/* Horizontal scroll or 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topRecs.slice(0, 4).map(rec => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              farmId={farmId}
              isEn={isEn}
              globalAutoMode={autoMode}
              onExecute={handleExecute}
              compact={true}  // HIDE REASONING FOR BREVITY
            />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EXAMPLE 3: Sensor Pages (Mixed View - Alert + Recommendations)
// ─────────────────────────────────────────────────────────────────

function SensorPageExample() {
  const isEn = lang === 'en';
  const [alerts, setAlerts] = React.useState([]);
  const [recommendations, setRecommendations] = React.useState([]);

  return (
    <div dir={isEn ? 'ltr' : 'rtl'}>
      {/* Critical Alerts Section */}
      {alerts.length > 0 && (
        <section className="mb-8 p-4 bg-red-50 rounded-2xl border border-red-100">
          <h3 className="text-red-700 font-bold mb-4">
            {isEn ? 'Alerts' : 'التنبيهات'}
          </h3>
          <div className="space-y-3">
            {alerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                isEn={isEn}
                globalAutoMode={autoMode}
                onFeedback={handleFeedback}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recommendations Section */}
      <section className="mb-8">
        <h3 className="font-bold mb-4">
          {isEn ? 'Recommendations' : 'التوصيات'}
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {recommendations.map(rec => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              farmId={farmId}
              isEn={isEn}
              globalAutoMode={autoMode}
              onExecute={handleExecute}
              onFeedback={handleFeedback}
              compact={true}  // Compact in sensor pages
            />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EXAMPLE 4: Healthy State (No Recommendations Needed)
// ─────────────────────────────────────────────────────────────────

function HealthyStateViewExample() {
  const isEn = lang === 'en';

  // When engine returns "النظام يعمل بشكل مثالي"
  const healthyRec = {
    id: 'health-001',
    message: isEn
      ? 'System Operating Optimally'
      : 'النظام يعمل بشكل مثالي',
    category: 'general',
    severity: 'normal',
    reasoning: isEn
      ? 'All indicators within optimal range. No action needed.'
      : 'جميع المؤشرات ضمن النطاق المثالي. لا توجد إجراءات مطلوبة.',
    confidence: 0.95
  };

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} className="p-8">
      {/* Centered healthy card */}
      <div className="max-w-md mx-auto">
        <RecommendationCard
          rec={healthyRec}
          farmId={farmId}
          isEn={isEn}
          globalAutoMode={true}  // Always auto in healthy state
          compact={false}
          onFeedback={handleFeedback}
        />
      </div>

      {/* Motivational message */}
      <div className="text-center mt-8 text-gray-600">
        <p className="text-lg font-medium">
          {isEn
            ? 'Your farm is operating at peak efficiency!'
            : 'مزرعتك تعمل بكفاءة قصوى!'}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EXAMPLE 5: With Filtering & Sorting
// ─────────────────────────────────────────────────────────────────

function RecommendationsWithFiltersExample() {
  const isEn = lang === 'en';
  const [allRecs, setAllRecs] = React.useState([]);
  const [filter, setFilter] = React.useState('all'); // 'all', 'urgent', 'warning', 'normal'

  const filteredRecs = React.useMemo(() => {
    if (filter === 'all') return allRecs;
    return allRecs.filter(r => r.severity === filter);
  }, [allRecs, filter]);

  return (
    <div dir={isEn ? 'ltr' : 'rtl'}>
      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'urgent', 'warning', 'normal'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-bold transition-colors
              ${filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            {isEn
              ? f.charAt(0).toUpperCase() + f.slice(1)
              : f === 'urgent' ? 'حرج'
              : f === 'warning' ? 'تحذير'
              : f === 'normal' ? 'عادي'
              : 'الكل'}
          </button>
        ))}
      </div>

      {/* Filtered Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRecs.map(rec => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            farmId={farmId}
            isEn={isEn}
            globalAutoMode={autoMode}
            onExecute={handleExecute}
            onFeedback={handleFeedback}
            compact={false}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredRecs.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">
            {isEn
              ? `No ${filter} recommendations`
              : `لا توجد توصيات ${filter === 'urgent' ? 'حرجة' : 'تحذير'}`}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EXAMPLE 6: Mobile-First Layout
// ─────────────────────────────────────────────────────────────────

function MobileRecommendationsExample() {
  const isEn = lang === 'en';
  const [recs, setRecs] = React.useState([]);
  const [expandedId, setExpandedId] = React.useState(null);

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} className="max-w-full px-4 py-4">
      {/* Stack on mobile, grid on desktop */}
      <div className="
        grid
        grid-cols-1     /* Mobile: 1 column */
        sm:grid-cols-2  /* Tablet: 2 columns */
        lg:grid-cols-3  /* Desktop: 3 columns */
        gap-3
        sm:gap-4
      ">
        {recs.map(rec => (
          <div
            key={rec.id}
            className="
              /* Mobile responsiveness */
              max-h-screen
              overflow-y-auto
            "
          >
            <RecommendationCard
              rec={rec}
              farmId={farmId}
              isEn={isEn}
              globalAutoMode={autoMode}
              onExecute={handleExecute}
              onFeedback={handleFeedback}
              compact={window.innerWidth < 640} /* Compact on mobile */
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLING: Tailwind Classes Reference
// ─────────────────────────────────────────────────────────────────

/**
 * Key Tailwind Classes for RTL:
 *
 * Direction:
 * - dir="rtl"               -> Force RTL
 * - dir="ltr"               -> Force LTR
 *
 * Flexbox Reversing:
 * - flex-row-reverse        -> Reverse order for RTL
 * - flex-col-reverse        -> Reverse column for RTL
 *
 * Text Alignment:
 * - text-right              -> For RTL
 * - text-left               -> For LTR
 *
 * Spacing (works correctly with direction):
 * - mr-4 / ml-4             -> Margin-right/left (auto-reverses)
 * - pr-4 / pl-4             -> Padding-right/left (auto-reverses)
 *
 * Grid:
 * - grid-cols-1             -> 1 column
 * - md:grid-cols-2          -> 2 columns on medium screens
 * - lg:grid-cols-3          -> 3 columns on large screens
 *
 * Colors (Recommendation Categories):
 * - bg-blue-50 / text-blue-700          -> Irrigation
 * - bg-amber-50 / text-amber-700        -> Temperature
 * - bg-slate-50 / text-slate-700        -> Humidity
 * - bg-emerald-50 / text-emerald-700    -> Health/General
 *
 * Font (Arabic):
 * - font-black              -> weight 900 (titles)
 * - font-bold               -> weight 700 (labels)
 * - font-medium             -> weight 500 (body)
 */

export {
  DecisionSupportPageExample,
  DashboardHomeExample,
  SensorPageExample,
  HealthyStateViewExample,
  RecommendationsWithFiltersExample,
  MobileRecommendationsExample
};
