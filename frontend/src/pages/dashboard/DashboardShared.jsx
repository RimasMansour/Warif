import * as React from 'react';
import { useState, useEffect } from 'react';
import { formatLastUpdated } from './dashboardUtils';

// ─── ALERT TRANSLATION TABLES ────────────────────────────────────────────────
const ALERT_SENSOR_NAMES = {
  air_temperature:  { ar: 'درجة حرارة الهواء', en: 'Air Temperature' },
  temperature:      { ar: 'درجة حرارة الهواء', en: 'Air Temperature' },
  air_humidity:     { ar: 'رطوبة الهواء',       en: 'Air Humidity' },
  humidity:         { ar: 'رطوبة الهواء',       en: 'Air Humidity' },
  soil_moisture:    { ar: 'رطوبة التربة',        en: 'Soil Moisture' },
  irrigation:       { ar: 'رطوبة التربة',        en: 'Soil Moisture' },
  soil_temperature: { ar: 'درجة حرارة التربة',  en: 'Soil Temperature' },
  light_intensity:  { ar: 'شدة الإضاءة',        en: 'Light Intensity' },
  water_tank:       { ar: 'خزان المياه',         en: 'Water Tank' },
  water_usage:      { ar: 'استهلاك المياه',      en: 'Water Usage' },
  power_usage:      { ar: 'استهلاك الطاقة',     en: 'Power Usage' },
  energy_kwh:       { ar: 'استهلاك الطاقة',     en: 'Energy Usage' },
  multi_sensor:     { ar: 'النظام',              en: 'System' },
};

const alertTitleForSensor = (sensorType, lang) => {
  const titles = {
    air_temperature:  { ar: 'تنبيه حرارة',       en: 'Temperature Alert' },
    temperature:      { ar: 'تنبيه حرارة',       en: 'Temperature Alert' },
    soil_temperature: { ar: 'تنبيه حرارة التربة', en: 'Soil Temperature Alert' },
    air_humidity:     { ar: 'تنبيه رطوبة',       en: 'Humidity Alert' },
    humidity:         { ar: 'تنبيه رطوبة',       en: 'Humidity Alert' },
    soil_moisture:    { ar: 'تنبيه رطوبة التربة', en: 'Soil Moisture Alert' },
    irrigation:       { ar: 'تنبيه رطوبة التربة', en: 'Soil Moisture Alert' },
    light_intensity:  { ar: 'تنبيه إضاءة',       en: 'Light Alert' },
    water_tank:       { ar: 'تنبيه مياه',        en: 'Water Alert' },
    water_usage:      { ar: 'تنبيه مياه',        en: 'Water Alert' },
    power_usage:      { ar: 'تنبيه طاقة',        en: 'Power Alert' },
    energy_kwh:       { ar: 'تنبيه طاقة',        en: 'Power Alert' },
  };
  return titles[sensorType]?.[lang] || (lang === 'ar' ? 'تنبيه' : 'Alert');
};

const ALERT_ANOMALY_TEXT = {
  sensor_stuck: {
    ar: (s, v, title) => `${title}: قراءة ${s} ثابتة عند ${v} - قد يكون الحساس عالقًا، تحقق منه أو أعد تشغيله.`,
    en: (s, v, title) => `${title}: ${s} is fixed at ${v} - the sensor may be stuck. Reboot or recalibrate it.`,
  },
  unrealistic_jump: {
    ar: (s, v, title) => `${title}: سجّلت قراءة ${s} تغيرًا مفاجئًا ووصلت إلى ${v} - افحص الحساس وقناة الإرسال.`,
    en: (s, v, title) => `${title}: ${s} jumped suddenly to ${v} - inspect the sensor and telemetry channel.`,
  },
  pattern_break: {
    ar: (s, v, title) => `${title}: ${s} (${v}) سجل انحرافاً ملحوظاً عن النمط الطبيعي للقراءات.`,
    en: (s, v, title) => `${title}: ${s} (${v}) shows a clear deviation from the normal reading pattern.`,
  },
  threshold_violation: {
    ar: (s, v, title, alert) => {
      const threshold = formatAlertValue(alert.sensor_type, alert.threshold, 'ar');
      const value = formatAlertValue(alert.sensor_type, alert.actual_value ?? alert.value, 'ar') || v;
      if (threshold) {
        return `${s} (${value}) اقتربت من الحد الذي يتطلب الانتباه (${threshold}). التوصية: راجع الحالة الحالية واتخذ الإجراء المناسب للحفاظ على استقرار المحصول.`;
      }
      return `${title}: سجّلت ${s} قراءة قدرها ${value} - تجاوزت الحد المسموح، ويجب التدخل فوراً.`;
    },
    en: (s, v, title, alert) => {
      const threshold = formatAlertValue(alert.sensor_type, alert.threshold, 'en');
      const value = formatAlertValue(alert.sensor_type, alert.actual_value ?? alert.value, 'en') || v;
      if (threshold) {
        return `${s} (${value}) is moving toward the critical threshold (${threshold}). Recommendation: increase irrigation frequency gradually or take the appropriate corrective action.`;
      }
      return `${title}: ${s} reached ${value} - allowed threshold exceeded and immediate action is required.`;
    },
  },
};

const hasArabicText = (text = '') => /[\u0600-\u06FF]/.test(String(text));

const formatAlertNumber = (value, decimals = 1) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(decimals) : null;
};

const ALERT_SENSOR_UNITS = {
  air_temperature: { ar: '°م', en: '°C' },
  temperature: { ar: '°م', en: '°C' },
  soil_temperature: { ar: '°م', en: '°C' },
  air_humidity: { ar: '%', en: '%' },
  humidity: { ar: '%', en: '%' },
  soil_moisture: { ar: '%', en: '%' },
  irrigation: { ar: '%', en: '%' },
  water_tank: { ar: '%', en: '%' },
  light_intensity: { ar: 'لوكس', en: 'lux' },
  water_usage: { ar: 'لتر', en: 'L' },
  power_usage: { ar: 'واط-ساعة', en: 'Wh' },
  energy_kwh: { ar: 'كيلوواط-ساعة', en: 'kWh' },
};

const formatAlertValue = (sensorType, value, lang) => {
  const num = formatAlertNumber(value, sensorType === 'light_intensity' ? 0 : 1);
  if (num === null) return null;
  const unit = ALERT_SENSOR_UNITS[sensorType]?.[lang] || '';
  return unit ? `${num}${unit}` : num;
};

const matchesAlertLanguage = (text, lang) => {
  if (!text) return false;
  return lang === 'ar' ? hasArabicText(text) : !hasArabicText(text);
};

const localizedGenericAlertMessage = (alert, isEn, sensorName) => {
  const rawValue = alert.actual_value ?? alert.value;
  const value = rawValue !== undefined && rawValue !== null && rawValue !== ''
    ? ` ${Number.isFinite(Number(rawValue)) ? Number(rawValue).toFixed(1) : rawValue}`
    : '';

  return isEn
    ? `Alert for ${sensorName}${value}. Review the current condition and take the appropriate action.`
    : `تنبيه في ${sensorName}${value}. راجع الحالة الحالية واتخذ الإجراء المناسب.`;
};

