function irrigationClamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function irrigationDaysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function generateIrrigationUsageSeries({
  days,
  base,
  amp,
  noise,
  min,
  max,
  seed = 7,
  farmIndex = 0
}) {
  let s = seed + (farmIndex * 100);
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const out = [];
  for (let d = 1; d <= days; d++) {
    const wave = Math.sin((d / 7) * Math.PI * 0.9) * amp;
    const jitter = (rnd() - 0.5) * noise;
    const v = irrigationClamp(base + wave + jitter, min, max);
    out.push({ day: d, value: Number(v.toFixed(1)) });
  }
  return out;
}

// Helper for bilingual labels
const L = (isEn) => ({
  usageLow: isEn ? "Low Usage" : "استخدام منخفض",
  usageMed: isEn ? "Medium Usage" : "استخدام متوسط",
  usageHigh: isEn ? "High Usage" : "استخدام مرتفع",
  usageLegend: isEn ? "Colors represent irrigation usage levels." : "الألوان تعبّر عن مستوى استخدام الري.",
  now: isEn ? "Now" : "الآن",
  agoSec: (s) => isEn ? `${s} seconds ago` : `منذ ${s} ثانية`,
  agoMin: (m) => {
    if (!isEn) {
      if (m === 1) return "منذ دقيقة";
      if (m === 2) return "منذ دقيقتين";
      if (m <= 10) return `منذ ${m} دقائق`;
      return `منذ ${m} دقيقة`;
    }
    return m === 1 ? "1 min ago" : `${m} mins ago`;
  },
  daysAr: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  daysEn: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  monthsAr: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  monthsEn: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
});

export function formatLastUpdated(seconds, prefixAr = "آخر تحديث", prefixEn = "Last Update") {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const labels = L(isEn);
  const prefix = isEn ? prefixEn : prefixAr;

  if (seconds < 10) return `${prefix}: ${labels.now}`;
  if (seconds < 60) return `${prefix}: ${labels.agoSec(seconds)}`;
  const mins = Math.floor(seconds / 60);
  return `${prefix}: ${labels.agoMin(mins)}`;
}

export function generateDataForRange(range, { base, amp, noise, min, max, seed, farmIndex = 0 }) {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const labels = L(isEn);

  let s = (seed || 7) + (farmIndex * 100);
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const now = new Date();
  const currentMonth = now.getMonth(); 
  const currentDay = now.getDate();
  const currentHour = now.getHours();

  const getPoints = () => {
    switch (range) {
      case 'D': return 24;   
      case 'W': return 7;    
      case 'M': return 30;   
      case '6M': return 6;   
      case 'Y': return 12;   
      default: return 30;
    }
  };

  const points = getPoints();
  const out = [];
  for (let i = 0; i < points; i++) {
    let isFuture = false;
    if (range === 'Y' && i > currentMonth) isFuture = true;
    if (range === 'M' && i + 1 > currentDay) isFuture = true;
    if (range === 'D' && i > currentHour) isFuture = true;
    if (range === 'W' && i > 3) isFuture = false; 

    if (isFuture) continue;

    const wave = Math.sin((i / (points/4)) * Math.PI) * amp;
    const jitter = (rnd() - 0.5) * noise;
    const v = Math.max(min, Math.min(max, base + wave + jitter));
    
    let label = '';
    if (range === 'D') label = `${i}:00`;
    else if (range === 'W') label = isEn ? labels.daysEn[i % 7] : labels.daysAr[i % 7];
    else if (range === 'M') label = `${i + 1}`;
    else if (range === '6M' || range === 'Y') label = isEn ? labels.monthsEn[i % 12] : labels.monthsAr[i % 12];

    out.push({ label, value: Number(v.toFixed(1)) });
  }
  return out;
}

export function sensorBuildRecommendationsTemperature(current) {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const rec = [];
  
  if (current >= 35) {
    rec.push({
      text: isEn ? "High temperature: cooling activation recommended." : "درجة الحرارة مرتفعة: يوصى بتفعيل المكيفات وتقليل التعرض المباشر للشمس.",
      reasoning: isEn ? "Temp exceeded 35°C, which may cause plant stomata to close and halt growth." : "تجاوزت الحرارة حاجز 35 درجة مئوية، وهو ما قد يؤدي لإغلاق ثغور النبات وتوقف النمو."
    });
    rec.push({
      text: isEn ? "Monitor humidity to avoid heat stress." : "راقب الرطوبة بالتزامن لتفادي الإجهاد الحراري.",
      reasoning: isEn ? "High heat with low humidity increases excessive leaf transpiration." : "ارتفاع الحرارة مع انخفاض الرطوبة يزيد من معدل النتح الجائر للأوراق."
    });
  } else if (current <= 15) {
    rec.push({
      text: isEn ? "Low temperature: reduce ventilation and activate heating." : "درجة الحرارة منخفضة: يوصى بتقلي التهوية وتفعيل التدفئة.",
      reasoning: isEn ? "Temp below 15°C slows metabolic processes and may cause cold shock." : "الحرارة تحت 15 درجة تبطئ العمليات الأيضية للنبات وقد تسبب صدمة برد."
    });
  } else {
    rec.push({
      text: isEn ? "Normal temperature range: continue periodic monitoring." : "الحرارة ضمن النطاق المقبول: استمر بالمراقبة الدورية.",
      reasoning: isEn ? "Current range (18-28°C) is ideal for optimal photosynthesis." : "النطاق الحالي (18-28م) هو الأنسب لعملية البناء الضوئي المثالية."
    });
  }
  return rec;
}

