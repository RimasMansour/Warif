import React, { useState, useMemo } from 'react';
import { CardShell } from './DashboardShared';

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
  const pLeft = 85; 
  const pRight = 45;
  const padTop = 15; 
  const padBottom = 35; 
  
  const n = data.length;
  const w = 1000; 
  
  const gapBetweenGroups = 8;
  const barW = Math.min(22, (w - pLeft - pRight - n * gapBetweenGroups) / (n * 2));

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
          viewBox="-80 0 1080 330"
          preserveAspectRatio="xMidYMid meet"
          className="block overflow-visible" 
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <text x={- (h-padBottom)/2 - padTop + 10} y={5} transform="rotate(-90)" textAnchor="middle" fontSize="24" fontWeight="1000" fill="#2E7D32" opacity="0.6">
            {yAxisTitle || T.consumptionRate}
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
            const groupX = pLeft + i * (barW * 2 + 4 + gapBetweenGroups) + gapBetweenGroups / 2;
            const yy = yPos(d.value);
            const hh = barH(d.value);
            
            let showLabel = false;
            let labelText = d.label;
            if (range === 'D' && [0,6,12,18].includes(i)) {
                showLabel = true;
                labelText = i === 0 ? `12am` : i === 6 ? `6am` : i === 12 ? `12pm` : `6pm`;
            } else if (range === 'W') showLabel = true;
            else if (range === 'M' && i % 4 === 0) showLabel = true;
            else if (range === 'Y' && i % 3 === 0) showLabel = true;

            return (
              <g key={i} className="cursor-pointer">
                <rect 
                   x={groupX} y={yy} width={barW * 2} height={hh} rx="4" fill={color} 
                   onMouseEnter={() => setHoveredIdx(i)}
                   opacity={hoveredIdx === i ? 1 : hoveredIdx === null ? 1 : 0.3}
                />
                {showLabel && (
                  <text x={groupX + barW} y={h-padBottom+32} textAnchor="middle" fontSize="22" fill="#94A3B8" fontWeight="black">{labelText}</text>
                )}
              </g>
            );
          })}
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

  const h = 240; 
  const pLeft = 85; 
  const pRight = 45;
  const pTop = 20; 
  const pBottom = 20; 
  
  const n = data.length;
  const w = 1000; 
  const segmentW = (w - pLeft - pRight) / (n - 1 || 1);

  const allValues = data.flatMap(d => [d.water || 0, d.power || 0]);
  const yMax = Math.ceil(Math.max(...allValues, 10) / 10) * 10 + 10; 
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
    <CardShell className="p-6 relative group/chart overflow-visible" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center mb-6 flex-row">
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
            <span className="text-[12px] font-bold text-gray-400 font-black">٪</span>
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

      <div className="flex items-center justify-center gap-6 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[var(--status-info)] shadow-sm shadow-blue-200" />
          <span className="text-[12px] font-black text-gray-600">{T?.waterLabel || 'Water'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[var(--status-warning)] shadow-sm shadow-yellow-200" />
          <span className="text-[12px] font-black text-gray-600">{T?.powerLabel || 'Power'}</span>
        </div>
      </div>

      <div className="w-full h-full relative min-h-[180px] mt-2">
        <svg width="100%" height={205} viewBox="-80 0 1100 340" preserveAspectRatio="xMidYMid meet" className="block overflow-visible" onMouseLeave={() => setHoveredIdx(null)}>
          <defs>
            <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EAB308" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#EAB308" stopOpacity="0" />
            </linearGradient>
          </defs>
          <text x={- (h-pBottom)/2 - pTop + 10} y={5} transform="rotate(-90)" textAnchor="middle" fontSize="24" fontWeight="1000" fill="#2E7D32" opacity="0.5">
            {yAxisTitle || T.consumptionRate}
          </text>
          
          <line x1={pLeft} y1={pTop} x2={pLeft} y2={h - pBottom} stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
          <line x1={pLeft} y1={h - pBottom} x2={w - pRight} y2={h - pBottom} stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />

          {[0, 0.25, 0.5, 0.75, 1].map(i => {
              const v = yMax * i;
              const yy = getY(v);
              return (
                <g key={i}>
                <line x1={pLeft} x2={w-pRight} y1={yy} y2={yy} stroke="#F1F5F9" strokeWidth="1.5" strokeDasharray="6 6" />
                <text x={pLeft - 30} y={yy} dominantBaseline="central" textAnchor="end" fontSize="22" fontWeight="black" fill="#94A3B8">
                  {Math.round(v)}
                </text>
              </g>
              );
          })}

          <path d={getAreaPath('water')} fill="url(#waterGrad)" />
          <path d={getAreaPath('power')} fill="url(#powerGrad)" />
          <path d={getPath('water')} fill="none" stroke="var(--status-info)" strokeWidth="4.5" strokeLinecap="round" />
          <path d={getPath('power')} fill="none" stroke="var(--status-warning)" strokeWidth="4.5" strokeLinecap="round" />

          {data.map((d, i) => {
            const xx = getX(i);
            const isHovered = hoveredIdx === i;
            
            let showLabel = false;
            let labelText = d.label;
            if (range === 'D' && [0,6,12,18, 23].includes(i)) {
                showLabel = true;
                labelText = i === 0 ? `12${T.am}` : i === 6 ? `6${T.am}` : i === 12 ? `12${T.pm}` : i === 18 ? `6${T.pm}` : `11${T.pm}`;
            } else if (range === 'W') showLabel = true;
            else if (range === 'M' && i % 4 === 0) showLabel = true;
            else if (range === 'Y' && i % 2 === 0) showLabel = true;

            return (
              <g key={i}>
                <rect x={xx - segmentW/2} y={pTop} width={segmentW} height={h-pTop-pBottom} fill="transparent" onMouseEnter={() => setHoveredIdx(i)} className="cursor-pointer" />
                {showLabel && (
                  <text x={xx} y={h - pBottom + 40} textAnchor="middle" fontSize="22" fill="#94A3B8" fontWeight="black">{labelText}</text>
                )}
                {isHovered && (
                  <g pointerEvents="none">
                    <line x1={xx} y1={pTop} x2={xx} y2={h-pBottom} stroke="#E2E8F0" strokeWidth="2" strokeDasharray="4 4" />
                    <circle cx={xx} cy={getY(d.water)} r="7" fill="#059669" stroke="white" strokeWidth="3" />
                    <circle cx={xx} cy={getY(d.power)} r="7" fill="#34d399" stroke="white" strokeWidth="3" />
                    <rect x={xx - 75} y={Math.min(getY(d.water), getY(d.power)) - 95} width="150" height="75" rx="16" fill="#111827" filter="drop-shadow(0 10px 20px rgba(0,0,0,0.5))" />
                    <text x={xx} y={Math.min(getY(d.water), getY(d.power)) - 65} textAnchor="middle" fontSize="22" fontWeight="black" fill="white">
                      {T.waterLabel}: {(d.water).toFixed(1)}٪
                    </text>
                    <text x={xx} y={Math.min(getY(d.water), getY(d.power)) - 35} textAnchor="middle" fontSize="22" fontWeight="black" fill="#EAB308">
                      {T.powerLabel}: {(d.power).toFixed(1)}٪
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          <text x={pLeft + (w - pLeft - pRight)/2} y={h+90} textAnchor="middle" fontSize="26" fontWeight="1000" fill="#2E7D32" opacity="0.5">{xAxisTitle || T.periodLabel}</text>
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
  const data = useMemo(() => {
    const points = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const h = new Date(now);
      h.setHours(now.getHours() - i);
      const timeStr = `${h.getHours()}:00`;
      const seed = (activeFarm || 1) * 10;
      const temp = 22 + Math.sin((i + seed) * 0.5) * 3 + Math.random() * 1;
      const moisture = 65 + Math.cos((i + seed) * 0.3) * 10 + Math.random() * 2;
      points.push({ time: timeStr, temp, moisture });
    }
    return points;
  }, [activeFarm]);
  const h = compact ? 200 : 260;
  const w = compact ? 400 : 1000;
  const pLeft = compact ? 35 : 60;
  const pRight = compact ? 20 : 60;
  const pTop = compact ? 20 : 30;
  const pBottom = compact ? 35 : 40;
  const segmentW = (w - pLeft - pRight) / (data.length - 1);
  const getY = (v, max = 100) => h - pBottom - (v / max) * (h - pTop - pBottom);
  const getX = (i) => isRtl ? w - pRight - i * segmentW : pLeft + i * segmentW;
  const getPath = (key, max) => {
    if (data.length < 2) return "";
    let d = `M ${getX(0)} ${getY(data[0][key], max)}`;
    for (let i = 0; i < data.length - 1; i++) {
      const x1 = getX(i);
      const y1 = getY(data[i][key], max);
      const x2 = getX(i + 1);
      const y2 = getY(data[i + 1][key], max);
      const midX = (x1 + x2) / 2;
      d += ` C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    }
    return d;
  };
  const getAreaPath = (key, max) => {
    const p = getPath(key, max);
    if (!p) return "";
    return `${p} L ${getX(data.length - 1)} ${h - pBottom} L ${getX(0)} ${h - pBottom} Z`;
  };
  return (
    <CardShell className={`${compact ? 'p-5' : 'p-6 md:p-8'} relative overflow-hidden group/trend bg-white/80 backdrop-blur-md border border-gray-100 shadow-sm transition-all hover:shadow-md`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex justify-center items-center gap-6 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-200" />
          <span className="text-[13px] font-black text-gray-500">{isEn ? "Moisture" : "المياه"}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
          <span className="text-[13px] font-black text-gray-500">{isEn ? "Temp" : "الحرارة"}</span>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 mb-4">
        <h3 className={`${compact ? 'text-[14px]' : 'text-xl'} font-black text-gray-800 tracking-tight`}>
          {isEn ? "Soil Trend (12h)" : "اتجاه التربة (١٢ ساعة)"}
        </h3>
      </div>
      <div className={`w-full relative ${compact ? 'h-[200px]' : 'h-[260px]'}`}>
        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible" onMouseLeave={() => setHoveredIdx(null)}>
          <defs>
            <linearGradient id="soilTempGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="soilMoistGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line x1={pLeft} y1={getY(v)} x2={w - pRight} y2={getY(v)} stroke="#F1F5F9" strokeWidth="1" strokeDasharray={v === 0 ? "0" : "5 5"} />
              <text x={pLeft - 18} y={getY(v)} dominantBaseline="middle" textAnchor="end" fontSize="11" fill="#94A3B8" fontWeight="bold">{v}</text>
            </g>
          ))}
          <line x1={pLeft} y1={pTop} x2={pLeft} y2={h - pBottom} stroke="#E2E8F0" strokeWidth="1.5" />
          <line x1={pLeft} y1={h - pBottom} x2={w - pRight} y2={h - pBottom} stroke="#E2E8F0" strokeWidth="1.5" />
          <path d={getAreaPath('moisture', 100)} fill="url(#soilMoistGrad)" />
          <path d={getAreaPath('temp', 100)} fill="url(#soilTempGrad)" />
          <path d={getPath('moisture', 100)} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
          <path d={getPath('temp', 100)} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
          {data.map((d, i) => {
            const xx = getX(i);
            const isHovered = hoveredIdx === i;
            const topY = Math.min(getY(d.temp, 100), getY(d.moisture, 100));
            const tooltipY = Math.max(10, topY - 85); 
            return (
              <g key={i}>
                <rect x={xx - segmentW / 2} y={pTop} width={segmentW} height={h - pTop - pBottom} fill="transparent" onMouseEnter={() => setHoveredIdx(i)} className="cursor-pointer" />
                {(i % (compact ? 3 : 2) === 0) && (
                  <text x={xx} y={h - pBottom + 25} textAnchor="middle" fontSize="11" fill="#94A3B8" fontWeight="bold">{d.time}</text>
                )}
                {isHovered && (
                  <g pointerEvents="none">
                    <line x1={xx} y1={pTop} x2={xx} y2={h - pBottom} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
                    <rect x={xx - 75} y={tooltipY} width="150" height="75" rx="14" fill="#111827" filter="drop-shadow(0 10px 25px rgba(0,0,0,0.4))" />
                    <text x={xx} y={tooltipY + 18} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#94A3B8">{d.time}</text>
                    <text x={xx} y={tooltipY + 40} textAnchor="middle" fontSize="13" fontWeight="black" fill="#fff">{isEn ? `Moisture: ${d.moisture.toFixed(1)}%` : `المياه: ${d.moisture.toFixed(1)}%`}</text>
                    <text x={xx} y={tooltipY + 60} textAnchor="middle" fontSize="13" fontWeight="black" fill="#10b981">{isEn ? `Temp: ${d.temp.toFixed(1)}°` : `الحرارة: ${d.temp.toFixed(1)}°`}</text>
                    <circle cx={xx} cy={getY(d.temp, 100)} r="5" fill="#10b981" stroke="white" strokeWidth="2.5" />
                    <circle cx={xx} cy={getY(d.moisture, 100)} r="5" fill="#3b82f6" stroke="white" strokeWidth="2.5" />
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