const localizedRecommendationCopy = (rec, isEn) => {
  const category = String(rec?.category || rec?.type || 'general').toLowerCase();
  const message = String(rec?.message || rec?.title || '').trim();
  const reasoning = String(rec?.reasoning || '').trim();
  const valueMatch = reasoning.match(/(\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*°\s*[Cc]|\d+(?:\.\d+)?)/);
  const value = valueMatch ? valueMatch[1] : (isEn ? 'current value' : 'القيمة الحالية');
  const numericValue = valueMatch ? Number.parseFloat(valueMatch[1]) : null;

  const EN = {
    general: {
      title: 'System Status',
      reasoning: 'All indicators are within the ideal range. Continue monitoring the greenhouse conditions.',
    },
    irrigation_increase: {
      title: 'Increase Irrigation Frequency',
      reasoning: `Soil moisture (${value}) is below the suitable crop range (70-80%). Recommendation: run irrigation to restore soil moisture without saturation.`,
    },
    irrigation_reduce: {
      title: 'Reduce Irrigation',
      reasoning: `Soil moisture (${value}) is above the ideal range for the crop (80%). Recommendation: reduce irrigation frequency to conserve water and protect the roots.`,
    },
    temperature_high: {
      title: 'Activate Cooling',
      reasoning: `Current temperature (${value}) has exceeded the critical threshold (38°C). Recommendation: activate cooling systems immediately and open all ventilation windows.`,
    },
    temperature_moderate: {
      title: 'Improve Cooling and Ventilation',
      reasoning: `Current temperature (${value}) is higher than the ideal range (28°C). Recommendation: increase ventilation and confirm airflow to avoid plant stress.`,
    },
    temperature_low: {
      title: 'Activate Heating',
      reasoning: `Current temperature (${value}) has dropped below the lower limit (15°C). Recommendation: activate heating gradually to avoid thermal shock to the crop.`,
    },
    humidity_high: {
      title: 'Improve Ventilation',
      reasoning: `Current air humidity (${value}) is too high. Recommendation: improve ventilation to reduce the risk of fungal disease.`,
    },
    humidity_low: {
      title: 'Activate Misting',
      reasoning: `Current air humidity (${value}) is below the lower limit (40%). Recommendation: activate the misting system to raise humidity and reduce water stress.`,
    },
    soil_hot: {
      title: 'Protect Soil from Heat',
      reasoning: `Current soil temperature (${value}) is too high and may reduce root nutrient uptake. Recommendation: use shading or soil cover to lower the temperature.`,
    },
    soil_cold: {
      title: 'Reduce Irrigation in Cold Weather',
      reasoning: `Current soil temperature (${value}) is very low and slows microbial activity. Recommendation: reduce irrigation frequency to avoid root rot.`,
    },
  };

  const AR = {
    general: {
      title: 'الحالة العامة للنظام',
      reasoning: 'جميع المؤشرات ضمن النطاق المثالي. استمر في مراقبة ظروف المحمية.',
    },
    irrigation_increase: {
      title: 'زيادة تكرار الري',
      reasoning: `رطوبة التربة (${value}) أقل من النطاق المناسب للمحصول (70-80%). التوصية: تشغيل الري لاستعادة رطوبة التربة المناسبة بدون تشبع.`,
    },
    irrigation_reduce: {
      title: 'تقليل الري',
      reasoning: `رطوبة التربة (${value}) أعلى من المدى المناسب للمحصول (80%). التوصية: تقليل تكرار الري لتوفير المياه وتجنب تعفن الجذور.`,
    },
    temperature_high: {
      title: 'تفعيل التبريد',
      reasoning: `درجة الحرارة الحالية (${value}) تجاوزت الحد الحرج (38°م). التوصية: تشغيل أنظمة التبريد فورًا وتعزيز التهوية للحد من الإجهاد الحراري.`,
    },
    temperature_moderate: {
      title: 'تحسين التبريد والتهوية',
      reasoning: `درجة الحرارة الحالية (${value}) أعلى من المدى المثالي (28°م). التوصية: زيادة التهوية والتأكد من تدفق الهواء لتجنب إجهاد النبات.`,
    },
    temperature_low: {
      title: 'تفعيل التدفئة',
      reasoning: `درجة الحرارة الحالية (${value}) انخفضت إلى أقل من الحد الأدنى (15°م). التوصية: تشغيل التدفئة تدريجيًا لتجنب صدمة حرارية للمحصول.`,
    },
    humidity_high: {
      title: 'تحسين التهوية',
      reasoning: `رطوبة الهواء الحالية (${value}) مرتفعة جدًا. التوصية: تحسين التهوية لتقليل خطر الأمراض الفطرية.`,
    },
    humidity_low: {
      title: 'تفعيل الترطيب',
      reasoning: `رطوبة الهواء الحالية (${value}) أقل من الحد الأدنى (40%). التوصية: تشغيل نظام الترطيب لرفع الرطوبة وتقليل الإجهاد المائي.`,
    },
    soil_hot: {
      title: 'حماية التربة من الحرارة',
      reasoning: `درجة حرارة التربة الحالية (${value}) مرتفعة جدًا وقد تقلل قدرة الجذور على امتصاص العناصر الغذائية. التوصية: استخدام التظليل أو تغطية التربة لخفض الحرارة.`,
    },
    soil_cold: {
      title: 'تقليل الري أثناء انخفاض حرارة التربة',
      reasoning: `درجة حرارة التربة الحالية (${value}) منخفضة جدًا وتبطئ النشاط الميكروبي. التوصية: تقليل تكرار الري لتجنب تعفن الجذور.`,
    },
  };

  const pickVariant = () => {
    if (category === 'irrigation' || category === 'water') {
      if (message.includes('تقليل') || message.toLowerCase().includes('reduce')) return 'irrigation_reduce';
      return 'irrigation_increase';
    }
    if (category === 'temperature' || category === 'climate') {
      if (message.includes('تدفئة') || message.toLowerCase().includes('heating')) return 'temperature_low';
      if (message.includes('تبريد') || message.toLowerCase().includes('cool')) {
        return numericValue !== null && numericValue >= 38 ? 'temperature_high' : 'temperature_moderate';
      }
      return 'temperature_moderate';
    }
    if (category === 'humidity') {
      if (numericValue !== null) {
        return numericValue < 40 ? 'humidity_low' : 'humidity_high';
      }
      if (message.includes('\u0631\u0634') || message.includes('\u062a\u0631\u0637\u064a\u0628') || message.toLowerCase().includes('mist') || message.toLowerCase().includes('low')) {
        return 'humidity_low';
      }
      return 'humidity_high';
    }
    if (category === 'soil') {
      if (message.includes('تقليل') || message.toLowerCase().includes('reduce')) return 'soil_cold';
      return 'soil_hot';
    }
    return 'general';
  };

  const variant = pickVariant();
  const table = isEn ? EN : AR;
  return table[variant] || table.general;
};

export function LastUpdatedTimer({ seconds, ar, en }) {
  const [localSec, setLocalSec] = useState(seconds);
  useEffect(() => {
    const interval = setInterval(() => setLocalSec(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  return <>{formatLastUpdated(localSec, ar, en)}</>;
}

// ─── PARSING UTILITY ─────────────────────────────────────────────────
// Splits reasoning text into Issue + Solution based on keywords
// eslint-disable-next-line react-refresh/only-export-components
export function parseReasoningText(reasoningText) {
  if (!reasoningText) return { issue: '', solution: '' };

  const arabicKeywords = ['التوصية:', 'الإجراء:'];
  const englishKeywords = ['Recommendation:', 'Action:'];
  const allKeywords = [...arabicKeywords, ...englishKeywords];

  let issue = reasoningText;
  let solution = '';

  for (const keyword of allKeywords) {
    const index = reasoningText.indexOf(keyword);
    if (index !== -1) {
      issue = reasoningText.substring(0, index).trim();
      solution = reasoningText.substring(index + keyword.length).trim();
      break;
    }
  }

  return { issue, solution };
}


function CardShell({ children, className = "", onClick }) {
  return (
    <section
      onClick={onClick}
      className={`bg-white/90 backdrop-blur-md rounded-[24px] border border-gray-100/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-500 flex flex-col overflow-hidden ${className}`}
    >
      {children}
    </section>
  );
}

class DashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Dashboard Module Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
      return (
        <div className="w-full h-full min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white rounded-3xl border border-red-100 p-8 text-center shadow-xl">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-2">{isEn ? "Something went wrong" : "حدث خطأ غير متوقع"}</h3>
            <p className="text-sm text-gray-500 font-bold mb-6">
              {isEn ? "We encountered an error while loading this module. Please try refreshing the page." : "واجهنا مشكلة أثناء تحميل هذا القسم. يرجى محاولة تحديث الصفحة."}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
            >
              {isEn ? "Refresh Page" : "تحديث الصفحة"}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export function AutomationToggleCard({ isActive, onToggle, title="الأتمتة الذكية (Intelligent Automation)", description="تفويض الذكاء الاصطناعي للتحكم التلقائي بناءً على تحليل التوأم الرقمي." }) {
  return (
    <div className={`p-4 rounded-xl border transition-all duration-500 mb-4 flex items-center justify-between gap-4 cursor-pointer shadow-sm ${isActive ? 'bg-[#f0fdf4] border-[#bbf7d0]' : 'bg-gray-50 border-gray-200'}`} onClick={() => onToggle(!isActive)}>
      <div className="flex items-center gap-3">
         <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500 ${isActive ? 'bg-[#16a34a] text-white shadow-md shadow-green-500/20' : 'bg-white text-gray-400 border border-gray-200'}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
         </div>
         <div>
            <div className={`font-bold text-[15px] ${isActive ? 'text-[#166534]' : 'text-gray-700'}`}>{title}</div>
            <div className={`text-[12px] font-medium mt-0.5 max-w-sm ${isActive ? 'text-[#15803d]' : 'text-gray-500'}`}>{description}</div>
         </div>
      </div>
      <div className={`w-14 h-7 flex items-center rounded-full p-1 shrink-0 transition-colors duration-500 ${isActive ? 'bg-[#16a34a]' : 'bg-gray-300'}`}>
        <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-500 ${isActive ? 'translate-x-[28px]' : 'translate-x-0'}`}></div>
      </div>
    </div>
  );
}

export function TempSunIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "1.7"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 14.7V3a2 2 0 0 0-4 0v11.7a4.5 4.5 0 1 0 4 0z"/>
    </svg>
  );
}

export function SunIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "1.7"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
    </svg>
  );
}

export function BellAlertIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "1.7"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

export function AirHumidityIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "1.7"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22c4.4 0 8-3.6 8-8 0-6-8-12-8-12S4 8 4 14c0 4.4 3.6 8 8 8z" />
      <path d="M2 13h5c1 0 1 1 2 1s1-1 2-1h2" />
      <path d="M2 17h5c1 0 1 1 2 1s1-1 2-1h2" />
      <path d="M2 9h5c1 0 1 1 2 1s1-1 2-1h2" />
    </svg>
  );
}

function CardTopRow({ title, subtitle, onDetails, detailsLabel, icon, iconBg = "bg-emerald-50", iconColor = "text-[#059669]", rightElement }) {
  return (
    <div className="flex items-start justify-between gap-3 w-full">
      <div className="flex items-start gap-3">
        {icon && (
          <div className={`shrink-0 w-11 h-11 rounded-2xl ${iconBg} border border-emerald-100/50 flex items-center justify-center ${iconColor} shadow-sm transition-all`}>
            {React.isValidElement(icon) ? React.cloneElement(icon, { size: 22, strokeWidth: icon.props.strokeWidth || 1.7 }) : icon}
          </div>
        )}
        <div className="flex flex-col">
          <div className="text-lg font-bold text-gray-800 tracking-tight">{title}</div>
          {subtitle && <div className="text-[12px] text-gray-400 mt-0.5 font-medium leading-tight">{subtitle}</div>}
        </div>
      </div>
      {rightElement ? rightElement : detailsLabel && (
        <button
          type="button"
          onClick={onDetails}
          className="text-xs text-[#2E7D32] bg-[#E8F5E9] px-3 py-1.5 rounded-xl hover:bg-[#C8E6C9] hover:shadow-sm transition-all duration-300 shrink-0 font-semibold group"
        >
          {detailsLabel} <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">←</span>
        </button>
      )}
    </div>
  );
}

function WeatherIcon({ weatherData, width=18, height=18 }) {
  if (!weatherData) return <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/></svg>;
  const { code, isDay } = weatherData;
  if (code >= 51 && code <= 99) {
     return <svg width={width} height={height} viewBox="0 0 24 24" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>;
  }
  if (code >= 1 && code <= 48) {
     return <svg width={width} height={height} viewBox="0 0 24 24" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>;
  }
  if (isDay === false) { 
     return <svg width={width} height={height} viewBox="0 0 24 24" fill="#a5b4fc" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
  }
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" fill="#fde68a" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

export function SoilDropIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12 22C17.5228 22 22 20.2091 22 18C22 15.7909 17.5228 14 12 14C6.47715 14 2 15.7909 2 18C2 20.2091 6.47715 22 12 22Z" fill="#E8F5E9" stroke="#2E7D32" strokeWidth={props.strokeWidth || "1.5"}/>
      <path d="M12 14V4M12 4L9 7M12 4L15 7" stroke="#10b981" strokeWidth={props.strokeWidth || "2"} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 10C7 10 9 8 12 8C15 8 17 10 17 10" stroke="#10b981" strokeWidth={props.strokeWidth || "1.5"} strokeLinecap="round"/>
    </svg>
  );
}

function GaugeIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "1.7"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

export function DropBadgeIcon(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12 2L15 8H9L12 2Z" fill="#0EA5E9"/>
      <rect x="11" y="8" width="2" height="10" rx="1" fill="#0EA5E9"/>
      <path d="M7 14L10 14M14 14L17 14" stroke="#0EA5E9" strokeWidth={props.strokeWidth || "2"} strokeLinecap="round"/>
      <circle cx="12" cy="18" r="3" stroke="#0EA5E9" strokeWidth={props.strokeWidth || "1.5"} fill="#E0F2FE"/>
    </svg>
  );
}

function SensorTopBar({ title, subtitle, icon, onBack, onExport, T, iconBg = "bg-emerald-50", iconColor = "text-[#059669]" }) {
  const isEn = T?.back === "Back";
  const backArrow = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`opacity-70 group-hover:opacity-100 transition-opacity ${isEn ? 'rotate-180' : ''}`}>
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  );

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all ${iconBg || 'bg-emerald-50'} ${iconColor || 'text-[#059669]'} border border-emerald-100/50 shadow-sm`}>
          {React.isValidElement(icon) ? React.cloneElement(icon, { size: 22, strokeWidth: icon.props.strokeWidth || 1.7 }) : icon}
        </div>
        <div className={isEn ? "text-left" : "text-right"}>
          <div className="text-xl font-black text-gray-800 tracking-tight leading-tight">{title}</div>
          <div className="text-[12px] text-gray-400 font-medium mt-1">{subtitle}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onExport && (
          <button 
            type="button" 
            onClick={onExport} 
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-600 hover:text-[#2E7D32] hover:border-[#2E7D32]/30 hover:bg-[#f0fdf4] transition-all duration-300 flex items-center gap-2 font-bold shadow-sm active:scale-95 group"
          >
            {T?.exportReport || "تصدير التقرير"}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 transition-opacity">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        )}
        <button 
          type="button" 
          onClick={onBack} 
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-600 hover:text-[#2E7D32] hover:border-[#2E7D32]/30 hover:bg-[#f0fdf4] transition-all duration-300 flex items-center gap-2 font-bold shadow-sm active:scale-95 group"
        >
          {T?.back || "رجوع"}
          {backArrow}
        </button>
      </div>
    </div>
  );
}

function SensorPill({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-2 rounded-xl text-xs border transition ${active ? "bg-[#E8F5E9] border-[#2E7D32] text-[#1B5E20] font-semibold" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}>{label}</button>
  );
}

function SensorPrimaryButton({ children, onClick, active = false }) {
  return (
    <button type="button" onClick={onClick} className={`w-full px-4 py-2 rounded-xl border text-sm text-right transition ${active ? "bg-[#2E7D32] text-white border-[#2E7D32]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>{children}</button>
  );
}

function Account_Card({ children }) {
  return <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">{children}</div>;
}

function Account_EditableField({ label, value, onEdit, mono }) {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-white/50 rounded-2xl border border-gray-100 hover:border-emerald-100 transition-all group">
      <div className={isEn ? "text-left" : "text-right"}>
        <div className="text-[12px] font-bold text-gray-400 mb-0.5 uppercase tracking-tighter">{label}</div>
        <div className={`text-[14px] font-black text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
      <Account_IconButton onClick={onEdit} title={isEn ? 'Edit' : 'تعديل'}>
        <Account_PencilIcon />
      </Account_IconButton>
    </div>
  );
}

function Account_ListRow({ icon, title, subtitle, right }) {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-white/50 rounded-2xl border border-gray-100 hover:border-emerald-100 transition-all">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/50 shadow-sm flex items-center justify-center flex-shrink-0">{icon}</div>
        <div className={isEn ? "text-left" : "text-right"}>
          <div className="text-[13px] font-black text-gray-800">{title}</div>
          <div className="text-[12px] font-bold text-gray-400">{subtitle}</div>
        </div>
      </div>
      {right}
    </div>
  );
}

function Account_IconButton({ children, title, onClick, danger }) {
  return (
    <button 
      type="button" 
      onClick={onClick} 
      title={title} 
      className={`w-10 h-10 rounded-2xl border transition flex items-center justify-center active:scale-90
        ${danger 
          ? 'bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C] hover:bg-[#FCA5A5]' 
          : 'bg-emerald-50 border-emerald-100/50 text-emerald-600 shadow-sm hover:bg-emerald-100'
        }`}
    >
      {children}
    </button>
  );
}

function Account_ModalShell({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="relative w-max max-w-[95vw]" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute top-3 left-3 p-2 rounded-full bg-white border border-gray-200 shadow-sm text-gray-500 hover:text-gray-700">×</button>
        {children}
      </div>
    </div>
  );
}

function Account_PencilIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "2.5"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function Account_TrashIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth={props.strokeWidth || "1.7"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}

function Account_PlusIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "2.5"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function Account_SensorIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "2.5"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="12" r="3" /><path d="M12 7v-3" />
    </svg>
  );
}

// --- SHARED PROFESSIONAL ICONS ---

function PlantSoilIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "1.7"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20c0-3 3-4 8-4s8 1 8 4" />
      <path d="M12 16V8" />
      <path d="M12 8c-2-2-5-2-5 0 0 3 3 4 5 4" />
      <path d="M12 8c2-2 5-2 5 0 0 3-3 4-5 4" />
    </svg>
  );
}

function WaterValveIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "1.7"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 12h16" />
      <path d="M12 12V8" />
      <circle cx="12" cy="6" r="3" />
      <path d="M12 12s-2 2-2 5 2 5 2 5 2-2 2-5-2-5-2-5Z" />
    </svg>
  );
}

function ListIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "1.7"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="3" y1="6" x2="16" y2="6" />
      <line x1="3" y1="12" x2="16" y2="12" />
      <line x1="3" y1="18" x2="16" y2="18" />
      <line x1="21" y1="6" x2="21.01" y2="6" />
      <line x1="21" y1="12" x2="21.01" y2="12" />
      <line x1="21" y1="18" x2="21.01" y2="18" />
    </svg>
  );
}

function WindSharedIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "1.7"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17.7 7.7A2.5 2.5 0 1 1 20 12H5" />
      <path d="M9.601 3.599A2.5 2.5 0 1 0 8 8h12" />
      <path d="M11.3 20.3A2.5 2.5 0 1 1 9 16h12" />
    </svg>
  );
}


function IrrigationSmartIcon(props) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={props.strokeWidth || "1.7"} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      <path d="m5 15 2-2" />
      <path d="m19 15-2-2" />
      <path d="M12 12v4" />
      <path d="m9 13 1 1" />
      <path d="m15 13-1 1" />
    </svg>
  );
}

export function EmptyState({ title, subtitle, icon, compact = false, variant = "default" }) {
  const isSuccess = variant === "success";
  
  return (
    <div className={`flex flex-col items-center justify-center text-center animate-fade-in-up bg-white/50 backdrop-blur-sm rounded-[24px] border border-dashed w-full ${isSuccess ? 'border-emerald-200' : 'border-gray-200'} ${compact ? 'p-6 flex-1' : 'py-16 px-8'}`}>
      <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 border shrink-0 ${isSuccess ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
         {icon || <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
      </div>
      <div className={`text-[15px] font-black mb-1 leading-tight ${isSuccess ? 'text-emerald-700' : 'text-gray-800'}`}>{title}</div>
      {subtitle && <div className={`text-[12px] font-medium max-w-[350px] leading-relaxed ${isSuccess ? 'text-emerald-600/80' : 'text-gray-400'}`}>{subtitle}</div>}
    </div>
  );
}

export function AlertsPanel({ alerts = [], isOpen, onAccept, onFeedback }) {
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  const [feedbackState, setFeedbackState] = React.useState({});
  const [showThanks, setShowThanks] = React.useState([]);
  const [hiddenAlertIds, setHiddenAlertIds] = React.useState([]);

  const handleFeedback = (id, type) => {
    setFeedbackState(prev => ({ ...prev, [id]: type }));
    setShowThanks(prev => [...prev, id]);
    setTimeout(() => {
      setShowThanks(prev => prev.filter(item => item !== id));
      setHiddenAlertIds(prev => prev.includes(id) ? prev : [...prev, id]);
    }, 500);
    onFeedback?.(id, type === 'up');
  };

  const visibleAlerts = alerts.filter(alert => !hiddenAlertIds.includes(alert.id));
  
  if (!isOpen) return null;

  return (
    <div className="absolute top-14 left-0 w-80 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between p-4 border-b border-gray-50 bg-gray-50/50">
        <div className="font-black text-gray-800">{isEn ? 'System Alerts' : 'تنبيهات النظام'}</div>
        <div className="text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
          {visibleAlerts.length} {isEn ? 'Active' : 'نشط'}
        </div>
      </div>
      
      <div
        className="max-h-[400px] overflow-y-auto p-2 flex flex-col gap-2"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db transparent'
        }}
      >
        {visibleAlerts.length === 0 ? (
          <EmptyState 
            compact={true}
            title={isEn ? 'No active alerts' : 'لا توجد تنبيهات حالية'}
          />
        ) : (
          visibleAlerts.map((alert, i) => (
            <AlertCard
              key={alert.id || i}
              alert={alert}
              globalAutoMode={alert.autoMode}
              isEn={isEn}
              onAccept={onAccept}
              onFeedback={handleFeedback}
              feedbackState={feedbackState}
              showThanks={showThanks}
              compact={true}
            />
          ))
        )}
      </div>
    </div>
  );
}


// ─── SAFETEXT UTILITY ───────────────────────────────────────────────────────
const extractSafeText = (data, fallback = '') => {
  if (!data) return fallback;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return parsed.message || parsed.reasoning || parsed.action || data;
    } catch {
      return data;
    }
  }
  if (typeof data === 'object') {
    return data.message || data.reasoning || data.action || JSON.stringify(data);
  }
  return String(data);
};

