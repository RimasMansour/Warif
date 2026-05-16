const fs = require('fs');

const file = fs.readFileSync('src/pages/dashboard/DashboardShared.jsx', 'utf8');

// We will update the Footer Area of RecommendationCard and AlertCard to remove the `!compact &&` check.
// And we add `flex-wrap` to the footer container to prevent cramping.

let updatedFile = file;

// RecommendationCard Footer:
updatedFile = updatedFile.replace(
  /\{!\s*compact\s*&&\s*\(\s*(<div className="flex items-center gap-2 relative">.*?<\/div>)\s*\)\}/s,
  '$1'
);
// AlertCard Footer:
updatedFile = updatedFile.replace(
  /\{!\s*compact\s*&&\s*\(\s*(<div className="flex items-center gap-2 relative">.*?<\/div>)\s*\)\}/s,
  '$1'
);

// Add flex-wrap to footers
updatedFile = updatedFile.replace(
  /className="pt-3 border-t border-gray-100\/80 flex items-center justify-between gap-3 mt-auto"/g,
  'className="pt-3 border-t border-gray-100/80 flex flex-wrap items-center justify-between gap-3 mt-auto"'
);

updatedFile = updatedFile.replace(
  /className="mt-3 pt-3 border-t border-gray-100\/80 flex items-center justify-between gap-3" dir="ltr"/g,
  'className="mt-3 pt-3 border-t border-gray-100/80 flex flex-wrap items-center justify-between gap-3" dir="ltr"'
);

// Write changes
fs.writeFileSync('src/pages/dashboard/DashboardShared.jsx', updatedFile, 'utf8');
console.log('Successfully unified Feedback sections and Manual/Auto interactions globally.');