export function sensorBuildRecommendationsHumidity(current) {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const rec = [];
  
  if (current >= 80) {
    rec.push({
      text: isEn ? "High humidity: increase ventilation and reduce misting." : "الرطوبة مرتفعة: يوصى بزيادة التهوية وتقليل الرش الضبابي.",
      reasoning: isEn ? "Excessive humidity (+80%) prevents natural transpiration and increases mold risks." : "الرطوبة الزائدة (+80%) تمنع النتح الطبيعي وتزيد من مخاطر الإصابة بالأعفان."
    });
  } else if (current <= 35) {
    rec.push({
      text: isEn ? "Low humidity: adjust humidification system." : "الرطوبة منخفضة: يوصى بضبط نظام الترطيب.",
      reasoning: isEn ? "Humidity below 35% causes leaf edge drying and stunting." : "انخفاض الرطوبة تحت 35% يسبب جفاف حواف الأوراق وتقزم الثمار."
    });
  } else {
    rec.push({
      text: isEn ? "Optimal humidity: maintain current settings." : "الرطوبة ضمن النطاق المناسب: استمر على الإعدادات الحالية.",
      reasoning: isEn ? "Current level (50-65%) maintains plant cell pressure balance." : "مستوى الرطوبة الحالي (50-65%) يحافظ على توازن ضغط الخلايا النباتية."
    });
  }
  return rec;
}

export function sensorBuildRecommendationsSoil(soilTemp, soilMoist) {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const rec = [];
  
  if (soilMoist <= 25) {
    rec.push({
      text: isEn ? "Low soil moisture: increase irrigation gradually." : "رطوبة التربة منخفضة: يوصى بزيادة الري تدريجيًا.",
      reasoning: isEn ? "Moisture near wilting point threatens root life and stunts nutrient absorption." : "اقتراب الرطوبة من نقطة الذبول الدائم يهدد حياة الجذور ويعيق امتصاص العناصر."
    });
  } else if (soilMoist >= 60) {
    rec.push({
      text: isEn ? "High soil moisture: reduce irrigation and ensure drainage." : "رطوبة التربة مرتفعة: قلل الري وتأكد من التصريف.",
      reasoning: isEn ? "Waterlogging expels oxygen, causing root suffocation and rot." : "تشبع التربة بالماء يطرد الأكسجين ويسبب اختناق الجذور وتعفنها."
    });
  }

  if (rec.length === 0) {
    rec.push({
      text: isEn ? "Soil environment is balanced and ideal for growth." : "بيئة التربة متوازنة ومثالية للنمو.",
      reasoning: isEn ? "All vital indicators (moisture/temp) are within recommended agricultural ranges." : "كافة المؤشرات الحيوية (رطوبة وحرارة التربة) ضمن النطاقات الزراعية الموصى بها."
    });
  }
  return rec;
}

export function sensorBuildRecommendationsLight(current) {
  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const rec = [];
  
  if (current >= 100000) {
    rec.push({
      text: isEn ? "High light intensity: activate shading to prevent heat stress." : "شدة إضاءة عالية: قم بتفعيل التظليل لتجنب الإجهاد الحراري.",
      reasoning: isEn ? "Lux exceeded 100,000, risking leaf burn and severe evaporation." : "تجاوزت شدة الإضاءة 100 ألف لوكس، مما يهدد باحتراق الأوراق وزيادة التبخر بشكل حاد."
    });
  } else if (current <= 10000) {
    rec.push({
      text: isEn ? "Low light intensity: activate artificial lighting if necessary." : "إضاءة منخفضة: قم بتشغيل الإضاءة الاصطناعية لدعم البناء الضوئي إذا استمر الانخفاض.",
      reasoning: isEn ? "Prolonged low light slows down plant metabolism and fruit development." : "الانخفاض المستمر في الإضاءة يبطئ عمليات الأيض وتطور الثمار."
    });
  }
  return rec;
}

// Removed mock data generators: getLiveFarmData, getStrategicRecommendations, getAllCombinedRecommendations

export function getLabelForRange(range, index, timestamp = null, isEn = false) {
  const labels = L(isEn);
  if (timestamp) {
    const d = new Date(timestamp);
    if (range === 'D') return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (range === 'W') return isEn ? labels.daysEn[d.getDay()] : labels.daysAr[d.getDay()];
    if (range === 'M') return `${d.getDate()}`;
    if (range === 'Y') return isEn ? labels.monthsEn[d.getMonth()] : labels.monthsAr[d.getMonth()];
  }
  // Fallback to index-based if no timestamp
  if (range === 'D') return `${index}:00`;
  if (range === 'W') return isEn ? labels.daysEn[index % 7] : labels.daysAr[index % 7];
  if (range === 'M') return `${index + 1}`;
  if (range === 'Y') return isEn ? labels.monthsEn[index % 12] : labels.monthsAr[index % 12];
  return `${index}`;
}

export {
  irrigationClamp,
  irrigationDaysInMonth,
  generateIrrigationUsageSeries
};