// ─── DESCRIPTIVE AUTONOMOUS TEXT UTILITY ────────────────────────────────────
function getMlAnomalyActionExplanation(sensorType, isEn, isAuto) {
  const s = (sensorType || '').toLowerCase();

  if (s.includes('water') || s.includes('irrigation')) {
    if (isAuto) return isEn
      ? "The system logged this irrigation anomaly automatically. Review the irrigation valve, pump status, water flow reading, and device connection."
      : "سجّل النظام نمطًا غير طبيعي في الري تلقائيًا. راجع صمام الري، وحالة المضخة، وقراءة تدفق المياه، واتصال الجهاز.";
    return isEn
      ? "Do you want to review the irrigation valve, pump status, water flow reading, and device connection?"
      : "هل تود مراجعة صمام الري، وحالة المضخة، وقراءة تدفق المياه، واتصال الجهاز؟";
  }

  if (s.includes('power') || s.includes('energy')) {
    if (isAuto) return isEn
      ? "The system logged this energy anomaly automatically. Review the energy meter reading, connected equipment, and device connection."
      : "سجّل النظام نمطًا غير طبيعي في الطاقة تلقائيًا. راجع قراءة عداد الطاقة، والأجهزة المرتبطة، واتصال الجهاز.";
    return isEn
      ? "Do you want to review the energy meter reading, connected equipment, and device connection?"
      : "هل تود مراجعة قراءة عداد الطاقة، والأجهزة المرتبطة، واتصال الجهاز؟";
  }

  if (s.includes('soil')) {
    if (isAuto) return isEn
      ? "The system logged this soil sensor anomaly automatically. Review soil moisture, soil temperature, the soil sensor, and device connection."
      : "سجّل النظام نمطًا غير طبيعي في حساسات التربة تلقائيًا. راجع رطوبة التربة، وحرارة التربة، وحساس التربة، واتصال الجهاز.";
    return isEn
      ? "Do you want to review soil moisture, soil temperature, the soil sensor, and device connection?"
      : "هل تود مراجعة رطوبة التربة، وحرارة التربة، وحساس التربة، واتصال الجهاز؟";
  }

  if (s.includes('temperature') || s.includes('humidity') || s.includes('light')) {
    if (isAuto) return isEn
      ? "The system logged this climate sensor anomaly automatically. Review air temperature, humidity, light reading, the climate sensor, and device connection."
      : "سجّل النظام نمطًا غير طبيعي في حساسات المناخ تلقائيًا. راجع حرارة الهواء، والرطوبة، وقراءة الإضاءة، وحساس المناخ، واتصال الجهاز.";
    return isEn
      ? "Do you want to review air temperature, humidity, light reading, the climate sensor, and device connection?"
      : "هل تود مراجعة حرارة الهواء، والرطوبة، وقراءة الإضاءة، وحساس المناخ، واتصال الجهاز؟";
  }

  if (isAuto) return isEn
    ? "The system logged this anomaly automatically. Review the mentioned device if shown, related readings, and sensor connectivity."
    : "سجّل النظام هذا النمط غير الطبيعي تلقائيًا. راجع الجهاز المذكور إن وجد، والقراءات المرتبطة، واتصال الحساسات.";
  return isEn
    ? "Do you want to review the mentioned device, related readings, and sensor connectivity?"
    : "هل تود مراجعة الجهاز المذكور، والقراءات المرتبطة، واتصال الحساسات؟";
}

function getActionExplanation(category, isEn, isAuto, sensorType = '') {
  const c = (category || '').toLowerCase();

  // Climate / Temperature / Ventilation
  if (c === 'climate' || c === 'temperature') {
    if (isAuto) return isEn
      ? "Greenhouse cooling and fans activated autonomously to lower temperature and stabilize the crop environment."
      : "تم تشغيل التبريد والمراوح تلقائيًا لخفض درجة الحرارة وتحسين أجواء المحمية حفاظًا على استقرار المحصول.";
    return isEn
      ? "Do you want to turn on cooling and fans to lower the temperature and stabilize the crop environment?"
      : "هل تود تشغيل التبريد والمراوح لخفض درجة الحرارة وتحسين أجواء المحمية؟";
  }

  // Irrigation / Water
  if (c === 'irrigation' || c === 'water') {
    if (isAuto) return isEn
      ? "Auto mode is monitoring irrigation and will execute only when crop need and safety conditions allow it."
      : "يراقب الوضع التلقائي حالة الري، ولن يشغّل المضخات إلا عندما تحتاج التربة وتسمح شروط السلامة بذلك.";
    return isEn
      ? "Do you want to activate the irrigation pumps to restore optimal soil moisture levels?"
      : "هل تود تفعيل مضخات الري لاستعادة المستوى المناسب لرطوبة التربة؟";
  }

  // Humidity
  if (c === 'humidity') {
    if (isAuto) return isEn
      ? "Ventilation fans activated autonomously to exhaust excess humidity and protect crop health."
      : "تم تشغيل نظام التهوية والمراوح تلقائيًا لتصريف الرطوبة الزائدة وحماية المحصول.";
    return isEn
      ? "Do you want to activate the ventilation fans to exhaust excess humidity and protect crop health?"
      : "هل تود تشغيل نظام التهوية والمراوح لتصريف الرطوبة الزائدة وحماية المحصول؟";
  }

  // Soil
  if (c === 'soil') {
    if (isAuto) return isEn
      ? "Soil treatment protocol initiated autonomously to restore soil vitality and root health."
      : "تم بدء بروتوكول معالجة التربة تلقائياً لاستعادة حيوية التربة وصحة الجذور.";
    return isEn
      ? "Do you want to initiate soil treatment to restore vitality and root health?"
      : "هل تود بدء معالجة التربة لاستعادة حيويتها وصحة الجذور؟";
  }

  // Lighting
  if (c === 'lighting' || c === 'light') {
    if (isAuto) return isEn
      ? "Supplemental lighting adjusted autonomously to maintain optimal photosynthesis conditions."
      : "تم ضبط إضاءة التعويض تلقائياً للحفاظ على ظروف التمثيل الضوئي المثالية.";
    return isEn
      ? "Do you want to adjust the lighting system to optimize photosynthesis conditions?"
      : "هل تود ضبط نظام الإضاءة لتحسين ظروف التمثيل الضوئي؟";
  }

  // Fertilization / Nutrients
  if (c === 'fertilization' || c === 'nutrients' || c === 'nutrition') {
    if (isAuto) return isEn
      ? "Nutrient dosing system activated autonomously to replenish essential crop minerals."
      : "تم تفعيل نظام التسميد تلقائياً لتعزيز المعادن الأساسية للمحصول.";
    return isEn
      ? "Do you want to activate the nutrient dosing system to replenish crop minerals?"
      : "هل تود تفعيل نظام التسميد لتعزيز المعادن الأساسية للمحصول؟";
  }

  // Power / energy sensors
  if (c === 'power' || c === 'energy') {
    if (isAuto) return isEn
      ? "The system logged the power sensor alert automatically. Please verify the sensor reading and device connection."
      : "سجّل النظام تنبيه الطاقة تلقائيًا. يرجى التحقق من قراءة الحساس واتصال الجهاز.";
    return isEn
      ? "Do you want to review the power sensor reading and device connection?"
      : "هل تود مراجعة قراءة حساس الطاقة واتصال الجهاز؟";
  }

  // Multi-sensor anomaly
  if (c === 'ml_anomaly') {
    return getMlAnomalyActionExplanation(sensorType, isEn, isAuto);
  }

  // General / Default — still descriptive
  if (isAuto) return isEn
    ? "The system logged this alert automatically. Please review the related sensor or connection status."
    : "سجّل النظام هذا التنبيه تلقائيًا. يرجى مراجعة الحساس أو حالة الاتصال المرتبطة.";
  return isEn
    ? "Do you want to review the related sensor or connection status?"
    : "هل تود مراجعة الحساس أو حالة الاتصال المرتبطة؟";
}

function getManualCompletionExplanation(category, isEn) {
  return getActionExplanation(category, isEn, true)
    .replace(/\s*autonomously/gi, '')
    .replace(/\s*automatically/gi, '')
    .replace(/\s*تلقائياً/g, '');
}

function getCompletedRecommendationMessage(category, isEn) {
  const c = (category || '').toLowerCase();
  if (c === 'climate' || c === 'temperature') {
    return isEn
      ? 'Cooling and fans were activated to lower temperature and stabilize the greenhouse environment.'
      : 'تم تشغيل التبريد والمراوح لخفض درجة الحرارة وتحسين أجواء المحمية حفاظًا على استقرار المحصول.';
  }
  if (c === 'humidity') {
    return isEn
      ? 'Ventilation fans were activated to exhaust excess humidity and protect crop health.'
      : 'تم تشغيل نظام التهوية والمراوح لتصريف الرطوبة الزائدة وحماية المحصول.';
  }
  if (c === 'irrigation' || c === 'soil' || c === 'water' || c === 'soil_moisture') {
    return isEn
      ? 'Irrigation was activated to restore the suitable soil moisture level while respecting safety conditions.'
      : 'تم تشغيل الري لاستعادة المستوى المناسب لرطوبة التربة مع مراعاة شروط السلامة.';
  }
  return isEn
    ? 'The recommended device action was completed and remains available here for evaluation.'
    : 'تم تنفيذ إجراء الجهاز المرتبط بهذه التوصية، وستبقى هنا للتقييم.';
}

function getInProgressRecommendationMessage(category, isEn) {
  const c = (category || '').toLowerCase();
  if (c === 'climate' || c === 'temperature') {
    return isEn
      ? 'Cooling and fans are running now while the system monitors temperature and humidity balance.'
      : 'التكييف والمراوح تعمل الآن، بانتظار توازن الحرارة والرطوبة.';
  }
  if (c === 'humidity') {
    return isEn
      ? 'Fans are running now while the system monitors air humidity.'
      : 'المراوح تعمل الآن، بانتظار انخفاض رطوبة الهواء.';
  }
  if (c === 'irrigation' || c === 'soil' || c === 'water' || c === 'soil_moisture') {
    return isEn
      ? 'The pump is running now while the system monitors soil moisture and safety conditions.'
      : 'المضخة تعمل الآن، بانتظار استجابة رطوبة التربة وشروط السلامة.';
  }
  return isEn
    ? 'The related device action is active while the system monitors the latest readings.'
    : 'إجراء الجهاز المرتبط قيد العمل، والنظام يراقب أحدث القراءات.';
}

function getIgnoredRecommendationMessage(isEn) {
  return isEn
    ? "Recommendation ignored. It will remain available in the recommendations page for later review."
    : "تم تجاهل التوصية. ستبقى متاحة في صفحة التوصيات للمراجعة لاحقًا.";
}

