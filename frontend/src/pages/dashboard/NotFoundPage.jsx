export function NotFoundPage({ onBack, isEn }) {
  return (
    <div className="w-full px-4 md:px-8 py-5 page-enter flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center text-center p-8 bg-white/50 backdrop-blur-sm rounded-3xl border border-gray-100 shadow-sm animate-fade-in-up">
        
        {/* Abstract 404 SVG (Platforms Code style: simple, primary color focus) */}
        <div className="relative w-40 h-40 mb-8">
          <div className="absolute inset-0 bg-emerald-50 rounded-full scale-110 animate-pulse opacity-50"></div>
          <svg className="w-full h-full text-emerald-600 drop-shadow-sm" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
             <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
             <circle cx="12" cy="12" r="3" fill="currentColor" className="opacity-20" />
          </svg>
        </div>

        {/* Typography */}
        <h1 className="text-3xl md:text-4xl font-black text-gray-800 tracking-tight mb-3">
          {isEn ? 'Page Not Found' : 'عذراً، الصفحة غير موجودة'}
        </h1>
        <p className="text-[15px] font-semibold text-gray-500 mb-8 max-w-sm leading-relaxed">
          {isEn 
            ? "The page you are looking for might have been removed, had its name changed, or is temporarily unavailable." 
            : "الصفحة التي تبحث عنها قد تكون محذوفة، أو تم تغيير رابطها، أو غير متاحة مؤقتاً."}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onBack}
            className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[15px] rounded-xl shadow-lg shadow-emerald-600/20 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
          >
            {isEn ? 'Go to Dashboard' : 'العودة إلى الرئيسية'}
          </button>
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto px-8 py-3 bg-white hover:bg-gray-50 text-gray-600 font-bold text-[15px] rounded-xl border border-gray-200 transition-all duration-300"
          >
            {isEn ? 'Go Back' : 'رجوع للسابق'}
          </button>
        </div>
        
        <div className="mt-8 text-6xl font-black text-gray-100/50 select-none pointer-events-none">
          404
        </div>
      </div>
    </div>
  );
}
