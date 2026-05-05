import re
import os

files_to_patch = [
    "../frontend/src/pages/dashboard/DashboardHome.jsx",
    "../frontend/src/pages/dashboard/DecisionSupportPage.jsx",
    "../frontend/src/pages/dashboard/IrrigationPage.jsx",
    "../frontend/src/pages/dashboard/SensorPages.jsx"
]

def patch_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Change grids to be multi-column to allow square cards to not stretch full width.
    # We will replace `grid grid-cols-1 gap-4` with `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`
    content = content.replace('className="grid grid-cols-1 gap-4"', 'className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"')
    content = content.replace('className="flex-1 mt-4 overflow-y-auto max-h-[400px] pr-1 custom-scrollbar flex flex-col gap-3"', 'className="flex-1 mt-4 overflow-y-auto max-h-[400px] pr-1 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-3"')

    # We need a robust regex to replace the interior of the recommendation card.
    # The structure varies, but generally starts at:
    # <div className={`flex flex-col lg:flex-row ...
    # or
    # <div className={`flex flex-col justify-between gap-5`}>
    
    # Actually, it's easier to use a Python script to do targeted replacements on specific known strings across these files.

    # "Rate" or "تقييم" -> "Was this helpful?" or "هل كان مفيدًا؟"
    content = content.replace("{isEn ? 'Rate' : 'تقييم'}", "{isEn ? 'Was this helpful?' : 'هل كان مفيدًا؟'}")
    
    # We want to change the layout to be vertical instead of horizontal.
    # In DashboardHome, SensorPages, IrrigationPage:
    # <div className="flex items-start gap-5">
    #   <div className="flex flex-col items-center gap-3 min-w-[80px]"> ... rate buttons ... </div>
    #   <div className="flex-1"> ... content ... </div>
    # </div>
    
    # In DecisionSupportPage:
    # <div className={`flex flex-col lg:flex-row lg:items-start justify-between gap-5 ${isRtl ? 'text-right' : 'text-left'}`}>
    #   <div className="flex flex-col items-center gap-3 min-w-[80px]"> ... rate buttons ... </div>
    #   <div className="flex-1"> ... content ... </div>
    #   <div className={`flex flex-col items-center lg:items-end justify-center min-w-[160px] ... </div>
    # </div>

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Patched {filepath}")

for f in files_to_patch:
    patch_file(f)