function getAlertExecutionSuccessMessage(category, isEn) {
  const c = (category || '').toLowerCase();
  if (c === 'climate' || c === 'temperature') {
    return isEn
      ? "Cooling and ventilation commands were sent to the climate devices."
      : "تم إرسال أمر تشغيل التبريد والتهوية إلى أجهزة المناخ.";
  }
  if (c === 'humidity') {
    return isEn
      ? "Ventilation command was sent to the fan system."
      : "تم إرسال أمر تشغيل التهوية إلى نظام المراوح.";
  }
  if (c === 'irrigation' || c === 'soil' || c === 'water') {
    return isEn
      ? "Irrigation command was sent to the pump system."
      : "تم إرسال أمر تشغيل الري إلى نظام المضخة.";
  }
  return isEn
    ? "The required action was sent successfully."
    : "تم إرسال الإجراء المطلوب بنجاح.";
}

function extractAlertDeviceName(text = '', sensorType = '', isEn = false) {
  const raw = String(text || '');
  const idMatch = raw.match(/\b(?:fan|cooling|irrigation|pump|valve|sensor|energy|tuya)[\w-]*_\d+\b/i)
    || raw.match(/\(([^)]*(?:unit|fan|pump|valve|sensor|meter|tuya)[^)]*)\)/i);
  if (idMatch) return idMatch[1] || idMatch[0];

  const s = String(sensorType || '').toLowerCase();
  if (s.includes('power') || s.includes('energy')) return isEn ? 'energy meter' : 'عداد الطاقة';
  if (s.includes('water_tank')) return isEn ? 'water tank sensor' : 'حساس خزان المياه';
  if (s.includes('soil')) return isEn ? 'soil sensor' : 'حساس التربة';
  if (s.includes('humidity') || s.includes('temperature') || s.includes('light')) return isEn ? 'climate sensor' : 'حساس المناخ';
  return isEn ? 'related sensor or controller' : 'الحساس أو وحدة التحكم المرتبطة';
}

function getAutoAlertSummary(category, isEn, actionStatus, sensorType = '', alertText = '') {
  const c = (category || '').toLowerCase();
  if (actionStatus === 'executing') {
    if (c === 'climate' || c === 'temperature') return isEn
      ? "Cooling and ventilation are running now while the system monitors temperature and humidity."
      : "التبريد والتهوية يعملان الآن بينما يراقب النظام الحرارة والرطوبة.";
    if (c === 'humidity') return isEn
      ? "Ventilation fans are running now while the system monitors air humidity."
      : "مراوح التهوية تعمل الآن بينما يراقب النظام رطوبة الهواء.";
    if (c === 'irrigation' || c === 'soil' || c === 'water') return isEn
      ? "Irrigation is running now while the system monitors soil moisture and safety conditions."
      : "الري يعمل الآن بينما يراقب النظام رطوبة التربة وشروط السلامة.";
  }
  if (actionStatus === 'executed') {
    if (c === 'climate' || c === 'temperature') return isEn
      ? "Cooling and ventilation were activated because the temperature alert required climate control."
      : "تم تشغيل التبريد والتهوية لأن تنبيه الحرارة يتطلب ضبط مناخ المحمية.";
    if (c === 'humidity') return isEn
      ? "Ventilation fans were activated because the humidity alert required air exchange."
      : "تم تشغيل مراوح التهوية لأن تنبيه الرطوبة يتطلب تصريف الهواء الرطب.";
    if (c === 'irrigation' || c === 'soil' || c === 'water') return isEn
      ? "Irrigation was activated because the alert indicated soil moisture needed recovery."
      : "تم تشغيل الري لأن التنبيه أظهر حاجة رطوبة التربة إلى الاستعادة.";
    return getAlertExecutionSuccessMessage(c, isEn);
  }
  if (actionStatus === 'deferred') {
    if (c === 'irrigation' || c === 'soil' || c === 'water') {
      return isEn
        ? "Irrigation was delayed because current safety checks do not allow watering now, such as nighttime fungal-risk conditions, high soil moisture, or low tank level."
        : "تم تأجيل الري لأن فحوصات السلامة لا تسمح بتشغيل المضخة الآن، مثل فترة الليل وخطر الفطريات أو ارتفاع رطوبة التربة أو انخفاض مستوى الخزان.";
    }
    return isEn
      ? "The device action was delayed because current safety checks do not confirm that operation is safe yet."
      : "تم تأجيل إجراء الجهاز لأن فحوصات السلامة الحالية لا تؤكد أن التشغيل آمن الآن.";
  }
  if (actionStatus === 'auto') {
    return isEn
      ? "Automatic control is monitoring this alert and will send the matching device command only when the latest readings confirm it is still needed."
      : "يراقب التحكم التلقائي هذا التنبيه، ولن يرسل أمر الجهاز المناسب إلا إذا أكدت أحدث القراءات أن الإجراء ما زال مطلوبًا.";
  }
  if (c === 'climate' || c === 'temperature' || c === 'humidity') {
    return isEn
      ? "The climate system will compare the next temperature and humidity readings before deciding whether to start cooling or ventilation."
      : "سيوازن نظام المناخ بين قراءات الحرارة والرطوبة القادمة قبل قرار تشغيل التبريد أو التهوية.";
  }
  if (c === 'water_tank') {
    return isEn
      ? "The system logged the low water tank level and will continue checking available water before irrigation is allowed."
      : "سجّل النظام انخفاض مستوى خزان المياه وسيواصل التحقق من الماء المتاح قبل السماح بالري.";
  }
  if (c === 'irrigation' || c === 'soil' || c === 'water') {
    return isEn
      ? "The irrigation system will monitor soil and water readings and start or delay watering according to safety conditions."
      : "سيراقب نظام الري قراءات التربة والمياه ويشغّل أو يؤجل الري حسب شروط السلامة.";
  }
  if (c === 'power' || c === 'energy') {
    const device = extractAlertDeviceName(alertText, sensorType, isEn);
    return isEn
      ? `Please verify the energy reading, ${device} connection, and the electrical load of the connected equipment.`
      : `يرجى التحقق من قراءة الطاقة، واتصال ${device}، وحمل الأجهزة الكهربائية المرتبطة.`;
  }
  const device = extractAlertDeviceName(alertText, sensorType, isEn);
  return isEn
    ? `Please verify ${device}, its latest reading, and its connection status.`
    : `يرجى التحقق من ${device}، وآخر قراءة صادرة عنه، وحالة اتصاله.`;
}

function getManualAlertPrompt(category, isEn, sensorType = '', alertText = '') {
  const c = (category || '').toLowerCase();
  if (c === 'water_tank') {
    return isEn
      ? "Refill or inspect the water tank, then confirm that the tank sensor reading has updated."
      : "يرجى تعبئة خزان المياه أو فحصه، ثم التأكد من تحديث قراءة حساس الخزان.";
  }
  if (c === 'climate' || c === 'temperature') {
    return isEn
      ? "Do you want to start cooling and ventilation to lower the greenhouse temperature?"
      : "هل تود تشغيل التبريد والتهوية لخفض حرارة المحمية؟";
  }
  if (c === 'humidity') {
    return isEn
      ? "Do you want to start the ventilation fans to reduce excess air humidity?"
      : "هل تود تشغيل مراوح التهوية لتصريف رطوبة الهواء الزائدة؟";
  }
  if (c === 'irrigation' || c === 'soil' || c === 'water') {
    return isEn
      ? "Do you want to start irrigation to restore soil moisture, if the tank level and safety checks allow it?"
      : "هل تود تشغيل الري لاستعادة رطوبة التربة إذا سمح مستوى الخزان وفحوصات السلامة؟";
  }
  const device = extractAlertDeviceName(alertText, sensorType, isEn);
  return isEn
    ? `Review ${device}, its latest reading, and its connection status.`
    : `يرجى مراجعة ${device}، وآخر قراءة صادرة عنه، وحالة اتصاله.`;
}

function alertHasDirectDeviceAction(category) {
  return ['climate', 'temperature', 'humidity', 'irrigation', 'soil', 'water'].includes((category || '').toLowerCase());
}

// ─── THEME & ICONS ──────────────────────────────────────────────────────────
function getRecommendationTheme(type, text = "") {
  let resolvedType = type;
  if (!resolvedType) {
    const t = text.toLowerCase();
    if (t.includes('ري') || t.includes('ماء') || t.includes('water') || t.includes('irrigat') || t.includes('تدفق')) resolvedType = 'irrigation';
    else if (t.includes('حرار') || t.includes('temp') || t.includes('مناخ')) resolvedType = 'temperature';
    else if (t.includes('رطوبة') || t.includes('humidity') || t.includes('رش') || t.includes('تهوية') || t.includes('ventilation')) resolvedType = 'humidity';
    else if (t.includes('شمس') || t.includes('ضوء') || t.includes('light') || t.includes('sun')) resolvedType = 'lighting';
    else if (t.includes('ترب') || t.includes('جذور') || t.includes('soil') || t.includes('root') || t.includes('سماد') || t.includes('fertil') || t.includes('nutri')) resolvedType = 'soil';
    else resolvedType = 'default';
  }

  switch(resolvedType) {
    case 'irrigation':
    case 'water':
      return {
        bg: 'bg-blue-50/20',
        border: 'border-blue-100/60',
        text: 'text-blue-700',
        iconBg: 'bg-blue-50 text-blue-600 border-blue-100/80',
        actionBg: 'bg-blue-50/50',
        actionBorder: 'border-blue-100/50',
        actionText: 'text-blue-800',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
      };
    case 'temperature':
    case 'climate':
      return {
        bg: 'bg-amber-50/20',
        border: 'border-amber-100/60',
        text: 'text-amber-700',
        iconBg: 'bg-amber-50 text-amber-600 border-amber-100/80',
        actionBg: 'bg-amber-50/50',
        actionBorder: 'border-amber-100/50',
        actionText: 'text-amber-800',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/><path d="M12 7v5"/></svg>
      };
    case 'humidity':
    case 'ventilation':
      return {
        bg: 'bg-sky-50/20',
        border: 'border-sky-100/60',
        text: 'text-sky-700',
        iconBg: 'bg-sky-50 text-sky-500 border-sky-100/80',
        actionBg: 'bg-sky-50/40',
        actionBorder: 'border-sky-100/50',
        actionText: 'text-sky-700',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
      };
    case 'lighting':
      return {
        bg: 'bg-yellow-50/20',
        border: 'border-yellow-100/60',
        text: 'text-yellow-700',
        iconBg: 'bg-yellow-50 text-yellow-500 border-yellow-100/80',
        actionBg: 'bg-yellow-50/40',
        actionBorder: 'border-yellow-100/50',
        actionText: 'text-yellow-700',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      };
    case 'soil':
    case 'fertilization':
    case 'nutrients':
      return {
        bg: 'bg-emerald-50/20',
        border: 'border-emerald-100/60',
        text: 'text-emerald-700',
        iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100/80',
        actionBg: 'bg-emerald-50/40',
        actionBorder: 'border-emerald-100/50',
        actionText: 'text-emerald-800',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
      };
    default:
      return {
        bg: 'bg-indigo-50/10',
        border: 'border-indigo-100/50',
        text: 'text-indigo-700',
        iconBg: 'bg-indigo-50 text-indigo-500 border-indigo-100/80',
        actionBg: 'bg-indigo-50/30',
        actionBorder: 'border-indigo-100/50',
        actionText: 'text-indigo-800',
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      };
  }
}

