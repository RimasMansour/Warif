/**
 * HEALTHY STATE RECOMMENDATION CARD
 * How the card appears when system returns "النظام يعمل بشكل مثالي"
 *
 * Visual Layout:
 * ┌─────────────────────────────────────────────┐
 * │ [الصحة] النظام يعمل بشكل مثالي        ✓   │
 * │                                             │
 * │ جميع المؤشرات ضمن النطاق المثالي:       │
 * │ رطوبة التربة 67%, حرارة 25°م, رطوبة 60%  │
 * │                                             │
 * │ [👎] مفيدة؟ [👍] ........ تلقائي        │
 * └─────────────────────────────────────────────┘
 */

// Example 1: Arabic (RTL) - "Healthy State"
export const HealthyStateExample_AR = {
  id: "api-health-001",
  message: "النظام يعمل بشكل مثالي",
  title: "الصحة العامة للنظام",
  reasoning: `جميع المؤشرات ضمن النطاق المثالي:
رطوبة التربة 67% (نطاق مثالي 70%)
درجة الحرارة 25°م (نطاق مثالي 20-30°م)
رطوبة الهواء 60% (نطاق مثالي 50-70%)
سوية المياه جيدة`,
  category: "general",
  severity: "normal",
  confidence: 0.95,
  is_read: false
};

// Example 2: English (LTR) - "Healthy State"
export const HealthyStateExample_EN = {
  id: "api-health-001",
  message: "System Operating Optimally",
  title: "System Health",
  reasoning: `All indicators within optimal range:
Soil moisture 67% (optimal range 70%)
Air temperature 25°C (optimal range 20-30°C)
Humidity 60% (optimal range 50-70%)
Water level is good`,
  category: "general",
  severity: "normal",
  confidence: 0.95,
  is_read: false
};

// Example 3: Warning State (for comparison)
export const WarningStateExample_AR = {
  id: "api-rec-002",
  message: "زيادة فترات الري",
  title: "تحسين إدارة الري",
  reasoning: `رطوبة التربة الحالية (45%) انخفضت عن الحد الأدنى المتوقع لنمو الخيار (70%).
الإجراء: تفعيل الري الفوري لتجنب إجهاد النبات.
التوقيت المثالي: الصباح الباكر (5-7 صباحاً) لتقليل التبخر`,
  category: "irrigation",
  severity: "warning",
  confidence: 0.85,
  is_read: false
};

// Example 4: Urgent State
export const UrgentStateExample_AR = {
  id: "api-rec-003",
  message: "تنبيه حراري حرج",
  title: "ارتفاع درجة الحرارة",
  reasoning: `درجة الحرارة الحالية (42°م) تجاوزت الحد الحرج (38°م) بشكل خطير.
التأثير: إجهاد حراري شديد على النبات، توقف النمو، احتمال موت النبات.
الإجراء الفوري: تفعيل نظام التبريد الكامل (مروحة + مكيف) فوراً`,
  category: "temperature",
  severity: "urgent",
  confidence: 0.98,
  is_read: false
};

