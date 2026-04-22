export function PlaceholderPage({ page, onBack }) {
  const titleMap = {
    temp: "تفاصيل درجة الحرارة",
    airHumidity: "تفاصيل رطوبة الهواء",
    soilMoisture: "تفاصيل رطوبة التربة",
    irrigation: "تفاصيل حالة الري",
    recs: "كل التوصيات",
    weather: "تفاصيل الطقس",
    profile: "الملف الشخصي",
    settings: "الإعدادات",
  };
  const title = titleMap[page] || "صفحة";

  return (
    <div className="w-full h-full px-4 md:px-8 py-5 overflow-auto page-enter" dir="rtl">
      <div className="w-full max-w-[1150px] mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <div className="text-xl font-black text-gray-800">{title}</div>
            <div className="text-[13px] text-gray-500 mt-1">
              Placeholder — سيتم تصميم الصفحة وربطها لاحقًا.
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-[15px] text-gray-600 hover:text-[#2E7D32] hover:border-[#2E7D32]/30 hover:bg-[#f0fdf4] transition-all duration-300 flex items-center gap-2 font-medium"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
            رجوع
          </button>
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow border border-gray-200 p-5 text-gray-700">
          هنا مكان محتوى الصفحة (قريبًا).
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Mini Chart: Donut
========================================================= */

