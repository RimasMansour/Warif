import React, { useState, useMemo } from 'react';
import { CardShell } from './DashboardShared';
import { useSensorHistory } from '../../hooks/useWarifData';
import { getLabelForRange } from './dashboardUtils';

const getDateRangeLabel = (range, isRtl) => {
  const now = new Date();
  const monthsAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ms = isRtl ? monthsAr : monthsEn;
  
  if (range === 'D') return `${now.getDate()} ${ms[now.getMonth()]}`;
  if (range === 'W') {
    const start = new Date();
    start.setDate(now.getDate() - 6);
    if (start.getMonth() === now.getMonth()) {
      return `${start.getDate()} - ${now.getDate()} ${ms[now.getMonth()]}`;
    }
    return `${start.getDate()} ${ms[start.getMonth()]} - ${now.getDate()} ${ms[now.getMonth()]}`;
  }
  if (range === 'M') return `1 - ${now.getDate()} ${ms[now.getMonth()]}`;
  if (range === 'Y') return isRtl ? `عام ${now.getFullYear()}` : `Year ${now.getFullYear()}`;
  return '';
};

export function SustainabilityDonut({ value, label, sublabel, color = "#10b981", isRtl = false }) {
  const size = 160;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#F3F4F6" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={off}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-black text-gray-800 leading-none">{value}%</span>
          <span className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">{label}</span>
        </div>
      </div>
      {sublabel && (
        <div className="mt-4 px-4 py-1.5 bg-gray-50 rounded-full border border-gray-100">
          <span className="text-xs font-black text-gray-500">{sublabel}</span>
        </div>
      )}
    </div>
  );
}

