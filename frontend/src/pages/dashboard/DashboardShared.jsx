import * as React from 'react';
import { useMemo, useState, useEffect } from 'react';
import { formatLastUpdated } from './dashboardUtils';

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

  static getDerivedStateFromError(error) {
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

function CardTopRow({ title, subtitle, onDetails, detailsLabel, icon, isEn = false, iconBg = "bg-emerald-50", iconColor = "text-[#059669]" }) {
  return (
    <div className="flex items-start justify-between gap-3">
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
      {detailsLabel && (
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

export function AlertsPanel({ alerts = [], isOpen, onClose, onAccept, onReject, onFeedback }) {
  const isEn = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en');
  
  if (!isOpen) return null;

  return (
    <div className="absolute top-14 left-0 w-80 bg-white/95 backdrop-blur-xl border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between p-4 border-b border-gray-50 bg-gray-50/50">
        <div className="font-black text-gray-800">{isEn ? 'System Alerts' : 'تنبيهات النظام'}</div>
        <div className="text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
          {alerts.length} {isEn ? 'Active' : 'نشط'}
        </div>
      </div>
      
      <div
        className="max-h-[400px] overflow-y-auto p-2 flex flex-col gap-2"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db transparent'
        }}
      >
        {alerts.length === 0 ? (
          <EmptyState 
            compact={true}
            title={isEn ? 'No active alerts' : 'لا توجد تنبيهات حالية'}
          />
        ) : (
          alerts.map((alert, i) => (
            <div key={alert.id || i} className={`p-3 rounded-xl border ${alert.severity === 'high' ? 'bg-red-50/50 border-red-100' : alert.severity === 'medium' ? 'bg-amber-50/50 border-amber-100' : 'bg-blue-50/50 border-blue-100'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1 w-full">
                  <div className={`text-[13px] font-black ${alert.severity === 'high' ? 'text-red-700' : alert.severity === 'medium' ? 'text-amber-700' : 'text-blue-700'}`}>
                    {alert.title}
                  </div>
                  <div className="text-xs text-gray-500 font-bold">{alert.sensor}: <span className="text-gray-800">{alert.value}</span></div>
                  <div className="text-[10.5px] text-gray-600 mt-1 flex items-start gap-1 font-medium leading-relaxed">
                    <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-gray-400 shrink-0"></div>
                    {alert.action}
                  </div>

                  {/* Interactive Footer */}
                  <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-end gap-2">
                    {alert.autoMode ? (
                      // Auto Mode: Feedback buttons
                      <>
                        <span className="text-xs text-gray-400 font-bold me-auto">{isEn ? 'Was this helpful?' : 'هل كان هذا مفيداً؟'}</span>
                        <button 
                          onClick={() => onFeedback && onFeedback(alert.id, true)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                        </button>
                        <button 
                          onClick={() => onFeedback && onFeedback(alert.id, false)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
                        </button>
                      </>
                    ) : (
                      // Manual Mode: Accept/Reject buttons
                      <>
                        <button 
                          onClick={() => onReject && onReject(alert.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-700 transition-all"
                        >
                          {isEn ? 'Reject' : 'تجاهل'}
                        </button>
                        <button 
                          onClick={() => onAccept && onAccept(alert.id, alert.actionType)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-600/20"
                        >
                          {isEn ? 'Accept' : 'تأكيد الإجراء'}
                        </button>
                      </>
                    )}
                  </div>

                </div>
                <div className="text-xs font-bold text-gray-400 shrink-0">{alert.timestamp}</div>
              </div>
            </div>
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
    } catch (e) {
      return data;
    }
  }
  if (typeof data === 'object') {
    return data.message || data.reasoning || data.action || JSON.stringify(data);
  }
  return String(data);
};

// ─── DESCRIPTIVE AUTONOMOUS TEXT UTILITY ────────────────────────────────────
function getActionExplanation(category, isEn, isAuto) {
  const c = (category || '').toLowerCase();

  // Climate / Temperature / Ventilation
  if (c === 'climate' || c === 'temperature') {
    if (isAuto) return isEn
      ? "Greenhouse fans activated autonomously to lower temperature and stabilize the crop environment."
      : "تم تشغيل المراوح تلقائياً لتخفيف درجة الحرارة وتلطيف أجواء الصوبة لضمان استقرار المحصول.";
    return isEn
      ? "Do you want to turn on the fans to lower the temperature and stabilize the crop environment?"
      : "هل تود تشغيل المراوح لتخفيف درجة الحرارة وتلطيف أجواء الصوبة؟";
  }

  // Irrigation / Water
  if (c === 'irrigation' || c === 'water') {
    if (isAuto) return isEn
      ? "Irrigation pumps activated autonomously to restore optimal soil moisture levels."
      : "تم تفعيل مضخات الري تلقائياً لاستعادة مستويات رطوبة التربة المثالية.";
    return isEn
      ? "Do you want to activate the irrigation pumps to restore optimal soil moisture levels?"
      : "هل تود تفعيل مضخات الري لاستعادة مستويات رطوبة التربة المثالية؟";
  }

  // Humidity
  if (c === 'humidity') {
    if (isAuto) return isEn
      ? "Humidification system activated autonomously to balance air humidity and protect crop health."
      : "تم تشغيل نظام الترطيب تلقائياً لموازنة رطوبة الهواء وحماية صحة المحصول.";
    return isEn
      ? "Do you want to activate the humidification system to balance air humidity?"
      : "هل تود تشغيل نظام الترطيب لموازنة رطوبة الهواء وحماية المحصول؟";
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

  // General / Default — still descriptive
  if (isAuto) return isEn
    ? "The digital twin system executed the recommended optimization action autonomously."
    : "قام نظام التوأم الرقمي بتنفيذ إجراء التحسين الموصى به تلقائياً.";
  return isEn
    ? "Do you want to execute the recommended action to optimize system performance?"
    : "هل تود تنفيذ الإجراء الموصى به لتحسين أداء النظام؟";
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
export function RecommendationCard({
  rec,
  farmId,
  globalAutoMode,
  isEn,
  onExecute,
  onIgnore,
  onFeedback,
  feedbackState = {},
  showThanks = [],
  compact = false
}) {
  const isRtl = !isEn;
  const theme = getRecommendationTheme(rec.category || rec.type, extractSafeText(rec.title || rec.message));
  const actionType = rec.category || rec.type || 'general';
  const [isLoading, setIsLoading] = React.useState(false);
  const [executionSuccess, setExecutionSuccess] = React.useState(false);

  const handleExecute = async () => {
    setIsLoading(true);
    try {
      await onExecute?.(actionType, farmId);
      setExecutionSuccess(true);
      setTimeout(() => setExecutionSuccess(false), 3000);
    } catch (err) {
      console.error('Execution failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const severityColor =
    rec.severity === 'urgent' ? '#dc2626' :
    rec.severity === 'warning' ? '#d97706' : '#10b981';

  const rawReasoning = extractSafeText(rec.reasoning);
  const safeTitle = extractSafeText(rec.title || rec.message);

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
    const raw = rec.created_at || rec.timestamp;
    if (!raw) return null;
    const diffMs = Date.now() - new Date(raw).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    if (diffMin < 1) return isEn ? 'Just now' : 'الآن';
    if (diffHr < 1) return isEn ? `${diffMin}m ago` : `منذ ${diffMin} دقيقة`;
    if (diffHr < 24) return isEn ? `${diffHr}h ago` : `منذ ${diffHr} ساعة`;
    return new Date(raw).toLocaleDateString(isEn ? 'en-GB' : 'ar-SA', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      className={`bg-white/90 backdrop-blur-md rounded-[24px] border border-gray-100/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 flex flex-col ${compact ? 'p-4' : 'p-5 md:p-6'}`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
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

      <div className="flex items-start gap-3.5 mb-4">
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

      <div className="pt-3 border-t border-gray-100/80 flex flex-wrap items-center justify-between gap-3 mt-auto">
        {!globalAutoMode ? (
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-2.5 rounded-xl border border-sky-100 bg-sky-50/50 flex-1 w-full mt-2 lg:mt-0">
            <div className="flex items-start xl:items-center gap-2">
              <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-sky-500 mt-1 xl:mt-0 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
              </div>
              <p className="font-medium text-[12px] text-sky-800 leading-snug flex-1 text-start">
                {getActionExplanation(rec.category || rec.type, isEn, false)}
              </p>
            </div>
            <div className="flex gap-2 ms-auto shrink-0">
              <button
                onClick={handleExecute}
                disabled={isLoading || executionSuccess}
                className={`px-4 py-1.5 text-white text-[13px] font-bold rounded-xl transition-all active:scale-95 shadow-sm flex items-center gap-1.5 whitespace-nowrap
                  ${executionSuccess ? 'bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'} ${isLoading ? 'opacity-75' : ''}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                    </svg>
                    {isEn ? 'Executing…' : 'جاري التنفيذ…'}
                  </>
                ) : executionSuccess ? (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {isEn ? 'Done' : 'تم'}
                  </>
                ) : (isEn ? 'Execute' : 'نفذ')}
              </button>
              <button
                onClick={() => onIgnore?.(rec.id)}
                className="px-4 py-1.5 bg-white border border-sky-200 text-sky-700 text-[13px] font-bold rounded-xl hover:bg-sky-100 hover:border-sky-300 transition-all active:scale-95 whitespace-nowrap"
              >
                {isEn ? 'Ignore' : 'تجاهل'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/80 flex-1 w-full mt-2 lg:mt-0">
            <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
            </div>
            <p className="font-medium text-[12px] text-emerald-800 leading-snug flex-1 text-start">
              {getActionExplanation(rec.category || rec.type, isEn, true)}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center gap-2 relative">
            <span className="font-medium text-[12px] text-gray-400 whitespace-nowrap">
              {isEn ? 'Helpful?' : 'مفيدة؟'}
            </span>
            <button
              onClick={() => onFeedback?.(rec.id, 'down')}
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
              onClick={() => onFeedback?.(rec.id, 'up')}
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
  onFeedback,
  feedbackState = {},
  showThanks = [],
  compact = false
}) {
  const isRtl = !isEn;
  const [isLoading, setIsLoading] = React.useState(false);
  const [executionSuccess, setExecutionSuccess] = React.useState(false);

  const severity = alert.severity || 'info';
  const severityConfig = {
    critical: { bg: '#FEF2F2', border: '#FECACA', dot: '#dc2626', label: isEn ? 'Critical' : 'حرج' },
    high:     { bg: '#FEF2F2', border: '#FECACA', dot: '#dc2626', label: isEn ? 'Critical' : 'حرج' },
    warning:  { bg: '#FFFBEB', border: '#FDE68A', dot: '#d97706', label: isEn ? 'Warning'  : 'تحذير' },
    info:     { bg: '#EFF6FF', border: '#BFDBFE', dot: '#3b82f6', label: isEn ? 'Info'     : 'معلومة' },
  };
  const cfg = severityConfig[severity] || severityConfig.info;

  const safeMessage = extractSafeText(alert.message, isEn ? 'System alert detected' : 'تم رصد تنبيه من النظام');
  const safeAction = extractSafeText(alert.action, '');

  const sensorType = alert.sensor_type || '';
  const msgText = safeMessage.toLowerCase();
  const category =
    (sensorType.includes('temperature') || sensorType.includes('air_temp') ||
     sensorType.includes('ventilation') || msgText.includes('حرار') ||
     msgText.includes('temperature') || msgText.includes('تهوية') || msgText.includes('مراوح'))
      ? 'climate'
    : (sensorType.includes('soil') || msgText.includes('ترب') || msgText.includes('soil'))
      ? 'soil'
    : (sensorType.includes('water') || sensorType.includes('irrigation') ||
       sensorType.includes('humidity') || msgText.includes('ري') ||
       msgText.includes('irrigat') || msgText.includes('رطوبة'))
      ? 'irrigation'
    : 'system';

  const actionType = category === 'climate' ? 'cool' : category === 'irrigation' ? 'irrigate' : 'general';

  const domainTitle = isEn
    ? (category === 'climate'    ? 'Climate & Ventilation'
      : category === 'soil'      ? 'Soil & Crop Health'
      : category === 'irrigation'? 'Irrigation & Water'
      :                            'System')
    : (category === 'climate'    ? 'المناخ والتهوية'
      : category === 'soil'      ? 'بيئة وصحة التربة'
      : category === 'irrigation'? 'الري والمياه'
      :                            'النظام');

  const formatAlertMeta = () => {
    const raw = alert.created_at || alert.timestamp;
    if (!raw) return null;
    const diffMs = Date.now() - new Date(raw).getTime();
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
      await onAccept?.(alert.id, actionType);
      setExecutionSuccess(true);
      setTimeout(() => setExecutionSuccess(false), 3000);
    } catch (err) {
      console.error('Confirm action failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`bg-white/90 backdrop-blur-md rounded-[24px] border border-gray-100/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 flex flex-col overflow-hidden ${compact ? 'p-4' : 'p-5 md:p-6'}`}
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

      <p className={`font-medium text-gray-600 leading-relaxed mb-3 text-start ${compact ? 'text-[12px]' : 'text-[13.5px] md:text-[14px]'}`} style={{ wordBreak: 'break-word' }}>
        {safeMessage}
      </p>





      {/* Unified Footer Area */}
      <div className="pt-3 border-t border-gray-100/80 flex flex-wrap items-center justify-between gap-3 mt-auto">
        {!globalAutoMode ? (
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-2.5 rounded-xl border border-sky-100 bg-sky-50/50 flex-1 w-full mt-2 lg:mt-0">
            <div className="flex items-start xl:items-center gap-2">
              <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-sky-500 mt-1 xl:mt-0 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
              </div>
              <p className="font-medium text-[12px] text-sky-800 leading-snug flex-1 text-start">
                {getActionExplanation(category, isEn, false)}
              </p>
            </div>
            <div className="flex gap-2 ms-auto shrink-0">
              <button
                onClick={handleConfirm}
                disabled={isLoading || executionSuccess}
                className={`px-4 py-1.5 text-white text-[13px] font-bold rounded-xl transition-all active:scale-95 shadow-sm flex items-center gap-1.5 whitespace-nowrap
                  ${executionSuccess ? 'bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'} ${isLoading ? 'opacity-75' : ''}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                    </svg>
                    {isEn ? 'Executing…' : 'جاري التنفيذ…'}
                  </>
                ) : executionSuccess ? (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {isEn ? 'Done' : 'تم'}
                  </>
                ) : (isEn ? 'Execute' : 'نفذ')}
              </button>
              <button className="px-4 py-1.5 bg-white border border-sky-200 text-sky-700 text-[13px] font-bold rounded-xl hover:bg-sky-100 hover:border-sky-300 transition-all active:scale-95 whitespace-nowrap">
                {isEn ? 'Ignore' : 'تجاهل'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/80 flex-1 w-full mt-2 lg:mt-0">
            <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
            </div>
            <p className="font-medium text-[12px] text-emerald-800 leading-snug flex-1 text-start">
              {getActionExplanation(category, isEn, true)}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center gap-2 relative">
            <span className="font-medium text-[12px] text-gray-400 whitespace-nowrap">
              {isEn ? 'Appropriate?' : 'مفيدة؟'}
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
  getRecommendationTheme
};