// Usage in component:
export function HealthyStateDemo() {
  const [selectedLang, setSelectedLang] = React.useState('ar');
  const isEn = selectedLang === 'en';

  const healthyRec = isEn ? HealthyStateExample_EN : HealthyStateExample_AR;

  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh',
      fontFamily: isEn ? 'inherit' : '"Cairo", "Tajawal", sans-serif',
      direction: isEn ? 'ltr' : 'rtl'
    }}>
      {/* Language Toggle */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setSelectedLang('en')}
          style={{
            padding: '8px 16px',
            marginRight: '10px',
            backgroundColor: isEn ? '#10b981' : '#e5e7eb',
            color: isEn ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          English
        </button>
        <button
          onClick={() => setSelectedLang('ar')}
          style={{
            padding: '8px 16px',
            backgroundColor: !isEn ? '#10b981' : '#e5e7eb',
            color: !isEn ? 'white' : '#6b7280',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          العربية
        </button>
      </div>

      {/* Healthy State Card */}
      <div style={{
        maxWidth: '500px',
        margin: '20px auto',
        padding: '16px',
        borderRadius: '24px',
        backgroundColor: '#f0fdf4',
        border: '1px solid #bbf7d0',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '8px',
          flexDirection: isEn ? 'row' : 'row-reverse'
        }}>
          {/* Badge */}
          <span style={{
            fontSize: '10px',
            fontWeight: '900',
            padding: '4px 8px',
            borderRadius: '6px',
            backgroundColor: '#d0f0ce',
            color: '#166534',
            whiteSpace: 'nowrap'
          }}>
            {isEn ? 'Health' : 'الصحة'}
          </span>

          {/* Title + Icon */}
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              flexDirection: isEn ? 'row' : 'row-reverse'
            }}>
              <h4 style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#166534',
                flex: 1,
                wordBreak: 'break-word'
              }}>
                {healthyRec.message}
              </h4>
              {/* Green Checkmark Icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ color: '#10b981', flexShrink: 0 }}
              >
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Reasoning */}
        <div style={{
          fontSize: '13px',
          color: '#4b5563',
          lineHeight: '1.6',
          marginTop: '12px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          textAlign: isEn ? 'left' : 'right'
        }}>
          {healthyRec.reasoning}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid #bbf7d0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexDirection: isEn ? 'row' : 'row-reverse',
          gap: '8px'
        }}>
          {/* Feedback Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexDirection: isEn ? 'row' : 'row-reverse'
          }}>
            <span style={{
              fontSize: '10px',
              fontWeight: 'bold',
              color: '#9ca3af',
              whiteSpace: 'nowrap'
            }}>
              {isEn ? 'Helpful?' : 'مفيدة؟'}
            </span>
            <button style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              color: '#d1d5db',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}>
              👎
            </button>
            <button style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              color: '#d1d5db',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}>
              👍
            </button>
          </div>

          {/* Auto Badge (no Execute button in healthy state) */}
          <div style={{
            paddingLeft: '12px',
            paddingRight: '12px',
            paddingTop: '4px',
            paddingBottom: '4px',
            backgroundColor: '#ecfdf5',
            color: '#047857',
            fontSize: '10px',
            fontWeight: '900',
            borderRadius: '6px',
            border: '1px solid #d1fae5',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" />
            </svg>
            {isEn ? 'Auto' : 'تلقائي'}
          </div>
        </div>
      </div>

      {/* Comparison Grid */}
      <div style={{ marginTop: '60px' }}>
        <h2 style={{ textAlign: isEn ? 'left' : 'right' }}>
          {isEn ? 'Severity Levels Comparison' : 'مقارنة مستويات الأهمية'}
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
          marginTop: '20px'
        }}>
          {/* Healthy */}
          <div style={{
            padding: '16px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '12px'
          }}>
            <div style={{ fontWeight: 'bold', color: '#166534', marginBottom: '8px' }}>
              ✓ {isEn ? 'Healthy' : 'صحي'}
            </div>
            <div style={{ fontSize: '12px', color: '#059669' }}>
              {isEn
                ? 'All systems operating within optimal range'
                : 'جميع الأنظمة تعمل ضمن النطاق المثالي'}
            </div>
          </div>

          {/* Warning */}
          <div style={{
            padding: '16px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '12px'
          }}>
            <div style={{ fontWeight: 'bold', color: '#92400e', marginBottom: '8px' }}>
              ⚠️ {isEn ? 'Warning' : 'تحذير'}
            </div>
            <div style={{ fontSize: '12px', color: '#b45309' }}>
              {isEn
                ? 'Attention needed soon, action recommended'
                : 'يحتاج انتباه قريب، الإجراء موصى به'}
            </div>
          </div>

          {/* Urgent */}
          <div style={{
            padding: '16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px'
          }}>
            <div style={{ fontWeight: 'bold', color: '#7f1d1d', marginBottom: '8px' }}>
              🔴 {isEn ? 'Urgent' : 'حرج'}
            </div>
            <div style={{ fontSize: '12px', color: '#dc2626' }}>
              {isEn
                ? 'Immediate action required to prevent damage'
                : 'إجراء فوري مطلوب لمنع الضرر'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HealthyStateDemo;