export function Donut({ value, color = "var(--status-success)", size = 120, stroke = 12, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isRtl = lang === 'ar';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#F3F4F6" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={off}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-gray-800">{value}{isRtl ? '٪' : '%'}</span>
        </div>
      </div>
      {label && <span className="mt-2 text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</span>}
    </div>
  );
}

export function IrrigationDonut({ value }) {
  const v = Math.max(0, Math.min(100, value));
  const size = 95;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isRtl = lang === 'ar';
  const c = 2 * Math.PI * r;
  const off = c - (v / 100) * c;

  const getColor = (val) => {
    if (val >= 75) return "var(--status-success)"; 
    if (val >= 45) return "var(--status-warning)";
    return "var(--status-error)";
  };

  return (
    <svg width={size} height={size + 20} viewBox={`0 0 ${size} ${size + 20}`} className="overflow-visible">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#F3F4F6" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={getColor(v)}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-1000 ease-out"
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="19" fill="#111827" fontWeight="1000">
        {v}{isRtl ? '٪' : '%'}
      </text>
      <text x="50%" y={size + 10} dominantBaseline="middle" textAnchor="middle" fontSize="10" fill="#9CA3AF" fontWeight="bold" className="uppercase tracking-tighter">
        {isRtl ? 'كفاءة التدفق' : 'Flow Efficiency'}
      </text>
    </svg>
  );
}

export function IrrigationBarChart2D({ data, yLabel, unit }) {
  const pad = 36;
  const h = 260;
  const n = data.length;
  const w = Math.max(860, pad * 2 + n * 18);
  const barW = 10;
  const gap = 8;
  const ys = data.map((d) => d.value);
  const yMin = Math.floor(Math.min(...ys, 0) - 2);
  const yMax = Math.ceil(Math.max(...ys, 10) + 2);

  const x = (i) => pad + i * (barW + gap);
  const y = (val) => h - pad - ((val - yMin) / (yMax - yMin || 1)) * (h - pad * 2);
  const barH = (val) => h - pad - y(val);

  const colorFor = (v) => {
    const t = (v - yMin) / (yMax - yMin || 1);
    const hue = 145 - t * 25;
    return `hsl(${hue} 55% 45%)`;
  };

  return (
    <div className="w-full h-full relative">
      <svg 
        width="100%" 
        height={h} 
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        className="block"
      >
        {Array.from({ length: 6 }).map((_, i) => {
          const v = yMin + ((yMax - yMin) * i) / 5;
          const yy = y(v);
          return (
            <g key={i}>
              <line x1={pad} y1={yy} x2={w - pad} y2={yy} stroke="#F3F4F6" strokeDasharray="4 4" />
              <text x={pad - 8} y={yy + 4} fontSize="10" fill="#9CA3AF" textAnchor="end">{v.toFixed(0)}</text>
            </g>
          );
        })}
        {data.map((d, i) => (
          <rect key={d.day} x={x(i)} y={y(d.value)} width={barW} height={barH(d.value)} rx="3" fill={colorFor(d.value)} />
        ))}
      </svg>
    </div>
  );
}

export function HealthStyleBarChart({ 
  range, 
  onRangeChange, 
  data, 
  unit, 
  metricName, 
  color = "var(--status-success)", 
  xAxisTitle,
  yAxisTitle,
  T,
  isRtl
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  
  const ranges = [
    { key: 'D', label: T.dayLabel },
    { key: 'W', label: T.weekLabel },
    { key: 'M', label: T.monthLabel },
    { key: 'Y', label: T.yearLabel },
  ];

  const h = 240; 
  const n = data.length;
  const isDay = range === 'D';
  const isWeek = range === 'W';
  const isMonth = range === 'M';
  const isYear = range === 'Y';

  const pLeft = 85; 
  const pRight = 45;
  const padTop = 15; 
  const padBottom = 35; 
  
  const w = 900; 
  
  const gapBetweenGroups = isDay ? 4 : isWeek ? 16 : isMonth ? 4 : 12;
  const slotW = (w - pLeft - pRight) / n;
  const barW = (slotW - gapBetweenGroups) / 2;
  const totalContentW = n * (barW * 2) + (n - 1) * gapBetweenGroups;
  const startOffset = (w - pLeft - pRight - totalContentW) / 2;
  const x = (i) => pLeft + startOffset + i * (barW * 2 + gapBetweenGroups);

  const ys = data.flatMap(d => [d.water || 0, d.power || 0, d.value || 0]);
  const yMax = Math.ceil(Math.max(...ys, 5) / 10) * 10 + 10; 
  const yPos = (v) => h - padBottom - (v / (yMax || 1)) * (h - padTop - padBottom);
  const barH = (v) => Math.max(2, (h - padBottom) - yPos(v));

  return (
    <CardShell className="p-5 relative group/chart" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center mb-6 flex-row">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-black text-gray-800 leading-none">
              {metricName}
            </h2>
            <span className="bg-emerald-50 text-emerald-600 text-xs px-2 py-0.5 rounded-lg border border-emerald-100/50 font-black uppercase tracking-tighter">
              {T.realtimeAnalysis}
            </span>
          </div>
          <div className="text-[14px] font-bold text-gray-400">{getDateRangeLabel(range, isRtl)}</div>
        </div>

        <div className="flex flex-col items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm min-w-[100px]">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-gray-800 tracking-tight">
              {range === 'D' ? data[n-1]?.value : (data.reduce((a, b) => a + b.value, 0) / n).toFixed(1)}
            </span>
            <span className="text-[12px] font-bold text-gray-400 font-black">{unit}</span>
          </div>
          <div className="text-xs font-black text-emerald-600 mt-1 uppercase tracking-tighter">{T.periodAverage}</div>
        </div>
      </div>

      <div className="flex bg-gray-50 p-1 rounded-xl mb-4 gap-1 w-max mx-auto border border-gray-100 shadow-inner">
        {ranges.map(r => (
          <button
            key={r.key}
            onClick={() => onRangeChange(r.key)}
            className={`px-5 py-2 text-xs font-black rounded-lg transition-all duration-300 ${
              range === r.key ? 'bg-white text-emerald-900 shadow-md scale-[1.02]' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="w-full h-full relative min-h-[170px] mt-2">
        <svg 
          width="100%" 
          height={195} 
          viewBox="-100 0 1000 330"
          preserveAspectRatio="xMidYMid meet"
          className="block overflow-visible" 
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <text x={- (h-padBottom)/2 - padTop + 10} y={5} transform="rotate(-90)" textAnchor="middle" fontSize="24" fontWeight="1000" fill="#2E7D32" opacity="0.6">
            {yAxisTitle || T.consumptionRate}
          </text>

          {/* Horizontal X Label for HealthStyleBarChart */}
          <text 
            x={pLeft + (w-pLeft-pRight)/2} y={h - padBottom + 70} 
            textAnchor="middle" fontSize="24" fontWeight="1000" fill="#2E7D32" opacity="0.6"
          >
            {isRtl ? 'الوقت' : 'Time'}
          </text>

          <line x1={pLeft} y1={padTop} x2={pLeft} y2={h - padBottom} stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
          <line x1={pLeft} y1={h - padBottom} x2={w - pRight} y2={h - padBottom} stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
          
          {[0, 0.25, 0.5, 0.75, 1].map(i => {
              const v = yMax * i;
              const yy = yPos(v);
              return (
                <g key={i}>
                <line x1={pLeft} x2={w-pRight} y1={yy} y2={yy} stroke="#F8FAFC" strokeWidth="1" strokeDasharray="4 4" />
                <text x={pLeft - 30} y={yy} dominantBaseline="central" textAnchor="end" fontSize="22" fontWeight="black" fill="#94A3B8">
                  {Math.round(v)}
                </text>
              </g>
              );
          })}

          {data.map((d, i) => {
            const groupX = pLeft + startOffset + i * (barW * 2 + gapBetweenGroups);
            const yy = yPos(d.value);
            const hh = barH(d.value);
            const isHovered = hoveredIdx === i;
            
            let showLabel = false;
            let labelText = d.label;
            if (range === 'D' && i % 6 === 0) showLabel = true;
            else if (range === 'W') showLabel = true;
            else if (range === 'M' && i % 4 === 0) showLabel = true;
            else if (range === 'Y' && i % 3 === 0) showLabel = true;

            return (
              <g key={i} onMouseEnter={() => setHoveredIdx(i)}>
                {/* Invisible interaction area to make hovering easier */}
                <rect 
                   x={groupX - gapBetweenGroups/2} y={padTop} width={barW * 2 + gapBetweenGroups} height={h-padTop-padBottom} 
                   fill="transparent" className="cursor-pointer"
                />
                
                {/* The Bar with scale-up effect */}
                <rect
                  x={groupX} y={yy} width={barW * 2} height={hh}
                  fill={isHovered ? "url(#hoverGrad)" : color}
                  rx="4" className="transition-all duration-300 ease-out"
                  style={{ 
                    opacity: hoveredIdx !== null && !isHovered ? 0.3 : 1,
                    transform: isHovered ? 'scaleY(1.03)' : 'scaleY(1)',
                    transformOrigin: 'bottom'
                  }}
                />
                
                {showLabel && (
                  <text x={groupX + barW} y={h-padBottom+28} textAnchor="middle" fontSize="20" fill="#94A3B8" fontWeight="black" className="transition-opacity duration-300">
                    {labelText}
                  </text>
                )}

                {/* Professional Tooltip */}
                {isHovered && (
                  <g pointerEvents="none" className="animate-in fade-in zoom-in duration-200">
                    <rect 
                      x={groupX + barW - 45} y={yy - 60} width="90" height="40" 
                      rx="12" fill="#111827" 
                      filter="drop-shadow(0 10px 15px rgba(0,0,0,0.3))" 
                    />
                    <text 
                      x={groupX + barW} y={yy - 34} 
                      textAnchor="middle" fontSize="16" fontWeight="900" fill="white"
                    >
                      {d.value}{unit}
                    </text>
                    <path d={`M ${groupX+barW-6} ${yy-20} L ${groupX+barW} ${yy-10} L ${groupX+barW+6} ${yy-20} Z`} fill="#111827" />
                  </g>
                )}
              </g>
            );
          })}
          <defs>
            <linearGradient id="hoverGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </CardShell>
  );
}

export function SustainabilityLineChart({ range, onRangeChange, data, metricName, xAxisTitle, yAxisTitle, T, isRtl }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  
  const ranges = [
    { key: 'D', label: T.dayLabel },
    { key: 'W', label: T.weekLabel },
    { key: 'M', label: T.monthLabel },
    { key: 'Y', label: T.yearLabel },
  ];

  const h = 360; 
  const pLeft = 120; 
  const pRight = 80;
  const pTop = 24; 
  const pBottom = 82; 
  
  const n = data.length;
  const w = 860; 
  const segmentW = (w - pLeft - pRight) / (n - 1 || 1);

  const allValues = data.flatMap(d => [d.water || 0, d.power || 0]);
  const yMax = Math.ceil(Math.max(...allValues, 2) / 5) * 5; 
  const getY = (v) => h - pBottom - (v / (yMax || 1)) * (h - pTop - pBottom);
  const getX = (i) => pLeft + i * segmentW;

  const getPath = (key) => {
    if (n < 2) return "";
    let d = `M ${getX(0)} ${getY(data[0][key])}`;
    for (let i = 0; i < n - 1; i++) {
        const x1 = getX(i);
        const y1 = getY(data[i][key]);
        const x2 = getX(i + 1);
        const y2 = getY(data[i + 1][key]);
        const midX = (x1 + x2) / 2;
        d += ` C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    }
    return d;
  };

  const getAreaPath = (key) => {
    const p = getPath(key);
    if (!p) return "";
    return `${p} L ${getX(n-1)} ${h - pBottom} L ${getX(0)} ${h - pBottom} Z`;
  };

  return (
    <CardShell className="p-5 relative group/chart overflow-visible" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center mb-4 flex-row">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-black text-gray-800 leading-none">
              {metricName || T.unifiedConsumption}
            </h2>
            <span className="bg-emerald-50 text-emerald-600 text-xs px-2.5 py-1 rounded-lg border border-emerald-100 font-black tracking-tight uppercase">
              {T.sustainabilityAnalysis}
            </span>
          </div>
          <div className="text-[14px] font-bold text-gray-400">{getDateRangeLabel(range, isRtl)}</div>
        </div>

        <div className="flex flex-col items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm min-w-[100px]">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-gray-800 tracking-tight">
              {(data.reduce((a, b) => a + (b.water + b.power)/2, 0) / n).toFixed(1)}
            </span>
            <span className="text-[12px] font-bold text-gray-400 font-black">avg</span>
          </div>
          <div className="text-xs font-black text-emerald-600 mt-1 uppercase tracking-tighter">{T.periodAverage}</div>
        </div>
      </div>

      <div className="flex bg-gray-50/80 p-1 rounded-xl mb-4 gap-1 w-max mx-auto border border-gray-100 shadow-inner">
        {ranges.map(r => (
          <button
            key={r.key}
            onClick={() => onRangeChange(r.key)}
            className={`px-5 py-2 text-xs font-black rounded-lg transition-all duration-300 ${
              range === r.key ? 'bg-white text-emerald-900 shadow-md scale-[1.02]' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[var(--status-info)] shadow-sm shadow-blue-200" />
          <span className="text-[12px] font-black text-gray-600">{T?.waterLabel || 'Water'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#EAB308] shadow-sm shadow-yellow-200" />
          <span className="text-[12px] font-black text-gray-600">{T?.powerLabel || 'Power'}</span>
        </div>
      </div>

      <div className="w-full max-w-[800px] mx-auto" style={{ maxHeight: '360px' }} onMouseLeave={() => setHoveredIdx(null)}>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="waterAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25"/>
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02"/>
            </linearGradient>
            <linearGradient id="powerAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02"/>
            </linearGradient>
          </defs>

          {/* Y axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const val = yMax * ratio;
            const yy = getY(val);
            return (
              <g key={idx}>
                <line x1={pLeft} x2={w - pRight} y1={yy} y2={yy}
                  stroke="#f1f5f9" strokeWidth="1.5" strokeDasharray="4 4"/>
                <text x={pLeft - 45} y={yy} dominantBaseline="central"
                  textAnchor="end" fontSize="16" fill="#94a3b8" fontWeight="bold">
                  {val >= 1000 ? `${(val/1000).toFixed(1)}k` : val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Y axis label */}
          <text x={40} y={pTop + (h - pTop - pBottom) / 2}
            transform={`rotate(-90, 40, ${pTop + (h - pTop - pBottom) / 2})`}
            textAnchor="middle" fontSize="18" fill="#059669" fontWeight="900" opacity="0.6">
            {isRtl ? 'الاستهلاك' : 'Usage'}
          </text>

          {/* Area fills */}
          <path d={getAreaPath('water')} fill="url(#waterAreaGrad)"/>
          <path d={getAreaPath('power')} fill="url(#powerAreaGrad)"/>

          {/* Lines */}
          <path d={getPath('water')} fill="none"
            stroke="#3b82f6" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"/>
          <path d={getPath('power')} fill="none"
            stroke="#f59e0b" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"/>

          {/* Hover dots + tooltips */}
          {data.map((d, i) => {
            const xx = getX(i);
            const isHov = hoveredIdx === i;
            const step = Math.max(1, Math.floor(n / 6));
            const showLabel = i % step === 0;

            return (
              <g key={i} onMouseEnter={() => setHoveredIdx(i)}>
                <rect x={xx - segmentW/2} y={pTop} width={segmentW} height={h - pTop - pBottom}
                  fill="transparent" className="cursor-pointer"/>

                {isHov && (
                  <g pointerEvents="none">
                    <line x1={xx} y1={pTop} x2={xx} y2={h - pBottom}
                      stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 3" opacity="0.7"/>
                    <circle cx={xx} cy={getY(d.water)} r={5}
                      fill="#3b82f6" stroke="white" strokeWidth="2"/>
                    <circle cx={xx} cy={getY(d.power)} r={5}
                      fill="#f59e0b" stroke="white" strokeWidth="2"/>
                    <rect x={Math.max(pLeft, Math.min(w - pRight - 130, xx - 65))} y={pTop + 10}
                      width={130} height={60} rx="10" fill="#111827"
                      filter="drop-shadow(0 4px 12px rgba(0,0,0,0.25))"/>
                    <text x={Math.max(pLeft, Math.min(w - pRight - 130, xx - 65)) + 65}
                      y={pTop + 32} textAnchor="middle" fontSize="13" fill="#94a3b8" fontWeight="bold">
                      {d.label}
                    </text>
                    <text x={Math.max(pLeft, Math.min(w - pRight - 130, xx - 65)) + 65}
                      y={pTop + 48} textAnchor="middle" fontSize="14" fill="#3b82f6" fontWeight="900">
                      {d.water.toFixed(2)} L
                    </text>
                    <text x={Math.max(pLeft, Math.min(w - pRight - 130, xx - 65)) + 65}
                      y={pTop + 64} textAnchor="middle" fontSize="14" fill="#f59e0b" fontWeight="900">
                      {d.power.toFixed(3)} kWh
                    </text>
                  </g>
                )}

                {showLabel && (
                  <text x={xx} y={h - pBottom + 34}
                    textAnchor="middle" fontSize="14" fill="#94a3b8" fontWeight="bold">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* X axis title */}
          <text x={pLeft + (w - pLeft - pRight) / 2} y={h - 10}
            textAnchor="middle" fontSize="18" fill="#059669" fontWeight="900" opacity="0.6">
            {isRtl ? 'الوقت' : 'Time'}
          </text>

          {/* Axes */}
          <line x1={pLeft} y1={pTop} x2={pLeft} y2={h - pBottom}
            stroke="#e2e8f0" strokeWidth="2"/>
          <line x1={pLeft} y1={h - pBottom} x2={w - pRight} y2={h - pBottom}
            stroke="#e2e8f0" strokeWidth="2"/>
        </svg>
      </div>
    </CardShell>
  );
}

export function TrendSparkline({ currentValue, threshold = 30, color = "#3B82F6", isRtl = false }) {
  const h = 60;
  const w = 150;
  const pad = 5;
  const points = [];
  for (let i = 0; i < 10; i++) {
    const val = currentValue + (4 - i) * 1.5;
    points.push(Math.max(threshold - 5, val));
  }
  const yMax = Math.max(...points, threshold + 20);
  const yMin = Math.min(...points, threshold - 5);
  const getX = (i) => isRtl ? w - pad - (i * (w - 2 * pad) / 9) : pad + (i * (w - 2 * pad) / 9);
  const getY = (v) => h - pad - ((v - yMin) / (yMax - yMin || 1)) * (h - 2 * pad);
  let pastD = `M ${getX(0)} ${getY(points[0])}`;
  for (let i = 1; i <= 4; i++) pastD += ` L ${getX(i)} ${getY(points[i])}`;
  let futureD = `M ${getX(4)} ${getY(points[4])}`;
  for (let i = 5; i < 10; i++) futureD += ` L ${getX(i)} ${getY(points[i])}`;
  const thresholdY = getY(threshold);
  return (
    <div className="relative w-full h-[60px] flex items-center justify-center overflow-visible">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={pad} y1={thresholdY} x2={w - pad} y2={thresholdY} stroke="#EF4444" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
        <path d={`${pastD} L ${getX(4)} ${h} L ${getX(0)} ${h} Z`} fill="url(#trendGrad)" />
        <path d={pastD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <path d={futureD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 4" opacity="0.6" />
        <circle cx={getX(4)} cy={getY(points[4])} r="3.5" fill="white" stroke={color} strokeWidth="2" />
      </svg>
    </div>
  );
}

export function SoilTrendChart({ isRtl, isEn, activeFarm, compact = false }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  
  // Fetch real data
  const { data: rawTemp } = useSensorHistory('soil_temperature', 12);
  const { data: rawMoist } = useSensorHistory('soil_moisture', 12);

  const data = useMemo(() => {
    const points = [];
    // If not enough data, pad with empty or default values
    const maxLen = Math.max(rawTemp?.length || 0, rawMoist?.length || 0);
    const len = Math.max(12, maxLen);
    
    for (let i = 0; i < len; i++) {
      const tempItem = rawTemp?.[i];
      const moistItem = rawMoist?.[i];
      
      let temp = tempItem?.value ?? 0;
      let moisture = moistItem?.value ?? 0;
      
      // Calculate an hour label: Now, -1h, -2h, etc.
      const now = new Date();
      now.setHours(now.getHours() - (len - 1 - i));
      const hours = now.getHours();
      
      let timeStr = "";
      if (isEn) {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 || 12;
        timeStr = `${h12} ${ampm}`;
      } else {
        const ampm = hours >= 12 ? 'م' : 'ص';
        const h12 = hours % 12 || 12;
        timeStr = `${h12} ${ampm}`;
      }
      
      points.push({ time: timeStr, temp, moisture });
    }
    return points;
  }, [rawTemp, rawMoist, isEn]);
  const h = compact ? 190 : 500;
  const w = compact ? 900 : 500;
  const pLeft = 35;
  const pRight = compact ? 20 : 25;
  const pTop = compact ? 8 : 100;
  const pBottom = compact ? 55 : 30;
  const segmentW = (w - pLeft - pRight) / (data.length - 1);
  
  // Fixed 0-100 Y-axis like the reference
  const yMin = 0;
  const yMax = 100;
  
  const getY = (v) => h - pBottom - ((v - yMin) / (yMax - yMin)) * (h - pTop - pBottom);
  const getX = (i) => isRtl ? w - pRight - i * segmentW : pLeft + i * segmentW;
  
  const getPath = (key) => {
    if (data.length < 2) return "";
    let d = `M ${getX(0)} ${getY(data[0][key])}`;
    for (let i = 0; i < data.length - 1; i++) {
      const x1 = getX(i);
      const y1 = getY(data[i][key]);
      const x2 = getX(i + 1);
      const y2 = getY(data[i + 1][key]);
      const midX = (x1 + x2) / 2;
      d += ` C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    }
    return d;
  };

  const getAreaPath = (key) => {
    const p = getPath(key);
    if (!p) return "";
    return `${p} L ${getX(data.length - 1)} ${h - pBottom} L ${getX(0)} ${h - pBottom} Z`;
  };

  return (
    <CardShell className={`${compact ? 'p-2' : 'p-2 md:p-4'} relative overflow-hidden group/trend bg-white border border-gray-100 shadow-sm transition-all hover:shadow-md h-full flex flex-col`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className={`flex flex-col gap-1 mb-2 px-4 pt-3 ${isRtl ? 'text-right' : 'text-left'}`}>
        <h3 className="text-lg font-black text-gray-800 tracking-tight leading-tight">
          {isEn ? "Soil Trend (12h)" : "اتجاه التربة (١٢ ساعة)"}
        </h3>
        <div className="flex items-center gap-6 mt-1" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-200" />
            <span className="text-[13px] font-bold text-gray-400 uppercase tracking-tight">{isEn ? "Moist" : "رطوبة"}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
            <span className="text-[13px] font-bold text-gray-400 uppercase tracking-tight">{isEn ? "Temp" : "حرارة"}</span>
          </div>
        </div>
      </div>
      
      <div className="w-full flex-1 relative min-h-0 pb-8 px-2">
        <div className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[12px] font-black text-[#2E7D32] opacity-60 whitespace-nowrap" style={{transformOrigin:'center', left:'-28px'}}>
          {isEn ? 'Value (%)' : 'القيمة (%)'}
        </div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[13px] font-black text-[#2E7D32] opacity-60">
          {isEn ? 'Time' : 'الوقت'}
        </div>
        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block overflow-visible" onMouseLeave={() => setHoveredIdx(null)}>
          <defs>
            <linearGradient id="soilTempGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="soilMoistGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>

          <line x1={pLeft} y1={pTop} x2={pLeft} y2={h - pBottom} stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1={pLeft} y1={h - pBottom} x2={w - pRight} y2={h - pBottom} stroke="#CBD5E1" strokeWidth="1.5" />

          {[0, 20, 40, 60, 80, 100].map(val => {
            const yy = getY(val);
            return (
              <g key={val}>
                {val !== 0 && <line x1={pLeft - 5} y1={yy} x2={w - pRight} y2={yy} stroke="#F1F5F9" strokeWidth="1" />}
                <text x={pLeft - 5} y={yy + 4} textAnchor="end" fontSize="11" fill="#94A3B8" fontWeight="bold">{val}</text>
              </g>
            );
          })}


          <path d={getAreaPath('moisture')} fill="url(#soilMoistGrad)" />
          <path d={getAreaPath('temp')} fill="url(#soilTempGrad)" />
          <path d={getPath('moisture')} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
          <path d={getPath('temp')} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />

          {data.map((d, i) => {
            const xx = getX(i);
            const isHovered = hoveredIdx === i;
            
            // Highlight the label if it's the latest data point (usually at index data.length - 1)
            const shouldHighlight = i === data.length - 1;
            
            const topY = Math.min(getY(d.temp), getY(d.moisture));
            const tW = 150;
            const tH = 90;
            const tX = Math.max(0, Math.min(w - tW, xx - tW / 2));
            const tY = Math.max(5, topY - tH - 50); 

            return (
              <g key={i}>
                <rect x={xx - segmentW / 2} y={pTop} width={segmentW} height={h - pTop - pBottom} fill="transparent" onMouseEnter={() => setHoveredIdx(i)} className="cursor-pointer" />
                
                {(i % (compact ? 3 : 2) === 0) && (
                  <g>
                    {shouldHighlight && (
                      <rect x={xx - 35} y={h - pBottom + 3} width="70" height="24" rx="8" fill="#10b981" fillOpacity="0.15" />
                    )}
                    <text 
                      x={xx} 
                      y={h - pBottom + 22} 
                      textAnchor="middle" 
                      fontSize="14" 
                      fill={shouldHighlight ? "#10b981" : "#94A3B8"} 
                      fontWeight="bold"
                    >
                      {d.time}
                    </text>
                  </g>
                )}

                {isHovered && (
                  <g pointerEvents="none" className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <foreignObject x={tX} y={tY} width={tW} height={tH + 15}>
                      <div 
                        className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-[20px] border border-white/10 shadow-2xl flex flex-col gap-2"
                        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-0.5">
                          <span className="text-[14px] font-bold text-slate-400 uppercase tracking-wider">{d.time}</span>
                          <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                        </div>
                        
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                            <span className="text-[16px] font-medium text-slate-300">{isEn ? 'Moist' : 'رطوبة'}</span>
                          </div>
                          <span className="text-[18px] font-black text-blue-400">{d.moisture.toFixed(1)}%</span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                            <span className="text-[16px] font-medium text-slate-300">{isEn ? 'Temp' : 'حرارة'}</span>
                          </div>
                          <span className="text-[18px] font-black text-emerald-400">{d.temp.toFixed(1)}°</span>
                        </div>
                      </div>
                    </foreignObject>
                    <circle cx={xx} cy={getY(d.temp)} r="5" fill="#10b981" stroke="white" strokeWidth="2" />
                    <circle cx={xx} cy={getY(d.moisture)} r="5" fill="#3b82f6" stroke="white" strokeWidth="2" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </CardShell>
  );
}


export function IrrigationActionButton({ children, active, onClick, icon, isRtl }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full p-4 rounded-2xl border transition-all duration-300 flex items-center gap-4
        ${active 
          ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-200 scale-[1.02]' 
          : 'bg-white border-gray-100 text-gray-700 hover:border-emerald-200 hover:bg-emerald-50/30'
        }
      `}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className={`
        w-10 h-10 rounded-xl flex items-center justify-center transition-colors
        ${active ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-emerald-100'}
      `}>
        {icon}
      </div>
      <div className="flex-1 text-start">
        {children}
      </div>
      {!active && (
        <svg className={`w-5 h-5 opacity-30 ${isRtl ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </button>
  );
}