// ─── RECOMMENDATION CARD ────────────────────────────────────────────────────
const DECISION_STATE_STYLES = {
  pending: {
    bg: 'bg-sky-50/80',
    border: 'border-sky-100',
    text: 'text-sky-800',
    dot: 'bg-sky-500',
  },
  executing: {
    bg: 'bg-emerald-50/80',
    border: 'border-emerald-100',
    text: 'text-emerald-800',
    dot: 'bg-emerald-500',
  },
  blocked: {
    bg: 'bg-amber-50/80',
    border: 'border-amber-100',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
  },
  completed: {
    bg: 'bg-teal-50/80',
    border: 'border-teal-100',
    text: 'text-teal-800',
    dot: 'bg-teal-500',
  },
  monitoring: {
    bg: 'bg-gray-50/80',
    border: 'border-gray-100',
    text: 'text-gray-700',
    dot: 'bg-gray-400',
  },
  stale: {
    bg: 'bg-gray-50/80',
    border: 'border-gray-100',
    text: 'text-gray-700',
    dot: 'bg-gray-400',
  },
  legacy: {
    bg: 'bg-gray-50/80',
    border: 'border-gray-100',
    text: 'text-gray-700',
    dot: 'bg-gray-400',
  },
  failed: {
    bg: 'bg-red-50/80',
    border: 'border-red-100',
    text: 'text-red-800',
    dot: 'bg-red-500',
  },
  hold: {
    bg: 'bg-gray-50/80',
    border: 'border-gray-100',
    text: 'text-gray-700',
    dot: 'bg-gray-400',
  },
};

function decisionStateCopy(decisionState, isEn) {
  const state = decisionState?.state || 'hold';
  const label = isEn ? decisionState?.label_en : decisionState?.label;
  const reason = isEn ? decisionState?.reason_en : decisionState?.reason;
  return {
    state,
    label: label || (isEn ? 'No active action' : 'لا يوجد إجراء نشط'),
    reason: reason || '',
  };
}

function recommendationStateLabel(decisionState, actionStatus, isEn, category) {
  const state = actionStatus || decisionState?.state || 'hold';
  const normalizedCategory = String(category || decisionState?.domain || '').toLowerCase();
  const isIrrigation = ['irrigation', 'water', 'soil_moisture'].includes(normalizedCategory);
  if (actionStatus === 'executed' || state === 'completed') return isEn ? 'Executed' : 'تم التنفيذ';
  if (actionStatus === 'ignored') return isEn ? 'Ignored' : 'تم التجاهل';
  if (state === 'executing') return isEn ? 'In Progress' : 'قيد التنفيذ';
  if (actionStatus === 'auto' && isIrrigation) return isEn ? 'Irrigation Deferred' : 'ري مؤجل';
  if (actionStatus === 'auto' || state === 'monitoring' || state === 'pending') return isEn ? 'No Action Needed Now' : 'لا يتطلب إجراء الآن';
  if (state === 'blocked' || actionStatus === 'deferred') return isIrrigation ? (isEn ? 'Irrigation Deferred' : 'ري مؤجل') : (isEn ? 'Deferred' : 'مؤجل');
  if (state === 'stale' || actionStatus === 'stale') return isEn ? 'No Action Needed Now' : 'لا يتطلب إجراء الآن';
  if (state === 'legacy' || actionStatus === 'legacy') return isEn ? 'No Action Needed Now' : 'لا يتطلب إجراء الآن';
  if (state === 'failed') return isEn ? 'Execution Failed' : 'تعذر التنفيذ';
  return isEn ? 'No Action Needed Now' : 'لا يتطلب إجراء الآن';
}

function recommendationStateMessage(decisionState, actionStatus, fallbackMessage, isEn, category) {
  const state = actionStatus || decisionState?.state || 'hold';
  const normalizedCategory = String(category || decisionState?.domain || '').toLowerCase();
  const isIrrigation = ['irrigation', 'water', 'soil_moisture'].includes(normalizedCategory);
  const reason = isEn ? decisionState?.reason_en : decisionState?.reason;
  if (state === 'stale' || actionStatus === 'stale') {
    return reason || (isEn
      ? 'The reading changed after this recommendation was created. No device command is needed from this old recommendation; the system will rely on the latest recommendation when new readings arrive.'
      : 'تغيّرت القراءة بعد إنشاء هذه التوصية. لا يتطلب هذا السجل أمر جهاز الآن، وسيعتمد النظام على أحدث توصية عند وصول قراءة جديدة.');
  }
  if (reason) return reason;
  if (actionStatus === 'executed' || state === 'completed') return getCompletedRecommendationMessage(normalizedCategory, isEn);
  if (actionStatus === 'ignored') {
    return isEn
      ? 'The recommendation was ignored and remains available for later review.'
      : 'تم تجاهل التوصية وستبقى متاحة للمراجعة لاحقًا.';
  }
  if (state === 'executing') return fallbackMessage;
  if (actionStatus === 'auto' || state === 'monitoring' || state === 'pending') {
    if (isIrrigation) {
      return isEn
        ? 'Irrigation was deferred by the current safety checks. The system will re-evaluate the pump decision when soil moisture and environmental conditions allow it.'
        : 'تم تأجيل الري بسبب فحوصات السلامة الحالية. سيعيد النظام تقييم قرار المضخة عندما تسمح رطوبة التربة والظروف البيئية بذلك.';
    }
    return fallbackMessage || (isEn
      ? 'The system will reassess this recommendation when new sensor readings arrive.'
      : 'سيعيد النظام تقييم هذه التوصية عند وصول قراءات حساسات جديدة.');
  }
  if (state === 'blocked' || actionStatus === 'deferred') {
    if (isIrrigation) {
      return isEn
        ? 'Irrigation was deferred by the current safety checks. The system will re-evaluate the pump decision when soil moisture and environmental conditions allow it.'
        : 'تم تأجيل الري بسبب فحوصات السلامة الحالية. سيعيد النظام تقييم قرار المضخة عندما تسمح رطوبة التربة والظروف البيئية بذلك.';
    }
    return isEn
      ? 'The system delayed this recommendation because current safety conditions are not suitable.'
      : 'أجّل النظام هذه التوصية لأن شروط السلامة الحالية غير مناسبة.';
  }
  return isEn
    ? 'The system will reassess this recommendation when new sensor readings arrive.'
    : 'سيعيد النظام تقييم هذه التوصية عند وصول قراءات حساسات جديدة.';
}

