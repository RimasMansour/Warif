const fs = require('fs');

const file = fs.readFileSync('src/pages/dashboard/DashboardShared.jsx', 'utf8');

// Find the start of the action / auto mode section in AlertCard
const startIndicator = '{/* Action / Auto Mode Section */}';
const endIndicator = '    </div>\n  );\n}';
const startIndex = file.indexOf(startIndicator);
const endIndex = file.indexOf(endIndicator);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find AlertCard footer section to replace.");
  process.exit(1);
}

const newAlertFooter = `{/* Unified Footer Area (Matches RecommendationCard) */}
      <div className="pt-3 border-t border-gray-100/80 flex flex-wrap items-center justify-between gap-3 mt-auto" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center gap-2 relative">
            <span className="font-medium text-[12px] text-gray-400 whitespace-nowrap">
              {isEn ? 'Appropriate?' : 'مفيدة؟'}
            </span>
            <button
              onClick={() => onFeedback?.(alert.id, 'down')}
              className={\`w-8 h-8 flex items-center justify-center rounded-xl border transition-all
                \${feedbackState[alert.id] === 'down'
                  ? 'bg-red-50 border-red-300 text-red-600 scale-110'
                  : 'bg-gray-50/80 border-gray-100 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500'}\`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/>
              </svg>
            </button>
            <button
              onClick={() => onFeedback?.(alert.id, 'up')}
              className={\`w-8 h-8 flex items-center justify-center rounded-xl border transition-all
                \${feedbackState[alert.id] === 'up'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-600 scale-110'
                  : 'bg-gray-50/80 border-gray-100 text-gray-400 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600'}\`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/>
              </svg>
            </button>
          </div>
          {formatAlertMeta() && (
            <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest whitespace-nowrap text-start">
              {formatAlertMeta()}
            </span>
          )}
        </div>

        {!globalAutoMode ? (
          <div className="flex gap-2 ms-auto">
            <button
              onClick={handleConfirm}
              disabled={isLoading || executionSuccess}
              className={\`px-4 py-1.5 text-white text-[13px] font-bold rounded-xl transition-all active:scale-95 shadow-sm flex items-center gap-1.5 whitespace-nowrap
                \${executionSuccess ? 'bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-700'} \${isLoading ? 'opacity-75' : ''}\`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                  </svg>
                  {isEn ? 'Executing…' : 'جاري التنفيذ…'}
                </>
              ) : executionSuccess ? (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {isEn ? 'Done' : 'تم'}
                </>
              ) : (isEn ? 'Execute' : 'نفذ')}
            </button>
            <button className="px-4 py-1.5 bg-gray-50/80 border border-gray-100 text-gray-500 text-[13px] font-bold rounded-xl hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all active:scale-95 whitespace-nowrap">
              {isEn ? 'Ignore' : 'تجاهل'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-xl border border-emerald-100 bg-emerald-50/80 flex-1 w-full mt-2 lg:mt-0">
            <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-emerald-500 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
            </div>
            <p className="font-medium text-[12px] text-emerald-800 leading-snug flex-1 text-start">
              {getDescriptiveAutoMessage(category, isEn)}
            </p>
          </div>
        )}
`;

const updatedFile = file.substring(0, startIndex) + newAlertFooter + file.substring(endIndex);

fs.writeFileSync('src/pages/dashboard/DashboardShared.jsx', updatedFile, 'utf8');
console.log('Successfully unified AlertCard footer to match RecommendationCard.');
