export function Footer({ isEn }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full mt-auto pt-8 pb-32 lg:pb-12 px-8 md:px-32 bg-transparent border-t border-gray-200/60 transition-all duration-300">
      <div className="w-full max-w-[1250px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm font-medium text-gray-500">
        
        {/* Branding & Copyright */}
        <div className="flex items-center gap-2">
          <span className="font-black text-emerald-700 tracking-tight">{isEn ? 'Warif System' : 'نظام وارِف'}</span>
          <span className="opacity-60 hidden md:inline">|</span>
          <span className="opacity-80">
             &copy; {currentYear} {isEn ? 'All rights reserved.' : 'جميع الحقوق محفوظة.'}
          </span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-4 md:gap-6 flex-wrap justify-center text-[13px]">
          <a href="#" className="hover:text-emerald-600 transition-colors">{isEn ? 'Terms & Conditions' : 'الشروط والأحكام'}</a>
          <a href="#" className="hover:text-emerald-600 transition-colors">{isEn ? 'Privacy Policy' : 'سياسة الخصوصية'}</a>
          <a href="#" className="hover:text-emerald-600 transition-colors">{isEn ? 'Technical Support' : 'الدعم الفني'}</a>
        </div>

      </div>
    </footer>
  );
}
