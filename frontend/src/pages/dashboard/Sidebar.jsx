import { useState, useEffect } from 'react';
import { translations } from '../../i18n';
import { 
  WeatherIcon, 
  PlantSoilIcon, 
  WaterValveIcon, 
  ListIcon,
  WindIcon,
  IrrigationSmartIcon 
} from './dashboardShared';

export function Sidebar({ currentPage, onGo, T, activeFarm, setActiveFarm }) {

  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isRtl = lang === 'ar';

  const modulesMenu = [
    { label: T.dashboard, icon: "dashboard", page: "dashboard" },
    { label: T.temperature, icon: "wind", page: "microclimate" },
    { label: T.soilMoisture, icon: "soil", page: "soil" },
    { label: T.irrigation, icon: "irrigation", page: "irrigation" },
    { label: T.recommendations, icon: "list", page: "dss" },
  ];

  const farms = isRtl 
    ? ["محمية الخضروات", "محمية الفواكه", "محمية الورقيات"]
    : ["Vegetable Greenhouse", "Fruit Greenhouse", "Leafy Greens"];

  return (
    <div className={`w-64 bg-white flex flex-col flex-shrink-0 h-full shadow-2xl lg:shadow-none ${isRtl ? 'border-l' : 'border-r'} border-gray-100/60`}>
      {/* Logo and System Name */}
      <div className="pt-8 pb-6 flex flex-col items-center justify-center gap-2 mx-4 transition-all duration-300">
        <img src="/logo.png" alt="Warif" className="w-40 h-auto object-contain cursor-pointer drop-shadow-sm hover:scale-105 transition-transform duration-300" onClick={() => onGo("dashboard")} />
        <div className="text-[16px] font-black text-gray-800 tracking-tight mt-1">{isRtl ? 'نظام وارِف' : 'Warif System'}</div>
        <div className="text-[9px] font-black text-emerald-600/60 tracking-[0.3em] uppercase opacity-80">
          {T.digitalTwin}
        </div>
      </div>

      {/* Farms Selection */}
      <div className="p-4 border-b border-gray-50/80">
        <div className={`text-[11px] text-gray-400 font-bold mb-3 px-1 uppercase tracking-widest ${isRtl ? 'text-right' : 'text-left'}`}>{translations[lang].selectGreenhouse}</div>
        {farms.map((farm, i) => (
          <div key={farm} onClick={() => { setActiveFarm(i); onGo("dashboard"); }} className={`sidebar-item flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-[13px] mb-1 transition-all duration-300 ${activeFarm === i ? "active bg-emerald-50 text-emerald-700 font-bold shadow-sm border border-emerald-100/50" : "text-gray-500 hover:bg-gray-50"
            }`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={activeFarm === i ? "text-emerald-600" : "text-gray-400"}><path d="M5 21v-4a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v4M12 3v10M8.5 7.5l7 7M15.5 7.5l-7 7"/></svg>
            {farm}
          </div>
        ))}
      </div>

      {/* Modules */}
      <div className="p-4 flex-1">
        <div className={`text-[11px] text-gray-400 font-bold mb-3 px-1 uppercase tracking-widest ${isRtl ? 'text-right' : 'text-left'}`}>{translations[lang].moduleControl}</div>
        {modulesMenu.map((item) => (
          <div key={item.page} onClick={() => onGo(item.page)}
            className={`sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[13px] font-bold mb-1 transition-all duration-300 ${currentPage === item.page ? "active bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100/50" : "text-gray-600 hover:bg-gray-50/80"
              }`}>
            <span className={`w-6 h-6 flex items-center justify-center rounded-lg ${currentPage === item.page ? 'bg-emerald-100/50 text-emerald-600' : 'text-gray-400'}`}>
              {item.icon === "dashboard" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>}
              {item.icon === "wind" && <WindIcon />}
              {item.icon === "soil" && <PlantSoilIcon />}
              {item.icon === "irrigation" && <IrrigationSmartIcon />}
              {item.icon === "list" && <ListIcon />}
            </span>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="bg-[#fff7ed] text-[#ea580c] text-[10px] px-1.5 py-0.5 rounded font-bold border border-orange-200">{item.badge}</span>
            )}
          </div>
        ))}
      </div>
      
    </div>
  );
}

/* =========================================================
   Dashboard Content (Cards Grid only — sidebar is separate)
========================================================= */
