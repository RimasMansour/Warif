import React, { useState } from 'react';
import { CardShell } from './DashboardShared';
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


export function LightAreaChart({ data, range, onRangeChange, T, isRtl }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const ranges = [
    { key: 'D', label: T.day || 'اليوم' },
    { key: 'W', label: T.week || 'الأسبوع' },
    { key: 'M', label: T.month || 'الشهر' },
    { key: 'Y', label: T.year || 'السنة' },
  ];
  const n = data.length;
  const maxVal = Math.max(...data.map(d => d.value), 100);
  const currentVal = range === 'D'
    ? Math.max(...data.map(d => d.value), 0)
    : (data.reduce((a, b) => a + b.value, 0) / (n || 1));
  const W = 860, H = 360, padL = 120, padR = 80, padT = 24, padB = 82;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const points = data.map((d, i) => ({
    x: padL + (i / Math.max(n - 1, 1)) * chartW,
    y: padT + chartH - (d.value / maxVal) * chartH,
    value: d.value,
    label: d.label,
  }));
  const linePath = points.length < 2 ? '' : points.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `C ${cpx} ${prev.y} ${cpx} ${p.y} ${p.x} ${p.y}`;
  }).join(' ');
  const areaPath = linePath
    ? `${linePath} L ${points[n - 1]?.x} ${padT + chartH} L ${padL} ${padT + chartH} Z`
    : '';
  const getColor = (val) => {
    if (val === 0) return '#9ca3af';
    if (val < 1000) return '#fde68a';
    if (val < 10000) return '#f59e0b';
    if (val < 50000) return '#f97316';
    return '#ef4444';
  };
  const getLabel = (val) => {
    if (val === 0) return isRtl ? 'لا يوجد إضاءة' : 'No light';
    if (val < 200) return isRtl ? 'خافتة جداً' : 'Very dim';
    if (val < 1000) return isRtl ? 'إضاءة داخلية' : 'Indoor';
    if (val < 10000) return isRtl ? 'مضيئة' : 'Bright';
    if (val < 50000) return isRtl ? 'مشرقة جداً' : 'Very bright';
    return isRtl ? 'ضوء شمس مباشر' : 'Direct sunlight';
  };
  const lineColor = getColor(currentVal);
  return (
    <CardShell className="p-5" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center mb-4">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-black text-gray-800 leading-none">
              {T.lightChart || 'مسار شدة الإضاءة'}
            </h2>
            <span className="bg-amber-50 text-amber-600 text-xs px-2 py-0.5 rounded-lg border border-amber-100 font-black uppercase tracking-tighter">
              {T.realtimeAnalysis || 'تحليل فوري'}
            </span>
          </div>
          <div className="text-[13px] font-bold text-gray-400">{getLabel(currentVal)}</div>
        </div>
        <div className="flex flex-col items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm min-w-[110px]">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-gray-800">{Math.round(currentVal).toLocaleString()}</span>
            <span className="text-[11px] font-bold text-gray-400">Lux</span>
          </div>
          <div className="text-[10px] font-black mt-1 uppercase tracking-tighter" style={{ color: lineColor }}>
            {T.periodAverage || 'متوسط الفترة'}
          </div>
        </div>
      </div>
      <div className="flex bg-gray-50 p-1 rounded-xl mb-4 gap-1 w-max mx-auto border border-gray-100 shadow-inner">
        {ranges.map(r => (
          <button key={r.key} onClick={() => onRangeChange(r.key)}
            className={`px-5 py-2 text-xs font-black rounded-lg transition-all duration-300 ${range === r.key ? 'bg-white text-gray-800 shadow-md scale-[1.02]' : 'text-gray-400 hover:text-gray-600'}`}>
            {r.label}
          </button>
        ))}
      </div>
      <div className="w-full max-w-[800px] mx-auto" style={{ maxHeight: '360px' }} onMouseLeave={() => setHoveredIdx(null)}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="block w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="lightAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.3"/>
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.02"/>
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const val = maxVal * ratio;
            const y = padT + chartH - ratio * chartH;
            return (
              <g key={i}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4"/>
                <text x={padL - 45} y={y} dominantBaseline="central" textAnchor="end" fontSize="16" fill="#94a3b8" fontWeight="bold">
                  {val >= 100000
                    ? `${(val / 1000).toFixed(0)}k`
                    : val >= 1000
                    ? `${(val / 1000).toFixed(1)}k`
                    : Math.round(val)}
                </text>
              </g>
            );
          })}
          <text x={40} y={padT + chartH / 2} transform={`rotate(-90, 40, ${padT + chartH / 2})`} textAnchor="middle" fontSize="18" fill="#059669" fontWeight="900" opacity="0.6">
            {isRtl ? 'لوكس' : 'Lux'}
          </text>
          {areaPath && <path d={areaPath} fill="url(#lightAreaGrad)"/>}
          {linePath && <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
          {points.map((p, i) => {
            const show = i % Math.max(1, Math.floor(n / 8)) === 0;
            const isHov = hoveredIdx === i;
            return (
              <g key={i} onMouseEnter={() => setHoveredIdx(i)}>
                <rect x={p.x - 10} y={padT} width={20} height={chartH} fill="transparent" className="cursor-pointer"/>
                {(show || isHov) && (
                  <circle cx={p.x} cy={p.y} r={isHov ? 6 : 3} fill={isHov ? lineColor : '#fff'} stroke={lineColor} strokeWidth="2" className="transition-all duration-200"/>
                )}
                {isHov && (
                  <g pointerEvents="none">
                    <line x1={p.x} y1={padT} x2={p.x} y2={padT + chartH} stroke={lineColor} strokeWidth="1" strokeDasharray="4 3" opacity="0.5"/>
                    <rect x={p.x - 52} y={p.y - 54} width={104} height={38} rx="10" fill="#111827" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.25))"/>
                    <text x={p.x} y={p.y - 30} textAnchor="middle" fontSize="11" fontWeight="900" fill="white">
                      {Math.round(p.value).toLocaleString()} Lux
                    </text>
                    <path d={`M ${p.x - 6} ${p.y - 16} L ${p.x} ${p.y - 8} L ${p.x + 6} ${p.y - 16} Z`} fill="#111827"/>
                  </g>
                )}
              </g>
            );
          })}
          {points.map((p, i) => {
            const show = i % Math.max(1, Math.floor(n / 6)) === 0;
            return show ? (
              <text key={i} x={p.x} y={H - padB + 34} textAnchor="middle" fontSize="14" fill="#94a3b8" fontWeight="bold">
                {p.label}
              </text>
            ) : null;
          })}
          <text x={padL + chartW / 2} y={H - 10} textAnchor="middle" fontSize="18" fill="#059669" fontWeight="900" opacity="0.6">
            {isRtl ? 'الوقت' : 'Time'}
          </text>
          <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#e2e8f0" strokeWidth="2"/>
          <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#e2e8f0" strokeWidth="2"/>
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
