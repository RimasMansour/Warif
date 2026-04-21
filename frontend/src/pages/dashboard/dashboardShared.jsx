import { useMemo, useState } from 'react';

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

function CardTopRow({ title, subtitle, onDetails, detailsLabel, icon, isEn = false }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100/50 flex items-center justify-center text-[#2E7D32] shadow-sm">
            {icon}
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

export function TempSunIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 4V16C14 17.1046 13.1046 18 12 18C10.8954 18 10 17.1046 10 16V4C10 2.89543 10.8954 2 12 2C13.1046 2 14 2.89543 14 4Z" fill="#E8F5E9" stroke="#2E7D32" strokeWidth="1.5"/>
      <path d="M10 14H14" stroke="#2E7D32" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="18" r="4" fill="#10b981" stroke="#2E7D32" strokeWidth="1.5"/>
      <path d="M12 16V20M10 18H14" stroke="white" strokeWidth="1" strokeLinecap="round"/>
      <circle cx="19" cy="8" r="3" fill="#10b981" opacity="0.3"/>
    </svg>
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

export function AirHumidityIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C16.4183 22 20 18.4183 20 14C20 8 12 2 12 2C12 2 4 8 4 14C4 18.4183 7.58172 22 12 22Z" fill="#E8F5E9" stroke="#10b981" strokeWidth="1.5"/>
      <path d="M8 14C8 14 9.5 15.5 12 15.5C14.5 15.5 16 14 16 14" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="11" r="1" fill="#10b981"/>
    </svg>
  );
}

export function SoilDropIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C17.5228 22 22 20.2091 22 18C22 15.7909 17.5228 14 12 14C6.47715 14 2 15.7909 2 18C2 20.2091 6.47715 22 12 22Z" fill="#E8F5E9" stroke="#2E7D32" strokeWidth="1.5"/>
      <path d="M12 14V4M12 4L9 7M12 4L15 7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 10C7 10 9 8 12 8C15 8 17 10 17 10" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

export function DropBadgeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L15 8H9L12 2Z" fill="#0EA5E9"/>
      <rect x="11" y="8" width="2" height="10" rx="1" fill="#0EA5E9"/>
      <path d="M7 14L10 14M14 14L17 14" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="18" r="3" stroke="#0EA5E9" strokeWidth="1.5" fill="#E0F2FE"/>
    </svg>
  );
}

function SensorTopBar({ title, subtitle, icon, onBack, onExport }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#E8F5E9] flex items-center justify-center text-[#2E7D32]">
          {icon}
        </div>
        <div className="text-right">
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
            تصدير التقرير
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 transition-opacity">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        )}
        <button 
          type="button" 
          onClick={onBack} 
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-600 hover:text-[#2E7D32] hover:border-[#2E7D32]/30 hover:bg-[#f0fdf4] transition-all duration-300 flex items-center gap-2 font-bold shadow-sm active:scale-95 group"
        >
          رجوع
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 transition-opacity">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
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
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
      <div className="text-right">
        <div className="text-sm text-gray-500">{label}</div>
        <div className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
      <button type="button" onClick={onEdit} className="text-sm font-semibold text-[#2E7D32] hover:text-[#1B5E20] transition-colors duration-200">تعديل</button>
    </div>
  );
}

function Account_ListRow({ icon, title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-gray-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#E8F5E9] flex items-center justify-center flex-shrink-0">{icon}</div>
        <div className="text-right">
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          <div className="text-xs text-gray-500">{subtitle}</div>
        </div>
      </div>
      {right}
    </div>
  );
}

function Account_IconButton({ children, title, onClick, danger }) {
  return (
    <button type="button" onClick={onClick} title={title} className={`w-10 h-10 rounded-2xl border transition flex items-center justify-center ${danger ? 'bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{children}</button>
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

function Account_PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function Account_TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}

function Account_PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function Account_SensorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="12" r="3" /><path d="M12 7v-3" />
    </svg>
  );
}

// --- SHARED PROFESSIONAL ICONS ---

function PlantSoilIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20c0-3 3-4 8-4s8 1 8 4" />
      <path d="M12 16V8" />
      <path d="M12 8c-2-2-5-2-5 0 0 3 3 4 5 4" />
      <path d="M12 8c2-2 5-2 5 0 0 3-3 4-5 4" />
    </svg>
  );
}

function WaterValveIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h16" />
      <path d="M12 12V8" />
      <circle cx="12" cy="6" r="3" />
      <path d="M12 12s-2 2-2 5 2 5 2 5 2-2 2-5-2-5-2-5Z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="16" y2="6" />
      <line x1="3" y1="12" x2="16" y2="12" />
      <line x1="3" y1="18" x2="16" y2="18" />
      <line x1="21" y1="6" x2="21.01" y2="6" />
      <line x1="21" y1="12" x2="21.01" y2="12" />
      <line x1="21" y1="18" x2="21.01" y2="18" />
    </svg>
  );
}

function WindIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.7 7.7A2.5 2.5 0 1 1 20 12H5" />
      <path d="M9.601 3.599A2.5 2.5 0 1 0 8 8h12" />
      <path d="M11.3 20.3A2.5 2.5 0 1 1 9 16h12" />
    </svg>
  );
}

function IrrigationSmartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      <path d="m5 15 2-2" />
      <path d="m19 15-2-2" />
      <path d="M12 12v4" />
      <path d="m9 13 1 1" />
      <path d="m15 13-1 1" />
    </svg>
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
  WindIcon,
  IrrigationSmartIcon
};
