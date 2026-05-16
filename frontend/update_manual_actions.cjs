const fs = require('fs');
const file = fs.readFileSync('src/pages/dashboard/DashboardShared.jsx', 'utf8');

// 1. Replace getDescriptiveAutoMessage with getActionExplanation
let updated = file.replace(
  /function getDescriptiveAutoMessage\(category, isEn\) \{[\s\S]*?\n\}/,
  \`function getActionExplanation(category, isEn, isAuto) {
  if (category === 'climate' || category === 'temperature') {
    if (isAuto) return isEn ? "Greenhouse fans activated autonomously to lower temperature and stabilize the crop environment." : "تم تشغيل المراوح تلقائياً لتخفيف درجة الحرارة وتلطيف أجواء الصوبة لضمان استقرار المحصول.";
    return isEn ? "Do you want to turn on the fans to lower the temperature and stabilize the crop environment?" : "هل تود تشغيل المراوح لتخفيف درجة الحرارة وتلطيف أجواء الصوبة لضمان استقرار المحصول؟";
  }
  if (category === 'irrigation' || category === 'water') {
    if (isAuto) return isEn ? "Irrigation pumps activated autonomously to restore optimal soil moisture levels." : "تم تفعيل مضخات الري تلقائياً لاستعادة مستويات رطوبة التربة المثالية.";
    return isEn ? "Do you want to activate the irrigation pumps to restore optimal soil moisture levels?" : "هل تود تفعيل مضخات الري لاستعادة مستويات رطوبة التربة المثالية؟";
  }
  if (isAuto) return isEn ? "Action executed autonomously by the digital twin system." : "تم تنفيذ الإجراء تلقائياً بواسطة نظام التوأم الرقمي.";
  return isEn ? "Do you want to execute the recommended action to optimize the system?" : "هل تود تنفيذ الإجراء الموصى به لتحسين أداء النظام؟";
}\`
);

// We must also update references of \`getDescriptiveAutoMessage\` to \`getActionExplanation\`
updated = updated.replace(/getDescriptiveAutoMessage\(rec\.category \|\| rec\.type, isEn\)/g, "getActionExplanation(rec.category || rec.type, isEn, true)");
updated = updated.replace(/getDescriptiveAutoMessage\(category, isEn\)/g, "getActionExplanation(category, isEn, true)");

// 2. Rewrite the Manual Mode layout in RecommendationCard and AlertCard
// We find \`{!globalAutoMode ? (\` and the matching \`ms-auto\` block
const manualBlockRegexRec = /\{\!globalAutoMode \? \([\s\S]*?<div className="flex gap-2 ms-auto">([\s\S]*?)<\/div>\s*\)\ : \(/g;

let count = 0;
updated = updated.replace(manualBlockRegexRec, (match, innerButtons) => {
  count++;
  return \`{!globalAutoMode ? (
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-2.5 rounded-xl border border-sky-100 bg-sky-50/50 flex-1 w-full mt-2 lg:mt-0">
            <div className="flex items-start xl:items-center gap-2">
              <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-sky-500 mt-1 xl:mt-0 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
              </div>
              <p className="font-medium text-[12px] text-sky-800 leading-snug flex-1 text-start">
                {\`\${typeof rec !== 'undefined' ? getActionExplanation(rec.category || rec.type, isEn, false) : getActionExplanation(category, isEn, false)}\`}
              </p>
            </div>
            <div className="flex gap-2 ms-auto shrink-0">
              \${innerButtons.trim()}
            </div>
          </div>
        ) : (\`;
});

fs.writeFileSync('src/pages/dashboard/DashboardShared.jsx', updated, 'utf8');
console.log('Replaced manual mode layout. Count:', count);
