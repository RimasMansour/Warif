import { useState, useMemo } from 'react';
import { CardShell, TempSunIcon, AirHumidityIcon, SoilDropIcon } from './dashboardShared';

/* =========================================================
   WARIF | BILINGUAL & SYMMETRIC CHARTS MODULE
   - Fully localized axis, periods, and tooltips
   - RTL/LTR layout awareness
   ========================================================= */

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

export function Donut({ value }) {
  const v = Math.max(0, Math.min(100, value));
  const size = 70;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isRtl = lang === 'ar';
  const c = 2 * Math.PI * r;
  const off = c - (v / 100) * c;

  const getColor = (val) => {
    if (val >= 80) return "var(--status-success)"; 
    if (val >= 50) return "var(--status-warning)"; 
    return "var(--status-error)"; 
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
      <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontSize="15" fill="#111827" fontWeight="900">
        {v}{isRtl ? '٪' : '%'}
      </text>
    </svg>
  );
}

export function IrrigationActionButton({ children, active, onClick, icon, isRtl }) {
  return (
    <button
      type="button"
      onClick={onClick}
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`w-full px-5 py-4 rounded-2xl border text-sm transition-all duration-300 flex items-center justify-between group
                 ${active
                   ? "bg-gradient-to-l from-[#2E7D32] to-[#388E3C] text-white border-[#2E7D32] shadow-lg shadow-green-900/20 scale-[0.98]"
                   : "bg-white text-gray-700 border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 hover:shadow-md"
                 }`}
    >
      <span className="font-bold tracking-tight">{children}</span>
      {icon && (
        <div className={`p-2 rounded-xl transition-all duration-300 ${active ? 'bg-white/20 text-white' : 'bg-emerald-50 text-[#2E7D32] group-hover:bg-emerald-100'}`}>
          {icon}
        </div>
      )}
    </button>
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

/* ----------------------------- HEALTH STYLE BAR CHART ----------------------------- */

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
  const padBottom = 15; 
  
  const n = data.length;
  const w = 1000; 
  const barW = Math.min(45, (w - 85) / (n * 1.5));
  const gap = (w - 85 - n * barW) / n;

  const ys = data.map(d => d.value);
  const yMax = Math.ceil(Math.max(...ys, 5) / 10) * 10 + 10; 
  const yPos = (v) => h - padBottom - (v / (yMax || 1)) * (h - padTop - padBottom);
  const barH = (v) => Math.max(2, (h - padBottom) - yPos(v));



  return (
    <CardShell className="p-5 relative group/chart" dir={isRtl ? 'rtl' : 'ltr'}>
      
      <div className="flex justify-between items-center mb-6 flex-row">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-black text-gray-800 leading-none order-1">
              {metricName}
            </h2>
            <span className="bg-emerald-50 text-emerald-600 text-[10px] px-2 py-0.5 rounded-lg border border-emerald-100/50 font-black uppercase tracking-tighter order-2">
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
          <div className="text-[11px] font-black text-emerald-600 mt-1 uppercase tracking-tighter">{T.periodAverage}</div>
        </div>
      </div>

      <div className="flex bg-gray-50 p-1 rounded-xl mb-0 gap-1 w-max mx-auto border border-gray-100">
        {ranges.map(r => (
          <button
            key={r.key}
            onClick={() => onRangeChange(r.key)}
            className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all duration-300 ${
              range === r.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
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
          <text 
            x={- (h-padBottom)/2 - padTop + 10} 
            y={5} 
            transform="rotate(-90)" 
            textAnchor="middle" 
            fontSize="24" 
            fontWeight="1000" 
            fill="#2E7D32" 
            opacity="0.75"
          >
            {yAxisTitle || T.valueLabel}
          </text>

          <line x1={pLeft} y1={padTop} x2={pLeft} y2={h - padBottom} stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
          <line x1={pLeft} y1={h - padBottom} x2={w - pRight} y2={h - padBottom} stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
          
          {[0, 0.25, 0.5, 0.75, 1].map(i => {
              const v = yMax * i;
              const yy = yPos(v);
              return (
                <g key={i}>
                  <line x1={pLeft} x2={w-pRight} y1={yy} y2={yy} stroke="#F8FAFC" strokeWidth="1" strokeDasharray="4 4" />
                  <text 
                    x={pLeft - 30} 
                    y={yy} 
                    dominantBaseline="central"
                    textAnchor="end" 
                    fontSize="22" 
                    fontWeight="black" 
                    fill="#94A3B8"
                  >
                    {Math.round(v)}
                  </text>
                </g>
              );
          })}

          {data.map((d, i) => {
            const index = isRtl ? i : i; 
            const xx = pLeft + index * (barW + gap) + gap / 2;
            const yy = yPos(d.value);
            const hh = barH(d.value);
            const isHovered = hoveredIdx === i;
            
            let showLabel = false;
            let labelText = d.label;
            if (range === 'D' && [0,6,12,18].includes(i)) {
                showLabel = true;
                labelText = i === 0 ? `12${T.am}` : i === 6 ? `6${T.am}` : i === 12 ? `12${T.pm}` : `6${T.pm}`;
            } else if (range === 'W') showLabel = true;
            else if (range === 'M' && i % 7 === 0) showLabel = true;
            else if (range === 'Y' && i % 3 === 0) showLabel = true;

            return (
              <g key={i} onMouseEnter={() => setHoveredIdx(i)} className="cursor-pointer">
                <rect x={xx - gap/2} y={padTop} width={barW + gap} height={h - padTop - padBottom} fill="transparent" />
                <rect x={xx} y={yy} width={barW} height={hh} fill={color} rx="6" opacity={hoveredIdx !== null && !isHovered ? 0.3 : 1} className="transition-all duration-300 origin-bottom" />
                
                {showLabel && (
                  <text x={xx + barW / 2} y={h-padBottom+32} textAnchor="middle" fontSize="22" fill="#94A3B8" fontWeight="black">{labelText}</text>
                )}

                {isHovered && (
                  <g pointerEvents="none">
                    <rect x={xx + barW/2 - 40} y={yy - 55} width="80" height="42" rx="10" fill="#111827" filter="drop-shadow(0 6px 12px rgba(0,0,0,0.4))" />
                    <text x={xx + barW/2} y={yy - 27} textAnchor="middle" fontSize="24" fontWeight="1000" fill="white">{d.value}</text>
                  </g>
                )}
              </g>
            );
          })}
          <text x={pLeft + (w - pLeft - pRight)/2} y={h+70} textAnchor="middle" fontSize="26" fontWeight="1000" fill="#2E7D32" opacity="0.75">{xAxisTitle || T.timeLabel}</text>
        </svg>
      </div>
    </CardShell>
  );
}

/* ----------------------------- DUAL RESOURCE BAR CHART ----------------------------- */

export function DualResourceBarChart({ 
  range, 
  onRangeChange, 
  data, 
  metricName,
  xAxisTitle,
  yAxisTitle,
  T,
  isRtl
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [hoveredMetric, setHoveredMetric] = useState(null);
  
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
  const padBottom = 15; 
  
  const n = data.length;
  const w = 1000; 
  const barW = Math.min(20, (w - 85) / (n * 2.5));
  const gapBetweenGroups = (w - 85 - n * (barW * 2 + 4)) / n;

  const allValues = data.flatMap(d => [d.water || 0, d.power || 0]);
  const yMax = Math.ceil(Math.max(...allValues, 10) / 10) * 10 + 10; 
  const yPos = (v) => h - padBottom - (v / (yMax || 1)) * (h - padTop - padBottom);
  const barH = (v) => Math.max(2, (h - padBottom) - yPos(v));

  return (
    <CardShell className="p-5 relative group/chart" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center mb-6 flex-row">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-black text-gray-800 leading-none order-1">
              {metricName || T.unifiedConsumption}
            </h2>
            <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-lg border border-blue-100/50 font-black uppercase tracking-tighter order-2">
              {isRtl ? 'موارد مدمجة' : 'Unified'}
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
          <div className="text-[11px] font-black text-emerald-600 mt-1 uppercase tracking-tighter">{T.periodAverage}</div>
        </div>
      </div>

      <div className="flex bg-gray-50 p-1 rounded-xl mb-0 gap-1 w-max mx-auto border border-gray-100">
        {ranges.map(r => (
          <button
            key={r.key}
            onClick={() => onRangeChange(r.key)}
            className={`px-4 py-1.5 text-[11px] font-black rounded-lg transition-all duration-300 ${
              range === r.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
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
          onMouseLeave={() => { setHoveredIdx(null); setHoveredMetric(null); }}
        >
          <text 
            x={- (h-padBottom)/2 - padTop + 10} 
            y={5} 
            transform="rotate(-90)" 
            textAnchor="middle" 
            fontSize="24" 
            fontWeight="1000" 
            fill="#2E7D32" 
            opacity="0.6"
          >
            {yAxisTitle || T.consumptionRate}
          </text>

          <line x1={isRtl ? w - pRight : pLeft} y1={padTop} x2={isRtl ? w - pRight : pLeft} y2={h - padBottom} stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
          <line x1={pLeft} y1={h - padBottom} x2={w - pRight} y2={h - padBottom} stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
          
          {[0, 0.25, 0.5, 0.75, 1].map(i => {
              const v = yMax * i;
              const yy = yPos(v);
              return (
                <g key={i}>
                <line x1={pLeft} x2={w-pRight} y1={yy} y2={yy} stroke="#F8FAFC" strokeWidth="1" strokeDasharray="4 4" />
                <text 
                  x={pLeft - 30} 
                  y={yy} 
                  dominantBaseline="central"
                  textAnchor="end" 
                  fontSize="22" 
                  fontWeight="black" 
                  fill="#94A3B8"
                >
                  {Math.round(v)}
                </text>
              </g>
              );
          })}

          {data.map((d, i) => {
            const groupX = pLeft + i * (barW * 2 + 4 + gapBetweenGroups) + gapBetweenGroups / 2;
            const yyWater = yPos(d.water);
            const hhWater = barH(d.water);
            const yyPower = yPos(d.power);
            const hhPower = barH(d.power);
            
            let showLabel = false;
            let labelText = d.label;
            if (range === 'D' && [0,6,12,18].includes(i)) {
                showLabel = true;
                labelText = i === 0 ? `12${T.am}` : i === 6 ? `6${T.am}` : i === 12 ? `12${T.pm}` : `6${T.pm}`;
            } else if (range === 'W') showLabel = true;
            else if (range === 'M' && i % 4 === 0) showLabel = true;
            else if (range === 'Y' && i % 3 === 0) showLabel = true;

            return (
              <g key={i} className="cursor-pointer">
                <rect 
                   x={groupX} y={yyWater} width={barW} height={hhWater} rx="4" fill="var(--status-info)" 
                   onMouseEnter={() => { setHoveredIdx(i); setHoveredMetric('water'); }}
                   opacity={hoveredIdx === i && hoveredMetric === 'water' ? 1 : hoveredIdx === null ? 1 : 0.3}
                />
                <rect 
                   x={groupX + barW + 4} y={yyPower} width={barW} height={hhPower} rx="4" fill="var(--status-warning)" 
                   onMouseEnter={() => { setHoveredIdx(i); setHoveredMetric('power'); }}
                   opacity={hoveredIdx === i && hoveredMetric === 'power' ? 1 : hoveredIdx === null ? 1 : 0.3}
                />
                
                {showLabel && (
                  <text x={groupX + barW + 2} y={h-padBottom+32} textAnchor="middle" fontSize="22" fill="#94A3B8" fontWeight="black">{labelText}</text>
                )}

                {hoveredIdx === i && (
                  <g pointerEvents="none">
                    <rect x={groupX - 30} y={Math.min(yyWater, yyPower) - 60} width="110" height="48" rx="12" fill="#111827" filter="drop-shadow(0 8px 16px rgba(0,0,0,0.4))" />
                    <text x={groupX + barW + 2} y={Math.min(yyWater, yyPower) - 28} textAnchor="middle" fontSize="22" fontWeight="1000" fill="white">
                      {hoveredMetric === 'water' ? `${T.waterLabel}: ${(d.water).toFixed(1)}` : `${T.powerLabel}: ${(d.power).toFixed(1)}`}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          <text x={pLeft + (w - pLeft - pRight)/2} y={h+70} textAnchor="middle" fontSize="26" fontWeight="1000" fill="#2E7D32" opacity="0.6">{xAxisTitle || T.periodLabel}</text>
        </svg>
      </div>
    </CardShell>
  );
}

/* ----------------------------- SUSTAINABILITY LINE CHART ----------------------------- */

export function SustainabilityLineChart({ 
  range, 
  onRangeChange, 
  data, 
  metricName,
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
            <h2 className="text-lg font-black text-gray-800 leading-none order-1">
              {metricName || T.unifiedConsumption}
            </h2>
            <span className="bg-emerald-50 text-emerald-600 text-[10px] px-2.5 py-1 rounded-lg border border-emerald-100 font-black tracking-tight uppercase order-2">
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
          <div className="text-[11px] font-black text-emerald-600 mt-1 uppercase tracking-tighter">{T.periodAverage}</div>
        </div>
      </div>

      <div className="flex bg-gray-50/80 p-1 rounded-xl mb-4 gap-1 w-max mx-auto border border-gray-100 shadow-inner">
        {ranges.map(r => (
          <button
            key={r.key}
            onClick={() => onRangeChange(r.key)}
            className={`px-5 py-2 text-[11px] font-black rounded-lg transition-all duration-300 ${
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
        <svg 
          width="100%" 
          height={205} 
          viewBox="-80 0 1100 340"
          preserveAspectRatio="xMidYMid meet"
          className="block overflow-visible" 
          onMouseLeave={() => setHoveredIdx(null)}
        >
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
          <text 
            x={- (h-pBottom)/2 - pTop + 10} 
            y={5} 
            transform="rotate(-90)" 
            textAnchor="middle" 
            fontSize="24" 
            fontWeight="1000" 
            fill="#2E7D32" 
            opacity="0.5"
          >
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
                <text 
                  x={pLeft - 30} 
                  y={yy} 
                  dominantBaseline="central"
                  textAnchor="end" 
                  fontSize="22" 
                  fontWeight="black" 
                  fill="#94A3B8"
                >
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

// ----------------------------- TREND SPARKLINE (PREDICTIVE) -----------------------------

export function TrendSparkline({ currentValue, threshold = 30, color = "#3B82F6", isRtl = false }) {
  const h = 60;
  const w = 150;
  const pad = 5;
  
  // Simulate 10 points: 4 past, 1 current, 5 future
  const points = [];
  for (let i = 0; i < 10; i++) {
    const val = currentValue + (4 - i) * 1.5;
    points.push(Math.max(threshold - 5, val));
  }

  const yMax = Math.max(...points, threshold + 20);
  const yMin = Math.min(...points, threshold - 5);
  
  const getX = (i) => isRtl ? w - pad - (i * (w - 2 * pad) / 9) : pad + (i * (w - 2 * pad) / 9);
  const getY = (v) => h - pad - ((v - yMin) / (yMax - yMin || 1)) * (h - 2 * pad);

  // Path for past (solid)
  let pastD = `M ${getX(0)} ${getY(points[0])}`;
  for (let i = 1; i <= 4; i++) pastD += ` L ${getX(i)} ${getY(points[i])}`;

  // Path for future (dashed)
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

        {/* Threshold Line */}
        <line x1={pad} y1={thresholdY} x2={w - pad} y2={thresholdY} stroke="#EF4444" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
        
        {/* Past Area */}
        <path 
           d={`${pastD} L ${getX(4)} ${h} L ${getX(0)} ${h} Z`} 
           fill="url(#trendGrad)" 
        />
        
        {/* Past Line (Solid) */}
        <path d={pastD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        
        {/* Future Line (Dashed) */}
        <path d={futureD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 4" opacity="0.6" />
        
        {/* Current Point Dot */}
        <circle cx={getX(4)} cy={getY(points[4])} r="3.5" fill="white" stroke={color} strokeWidth="2" />
      </svg>
    </div>
  );
}