export function RecommendationCard({
  rec,
  farmId,
  globalAutoMode,
  isEn,
  onExecute,
  onIgnore,
  onFeedback,
  onActionChange,
  onDismiss,
  feedbackState = {},
  compact = false,
  autoDismissOnAction = false,
  autoDismissOnFeedback = true
}) {
  const isRtl = !isEn;
  const theme = getRecommendationTheme(rec.category || rec.type, extractSafeText(rec.title || rec.message));
  const actionType = rec.category || rec.type || 'general';
  const [isLoading, setIsLoading] = React.useState(false);
  const [actionResult, setActionResult] = React.useState(rec.action_status || null);
  const [feedbackNotice, setFeedbackNotice] = React.useState(null);
  const [nowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setActionResult(rec.action_status || null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [rec.id, rec.action_status]);

  const scheduleDismiss = (delay = 2200) => {
    window.setTimeout(() => {
      onDismiss?.(rec.id);
    }, delay);
  };

  const handleExecute = async (event) => {
    event?.stopPropagation();
    if (isLoading || actionResult) return;
    setActionResult('executing');
    setIsLoading(true);
    try {
      const executionResult = await onExecute?.(actionType, farmId, rec.rawId || rec.id);
      if (!executionResult) throw new Error('Recommendation execution failed');
      if (executionResult.executed === false) {
        setActionResult('failed');
        window.setTimeout(() => setActionResult(null), 2500);
      } else {
        setActionResult('executing');
        if (autoDismissOnAction) scheduleDismiss();
      }
    } catch (err) {
      console.error('Execution failed:', err);
      setActionResult('failed');
      window.setTimeout(() => setActionResult(null), 2500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIgnore = async (event) => {
    event?.stopPropagation();
    setActionResult('ignored');
    if (autoDismissOnAction) {
      scheduleDismiss();
    }
    await onActionChange?.(rec.rawId || rec.id, 'ignored');
    onIgnore?.(rec.id);
  };

  const handleFeedbackClick = async (type, event) => {
    event?.stopPropagation();
    await onFeedback?.(rec.id, type);
    setFeedbackNotice(
      type === 'up'
        ? (isEn ? 'Thanks, your rating was saved.' : 'شكراً، تم حفظ تقييمك.')
        : (isEn ? 'Thanks, we will use your feedback to improve.' : 'شكراً، سنستخدم ملاحظتك للتحسين.')
    );
    window.setTimeout(() => {
      setFeedbackNotice(null);
      if (autoDismissOnFeedback) onDismiss?.(rec.id);
    }, 1600);
  };

  const severityColor =
    rec.severity === 'urgent' ? '#dc2626' :
    rec.severity === 'warning' ? '#d97706' : '#10b981';

  const localizedCopy = localizedRecommendationCopy(rec, isEn);
  const rawReasoning = extractSafeText(localizedCopy.reasoning || rec.reasoning);
  const safeTitle = extractSafeText(localizedCopy.title || rec.title || rec.message);
  const decisionState = decisionStateCopy(rec.decision_state, isEn);
  const lockedDecisionStates = new Set(['stale', 'legacy', 'blocked', 'completed']);
  const isLockedDecision = Boolean(rec.decision_state && lockedDecisionStates.has(decisionState.state));
  const visibleActionStatus = isLockedDecision ? null : (rec.action_status || actionResult);
  const displayStateKey =
    visibleActionStatus === 'executing' ? 'executing' :
    visibleActionStatus === 'executed' ? 'completed' :
    visibleActionStatus === 'failed' ? 'failed' :
    visibleActionStatus === 'ignored' ? 'monitoring' :
    decisionState.state;
  const decisionStyle = DECISION_STATE_STYLES[displayStateKey] || DECISION_STATE_STYLES.hold;
  const showManualPrompt = !globalAutoMode && !actionResult && !isLockedDecision;
  const showDecisionBanner = isLockedDecision || globalAutoMode;
  const showLocalActionBanner = !globalAutoMode && !showManualPrompt && !showDecisionBanner && actionResult;
  const displayStateLabel = recommendationStateLabel(rec.decision_state, visibleActionStatus, isEn, rec.category || rec.type);
  const autoActionExplanation = getActionExplanation(rec.category || rec.type, isEn, true);
  const displayStateMessage = recommendationStateMessage(
    rec.decision_state,
    visibleActionStatus,
    autoActionExplanation,
    isEn,
    rec.category || rec.type
  );
  const decisionBannerMessage = isLockedDecision
    ? (decisionState.reason || displayStateMessage)
    : displayStateMessage;

  const domainCategory = isEn
    ? (rec.category === 'irrigation' || rec.category === 'water' ? 'Irrigation & Water'
      : rec.category === 'temperature' || rec.category === 'climate' ? 'Climate & Ventilation'
      : rec.category === 'humidity' ? 'Climate & Ventilation'
      : rec.category === 'soil' ? 'Soil & Crop Health'
      : 'System Optimization')
    : (rec.category === 'irrigation' || rec.category === 'water' ? 'الري والمياه'
      : rec.category === 'temperature' || rec.category === 'climate' ? 'المناخ والتهوية'
      : rec.category === 'humidity' ? 'المناخ والتهوية'
      : rec.category === 'soil' ? 'بيئة وصحة التربة'
      : 'تحسين النظام');

  const formatRecMeta = () => {
    const raw = rec.created_at || rec.createdAt || rec.timestamp;
    if (!raw) return null;
    const time = new Date(raw).getTime();
    if (!Number.isFinite(time)) return null;
    const diffMs = Math.max(0, nowMs - time);
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    if (diffMin < 1) return isEn ? 'Just now' : 'الآن';
    if (diffHr < 1) return isEn ? `${diffMin}m ago` : `منذ ${diffMin} دقيقة`;
    if (diffHr < 24) return isEn ? `${diffHr}h ago` : `منذ ${diffHr} ساعة`;
    return new Date(raw).toLocaleDateString(isEn ? 'en-GB' : 'ar-SA', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      className={`bg-white/90 backdrop-blur-md rounded-[24px] border border-gray-100/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 flex flex-col shrink-0 ${compact ? 'p-4' : 'p-5 md:p-6'}`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: severityColor }} />
          <h3 className={`font-bold text-gray-500 uppercase tracking-widest leading-tight ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
            {domainCategory}
          </h3>
        </div>
        {formatRecMeta() && (
          <div className="font-bold text-[10px] text-gray-400 uppercase tracking-widest whitespace-nowrap">
            {formatRecMeta()}
          </div>
        )}
      </div>

      <div className="flex items-start gap-3.5 mb-2">
        <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 mt-0.5 ${theme.iconBg}`}>
          {theme.icon}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <h4 className={`font-bold text-gray-800 tracking-tight leading-snug ${compact ? 'text-[14px]' : 'text-[15px] md:text-[16px]'} text-start`}>
            {safeTitle}
          </h4>
          {rawReasoning && (
            <p className={`font-medium text-gray-600 leading-relaxed text-start ${compact ? 'text-[12px]' : 'text-[13.5px] md:text-[14px]'}`}>
              {rawReasoning}
            </p>
          )}
        </div>
      </div>

      {/* Unified Footer Area */}
      <div className="pt-1.5 flex flex-col gap-2 mt-auto w-full">
        {showDecisionBanner && (
          <div className={`flex items-start gap-2 p-2.5 rounded-xl border ${decisionStyle.bg} ${decisionStyle.border} w-full`}>
            <div className={`shrink-0 w-2.5 h-2.5 rounded-full ${decisionStyle.dot} mt-1 ${displayStateKey === 'pending' || displayStateKey === 'executing' ? 'animate-pulse' : ''}`} />
            <div className="min-w-0 flex-1 text-start">
              <div className={`font-black text-[11px] md:text-[12px] leading-tight ${decisionStyle.text}`}>
                {displayStateLabel}
              </div>
              {decisionBannerMessage && (
                <p className={`font-medium text-[11px] md:text-[12px] leading-snug mt-0.5 ${decisionStyle.text}`}>
                  {decisionBannerMessage}
                </p>
              )}
            </div>
          </div>
        )}
        {showManualPrompt ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-start gap-2 p-3 rounded-xl border border-sky-100 bg-sky-50/60 w-full">
              <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-sky-500 mt-1 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-white" />
              </div>
              <p className="font-medium text-[12px] md:text-[13px] text-sky-800 leading-snug flex-1 text-start">
                {getActionExplanation(rec.category || rec.type, isEn, false)}
              </p>
            </div>
            <div className="flex gap-2 justify-end w-full">
              <button
                onClick={handleExecute}
                disabled={isLoading || Boolean(actionResult)}
                className={`px-3 py-1 text-white text-[12px] font-bold rounded-lg transition-all active:scale-95 shadow-sm flex items-center gap-1.5 whitespace-nowrap
                  bg-emerald-600 hover:bg-emerald-700 ${isLoading ? 'opacity-75' : ''}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                    </svg>
                    {isEn ? 'Executing…' : 'جاري التنفيذ…'}
                  </>
                ) : (isEn ? 'Execute' : 'نفذ')}
              </button>
              <button
                onClick={handleIgnore}
                className="px-3 py-1 bg-white border border-sky-200 text-sky-700 text-[12px] font-bold rounded-lg hover:bg-sky-100 hover:border-sky-300 transition-all active:scale-95 whitespace-nowrap"
              >
                {isEn ? 'Ignore' : 'تجاهل'}
              </button>
            </div>
          </div>
        ) : showLocalActionBanner ? (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-100 bg-emerald-50/80 w-full">
            <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
            </div>
            <div className="min-w-0 flex-1 text-start">
              <div className="font-black text-[12px] md:text-[13px] text-emerald-800 leading-snug">
                {actionResult === 'ignored'
                  ? (isEn ? 'Ignored' : 'تم التجاهل')
                  : actionResult === 'executed'
                    ? (isEn ? 'Executed' : 'تم التنفيذ')
                    : actionResult === 'failed'
                      ? (isEn ? 'Execution Failed' : 'تعذر التنفيذ')
                      : (isEn ? 'In Progress' : 'قيد التنفيذ')}
              </div>
              <p className="font-medium text-[11px] md:text-[12px] text-emerald-800 leading-snug mt-1">
                {actionResult === 'ignored'
                  ? getIgnoredRecommendationMessage(isEn)
                  : actionResult === 'executed' && !globalAutoMode
                    ? getManualCompletionExplanation(rec.category || rec.type, isEn)
                    : actionResult === 'failed'
                      ? (isEn ? 'The device command could not be sent. Please check the connection and try again.' : 'تعذر إرسال أمر الجهاز. يرجى التحقق من الاتصال والمحاولة مرة أخرى.')
                      : getInProgressRecommendationMessage(rec.category || rec.type, isEn)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end w-full">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[12px] text-gray-400 whitespace-nowrap">
              {isEn ? 'Helpful?' : 'مفيدة؟'}
            </span>
            <button
              onClick={(event) => handleFeedbackClick('down', event)}
              className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all
                ${feedbackState[rec.id] === 'down'
                  ? 'bg-red-50 border-red-300 text-red-600 scale-110'
                  : 'bg-gray-50/80 border-gray-100 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/>
              </svg>
            </button>
            <button
              onClick={(event) => handleFeedbackClick('up', event)}
              className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all
                ${feedbackState[rec.id] === 'up'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-600 scale-110'
                  : 'bg-gray-50/80 border-gray-100 text-gray-400 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/>
              </svg>
            </button>
          </div>
        </div>
        {feedbackNotice && (
          <div className="self-end px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold animate-fade-in">
            {feedbackNotice}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ALERT CARD ─────────────────────────────────────────────────────────────
export function AlertCard({
  alert,
  globalAutoMode,
  isEn,
  onAccept,
  onReject,
  onFeedback,
  feedbackState = {},
  showThanks = [],
  compact = false
}) {
  const isRtl = !isEn;
  const [isLoading, setIsLoading] = React.useState(false);
  const [executionSuccess, setExecutionSuccess] = React.useState(false);
  const [actionNotice, setActionNotice] = React.useState('');
  const [nowMs] = React.useState(() => Date.now());

  const severity = alert.severity || 'info';
  const severityConfig = {
    critical: { bg: '#FEF2F2', border: '#FECACA', dot: '#dc2626', label: isEn ? 'Critical' : 'حرج' },
    high:     { bg: '#FEF2F2', border: '#FECACA', dot: '#dc2626', label: isEn ? 'Critical' : 'حرج' },
    warning:  { bg: '#FFFBEB', border: '#FDE68A', dot: '#d97706', label: isEn ? 'Warning'  : 'تحذير' },
    info:     { bg: '#EFF6FF', border: '#BFDBFE', dot: '#3b82f6', label: isEn ? 'Info'     : 'معلومة' },
  };
  const cfg = severityConfig[severity] || severityConfig.info;

  const safeMessage = extractSafeText(alert.message, isEn ? 'System alert detected' : 'تم رصد تنبيه من النظام');
  const _safeAction = extractSafeText(alert.action, '');

  const sensorType = alert.sensor_type || '';
  const anomalyType = alert.anomaly_type || null;
  const lang = isEn ? 'en' : 'ar';
  const displayMessage = (() => {
    const sensorName = ALERT_SENSOR_NAMES[sensorType]?.[lang] || sensorType;
    const fn = ALERT_ANOMALY_TEXT[anomalyType]?.[lang];
    if (!fn) {
      return matchesAlertLanguage(safeMessage, lang)
        ? safeMessage
        : localizedGenericAlertMessage(alert, isEn, sensorName || (isEn ? 'System' : 'النظام'));
    }
    const val = formatAlertValue(sensorType, alert.actual_value ?? alert.value, lang) || '0';
    return fn(sensorName, val, alertTitleForSensor(sensorType, lang), alert);
  })();
  const msgText = safeMessage.toLowerCase();
  const category =
    (sensorType === 'water_tank' || msgText.includes('خزان') || msgText.includes('tank'))
      ? 'water_tank'
    : (sensorType === 'air_humidity' || sensorType === 'humidity' ||
     msgText.includes('رطوبة الهواء') || msgText.includes('humidity') ||
     msgText.includes('تهوية') || msgText.includes('مراوح') || sensorType.includes('ventilation'))
      ? 'humidity'
    : (sensorType.includes('temperature') || sensorType.includes('air_temp') ||
     sensorType === 'temperature' || msgText.includes('حرار') ||
     msgText.includes('temperature'))
      ? 'climate'
    : (sensorType.includes('soil') || msgText.includes('ترب') || msgText.includes('soil'))
      ? 'soil'
    : (sensorType.includes('water') || sensorType.includes('irrigation') ||
       sensorType.includes('humidity') || msgText.includes('ري') ||
       msgText.includes('irrigat') || msgText.includes('رطوبة'))
      ? 'irrigation'
    : (sensorType.includes('power') || sensorType.includes('energy') ||
       msgText.includes('طاقة') || msgText.includes('كهرب') ||
       msgText.includes('power') || msgText.includes('energy'))
      ? 'power'
    : 'system';

  const hasDirectAction = alertHasDirectDeviceAction(category);
  const actionType = category === 'climate'
    ? 'cool'
    : category === 'humidity'
      ? 'ventilate'
      : (category === 'irrigation' || category === 'soil' || category === 'water')
        ? 'irrigate'
        : 'general';
  const autoAlertExplanation = getAutoAlertSummary(category, isEn, alert.action_status, sensorType, displayMessage);
  const primaryActionLabel = isEn ? 'Execute' : 'نفذ';

  const domainTitle = isEn
    ? (category === 'climate'    ? 'Climate & Ventilation'
      : category === 'soil'      ? 'Soil & Crop Health'
      : category === 'water_tank' ? 'Water Tank'
      : category === 'irrigation' || category === 'water' ? 'Irrigation & Water'
      : category === 'humidity'  ? 'Climate & Ventilation'
      :                            'System')
    : (category === 'climate'    ? 'المناخ والتهوية'
      : category === 'soil'      ? 'بيئة وصحة التربة'
      : category === 'water_tank' ? 'خزان المياه'
      : category === 'irrigation' || category === 'water' ? 'الري والمياه'
      : category === 'humidity'  ? 'المناخ والتهوية'
      :                            'النظام');

  const formatAlertMeta = () => {
    const raw = alert.created_at || alert.timestamp;
    if (!raw) return null;
    const diffMs = nowMs - new Date(raw).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    if (diffMin < 1) return isEn ? 'Just now' : 'الآن';
    if (diffHr < 1) return isEn ? `${diffMin}m ago` : `منذ ${diffMin} دقيقة`;
    if (diffHr < 24) return isEn ? `${diffHr}h ago` : `منذ ${diffHr} ساعة`;
    return new Date(raw).toLocaleDateString(isEn ? 'en-GB' : 'ar-SA', { month: 'short', day: 'numeric' });
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const didExecute = await onAccept?.(alert.id, actionType);
      if (didExecute === false) {
        setActionNotice(isEn ? 'No device action was executed for this alert.' : 'لم يتم تنفيذ إجراء جهاز لهذا التنبيه.');
        setTimeout(() => setActionNotice(''), 3000);
        return;
      }
      setExecutionSuccess(true);
      setActionNotice(getAlertExecutionSuccessMessage(category, isEn));
      setTimeout(() => setActionNotice(''), 3000);
      setTimeout(() => setExecutionSuccess(false), 3000);
    } catch (err) {
      console.error('Confirm action failed:', err);
      setActionNotice(isEn ? 'Action failed. Please try again.' : 'تعذر تنفيذ الإجراء. حاولي مرة أخرى.');
      setTimeout(() => setActionNotice(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = () => {
    setExecutionSuccess(true);
    const message = isEn ? 'Review saved.' : 'تم حفظ المراجعة.';
    setActionNotice(message);
  };

  return (
    <div
      className={`bg-white/90 backdrop-blur-md rounded-[24px] border border-gray-100/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 flex flex-col overflow-hidden shrink-0 ${compact ? 'p-4' : 'p-5 md:p-6'}`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <span
            className="font-bold text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-lg whitespace-nowrap shrink-0"
            style={{ backgroundColor: cfg.bg, color: cfg.dot, border: `1px solid ${cfg.border}` }}
          >
            {cfg.label}
          </span>
          <span className={`font-bold text-gray-800 tracking-tight leading-tight ${compact ? 'text-[14px]' : 'text-[15px] md:text-[16px]'}`}>
            {domainTitle}
          </span>
        </div>
        {formatAlertMeta() && (
          <div className="font-bold text-[10px] text-gray-400 uppercase tracking-widest whitespace-nowrap mt-1">
            {formatAlertMeta()}
          </div>
        )}
      </div>

      <p className={`font-medium text-gray-600 leading-relaxed mb-1.5 text-start ${compact ? 'text-[13px]' : 'text-[14.5px] md:text-[15.5px]'}`} style={{ wordBreak: 'break-word' }}>
        {displayMessage}
      </p>

      {/* Unified Footer Area */}
      <div className="flex flex-col gap-2 mt-auto w-full">
        {!globalAutoMode ? (
          <div className="flex flex-col gap-2 p-2.5 rounded-xl border border-sky-100 bg-sky-50/50 w-full">
            <div className="flex items-start gap-2">
              <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-sky-500 mt-1 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
              </div>
              <p className="font-medium text-[12px] md:text-[13px] text-sky-800 leading-snug flex-1 text-start">
                {getManualAlertPrompt(category, isEn, sensorType, displayMessage)}
              </p>
            </div>
            {hasDirectAction ? (
              <div className="flex gap-2 justify-end w-full">
                <button
                  onClick={handleConfirm}
                  disabled={isLoading || executionSuccess}
                  className={`px-3 py-1 text-white text-[12px] font-bold rounded-lg transition-all active:scale-95 shadow-sm flex items-center gap-1.5 whitespace-nowrap
                    ${executionSuccess ? 'bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'} ${isLoading ? 'opacity-75' : ''}`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                      </svg>
                      {isEn ? 'Executing…' : 'جاري التنفيذ…'}
                    </>
                  ) : executionSuccess ? (
                    <>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {isEn ? 'Done' : 'تم'}
                    </>
                  ) : primaryActionLabel}
                </button>
                <button
                  onClick={() => onReject?.(alert.id)}
                  className="px-3 py-1 bg-white border border-sky-200 text-sky-700 text-[12px] font-bold rounded-lg hover:bg-sky-100 hover:border-sky-300 transition-all active:scale-95 whitespace-nowrap"
                >
                  {isEn ? 'Ignore' : 'تجاهل'}
                </button>
              </div>
            ) : (
              <div className="flex justify-end w-full">
                <button
                  onClick={handleReview}
                  disabled={executionSuccess}
                  className="px-3 py-1 bg-white border border-sky-200 text-sky-700 text-[12px] font-bold rounded-lg hover:bg-sky-100 hover:border-sky-300 transition-all active:scale-95 whitespace-nowrap"
                >
                  {executionSuccess ? (isEn ? 'Saved' : 'تم الحفظ') : (isEn ? 'Reviewed' : 'تمت المراجعة')}
                </button>
              </div>
            )}
            {actionNotice && (
              <div className="self-end px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold animate-fade-in">
                {actionNotice}
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex items-start gap-2 p-3 rounded-xl border w-full"
            style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
          >
            <div
              className="shrink-0 w-2.5 h-2.5 rounded-full mt-1 animate-pulse"
              style={{ backgroundColor: cfg.dot }}
            />
            <div className="min-w-0 flex-1 text-start">
              <div className="font-bold text-[12px] md:text-[13px] leading-snug" style={{ color: cfg.dot }}>
                {autoAlertExplanation}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end w-full">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[12px] text-gray-400 whitespace-nowrap">
              {isEn ? 'Helpful?' : 'مفيدة؟'}
            </span>
            <button
              onClick={() => onFeedback?.(alert.id, 'down')}
              className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all
                ${feedbackState[alert.id] === 'down'
                  ? 'bg-red-50 border-red-300 text-red-600 scale-110'
                  : 'bg-gray-50/80 border-gray-100 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/>
              </svg>
            </button>
            <button
              onClick={() => onFeedback?.(alert.id, 'up')}
              className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all
                ${feedbackState[alert.id] === 'up'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-600 scale-110'
                  : 'bg-gray-50/80 border-gray-100 text-gray-400 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/>
              </svg>
            </button>
          </div>
        </div>
        {showThanks.includes(alert.id) && (
          <div className="self-end px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold animate-fade-in">
            {isEn ? 'Thanks, your rating was saved.' : 'شكراً، تم حفظ تقييمك.'}
          </div>
        )}
      </div>
    </div>
  );
}

export {
  CardShell,
  CardTopRow,
  GaugeIcon,
  SensorTopBar,
  SensorPill,
  SensorPrimaryButton,
  WeatherIcon,
  Account_Card,
  Account_EditableField,
  Account_ListRow,
  Account_IconButton,
  Account_ModalShell,
  Account_PencilIcon,
  Account_TrashIcon,
  Account_PlusIcon,
  Account_SensorIcon,
  PlantSoilIcon,
  WaterValveIcon,
  ListIcon,
  WindSharedIcon,
  IrrigationSmartIcon,
  DashboardErrorBoundary,
  // eslint-disable-next-line react-refresh/only-export-components
  getRecommendationTheme
};
