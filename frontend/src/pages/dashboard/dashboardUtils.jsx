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

export function getLiveFarmData(activeFarm) {
  return {
    temp: 28.4 + (activeFarm * 2),
    hum: 56 + (activeFarm * 3),
    soilTemp: 24.5 + (activeFarm * 1.5),
    soilMoist: 42 + (activeFarm * 2),
    waterUsage: 5000 + (activeFarm * 500),
    powerUsage: 360 + (activeFarm * 40),
    flowRate: 60 + (activeFarm * 7)
  };
}

export function getStrategicRecommendations(activeFarm, isEn) {
  const base = isEn ? [
    {
      id: "r1",
      farmIndices: [0, 1, 2],
      mode: "auto", 
      type: "heat",
      title: "Auto Action: Shading Activated",
      desc: "Due to high solar radiation, the system activated 40% automated shading.",
      reasoning: "Solar radiation peaked at 850 W/m², requiring preventive intervention to protect leaves from burning.",
      time: "2 hours ago",
    },
    {
       id: "v1",
       farmIndices: [0],
       mode: "manual",
       type: "irrigation",
       title: "Rec: Flowering Support (Vegetables)",
       desc: "Low calcium levels detected; slight increase in irrigation volume is recommended.",
       reasoning: "Sensor data shows moisture fluctuations. During fruiting, stable irrigation prevents fruit cracking.",
       time: "4 hours ago",
       status: "pending", 
    },
    {
       id: "f1",
       farmIndices: [1],
       mode: "manual",
       type: "irrigation",
       title: "Rec: Sugar Conc. Check (Fruits)",
       desc: "Gradual reduction in irrigation can stimulate sugar concentration in fruits.",
       reasoning: "Digital twin predicts ripening in 5 days; water restriction enhances flavor and desired taste.",
       time: "1 hour ago",
       status: "pending", 
    },
    {
       id: "l1",
       farmIndices: [2],
       mode: "manual",
       type: "humidity",
       title: "Rec: Transpiration Check (Leafy)",
       desc: "Dew accumulation on wide leaves detected; ventilation is recommended.",
       reasoning: "High interstitial humidity in lettuce leaves inhibits respiration; activating dry air prevents fungal growth.",
       time: "30 mins ago",
       status: "pending", 
    },
    {
       id: "r3",
       farmIndices: [0, 1, 2],
       mode: "auto",
       type: "humidity",
       title: "Auto Action: Ventilation Activated",
       desc: "Top windows opened automatically to reduce accumulated air humidity.",
       reasoning: "Relative air humidity exceeded 85%; phased ventilation was activated to maintain target 65% range.",
       time: "Yesterday",
    }
  ] : [
    {
      id: "r1",
      farmIndices: [0, 1, 2],
      mode: "auto", 
      type: "heat",
      title: "إجراء مؤتمت: تفعيل التظليل",
      desc: "بسبب ارتفاع الإشعاع الشمسي، قام النظام بتفعيل التظليل الآلي بنسبة 40%.",
      reasoning: "تم رصد ارتفاع مفاجئ في إشعاع الشمس (850 واط/م²) مما استدعى التدخل الوقائي لحماية الأوراق من الاحتراق.",
      time: "منذ ساعتين",
    },
    {
       id: "v1",
       farmIndices: [0],
       mode: "manual",
       type: "irrigation",
       title: "توصية: دعم التزهير (الخضروات)",
       desc: "مستوى الكالسيوم المنخفض قد يسبب تعفن طرف الثمرة؛ يوصى بزيادة طفيفة في الري.",
       reasoning: "بيانات الحساسات تشير لتذبذب في الرطوبة، وبما أن الخضروات في مرحلة الإثمار، فإن استقرار الري يمنع تشقق الثمار.",
       time: "منذ 4 ساعات",
       status: "pending", 
    },
    {
       id: "f1",
       farmIndices: [1],
       mode: "manual",
       type: "irrigation",
       title: "توصية: فحص نسبة السكر (الفواكه)",
       desc: "تقليل الري تدريجياً في هذه المرحلة يحفز تركيز السكر في الثمار.",
       reasoning: "التوأم الرقمي يتوقع نضج المحصول خلال 5 أيام؛ تقنين المياه يعزز الطعم والمذاق المطلوب في الفواكه.",
       time: "منذ ساعة",
       status: "pending", 
    },
    {
       id: "l1",
       farmIndices: [2],
       mode: "manual",
       type: "humidity",
       title: "توصية: فحص النتح (الورقيات)",
       desc: "تراكم الندى على الأوراق العريضة قد يسبب بياض دقيقي؛ يوصى بالتهوية.",
       reasoning: "ارتفاع الرطوبة البينية بين أوراق الخص يعيق التنفس؛ تفعيل الهواء الجاف يمنع نمو المستعمرات الفطرية.",
       time: "منذ 30 دقيقة",
       status: "pending", 
    },
    {
       id: "r3",
       farmIndices: [0, 1, 2],
       mode: "auto",
       type: "humidity",
       title: "إجراء مؤتمت: تفعيل التهوية",
       desc: "تم فتح النوافذ العلوية تلقائياً لخفض رطوبة الهواء المتراكمة.",
       reasoning: "تجاوزت رطوبة الهواء النسبية حاجز 85%، وتم تفعيل التهوية المتدرجة للحفاظ على النطاق الآمن (65%).",
       time: "أمس",
    }
  ];
  return base.filter(r => r.farmIndices.includes(activeFarm));
}

export function getAllCombinedRecommendations(activeFarm, isEn) {
  const data = getLiveFarmData(activeFarm);
  const tempRecs = sensorBuildRecommendationsTemperature(data.temp);
  const humRecs = sensorBuildRecommendationsHumidity(data.hum);
  const soilRecs = sensorBuildRecommendationsSoil(data.soilTemp, data.soilMoist);
  const strategic = getStrategicRecommendations(activeFarm, isEn);

  // Convert sensor-based to strategic format for consistency
  const converted = [];
  
  tempRecs.forEach((r, i) => {
    converted.push({
      id: `live-temp-${i}`,
      week: isEn ? "This Week" : "هذا الأسبوع",
      mode: "auto",
      type: "heat",
      title: r.text,
      desc: r.text,
      reasoning: r.reasoning,
      time: isEn ? "Live" : "لحظي"
    });
  });

  humRecs.forEach((r, i) => {
    converted.push({
      id: `live-hum-${i}`,
      week: isEn ? "This Week" : "هذا الأسبوع",
      mode: "auto",
      type: "humidity",
      title: r.text,
      desc: r.text,
      reasoning: r.reasoning,
      time: isEn ? "Live" : "لحظي"
    });
  });

  // Return limited for card or full for page
  return [...converted, ...strategic];
}

export {
  irrigationClamp,
  irrigationDaysInMonth,
  generateIrrigationUsageSeries
};
