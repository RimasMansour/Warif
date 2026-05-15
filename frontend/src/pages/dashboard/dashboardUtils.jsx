// Helper for bilingual labels
const L = (isEn) => ({
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

export function getLabelForRange(range, index, timestamp = null, isEn = false) {
  const labels = L(isEn);
  
  // UX FIX: Always prioritize actual timestamp for accuracy in trend charts
  if (timestamp) {
    const d = new Date(timestamp);
    if (range === 'D') {
      const hours = d.getHours();
      const ampm = isEn ? (hours >= 12 ? 'PM' : 'AM') : (hours >= 12 ? 'م' : 'ص');
      const h12 = hours % 12 || 12;
      return `${h12}${ampm}`;
    }
    if (range === 'W') return isEn ? labels.daysEn[d.getDay()] : labels.daysAr[d.getDay()];
    if (range === 'M') return `${d.getDate()}`;
    if (range === 'Y') return isEn ? labels.monthsEn[d.getMonth()] : labels.monthsAr[d.getMonth()];
  }

  // Fallback to index-based labels if no timestamp (mock data)
  if (range === 'D') {
    const hours = index % 24;
    const ampm = isEn ? (hours >= 12 ? 'PM' : 'AM') : (hours >= 12 ? 'م' : 'ص');
    const h12 = hours % 12 || 12;
    return `${h12}${ampm}`;
  }
  
  if (range === 'W') {
    return isEn ? labels.daysEn[index % 7] : labels.daysAr[index % 7];
  }
  
  if (range === 'M') return `${index + 1}`;
  if (range === 'Y') return isEn ? labels.monthsEn[index % 12] : labels.monthsAr[index % 12];

  return `${index}`;
}

