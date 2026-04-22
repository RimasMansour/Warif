import { useState, useEffect, useRef } from 'react';
import { CardShell, Account_ModalShell } from './dashboardShared';
import { WARIF_CONFIG } from './warifConfig';

export function CameraCard() {
  const [isActive, setIsActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [autoStartOnce, setAutoStartOnce] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPanX: 0, startPanY: 0 });

  const lang = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language) || 'ar';
  const isEn = lang === 'en';
  const isRtl = lang === 'ar';

  const [remoteUrl, setRemoteUrl] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('warif_user') || '{}');
    return saved.cameraUrl || WARIF_CONFIG.DEFAULT_CAMERA_URL || '';
  });

  // Auto-save and auto-start
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('warif_user') || '{}');
    localStorage.setItem('warif_user', JSON.stringify({ 
      ...saved, 
      cameraUrl: remoteUrl
    }));

    if (!autoStartOnce && remoteUrl) {
      setAutoStartOnce(true);
      setIsActive(true);
    }
  }, [remoteUrl, autoStartOnce]);

  const toggleCamera = () => {
    if (isActive) {
      setIsActive(false);
      setIsLoaded(false);
      setRetryCount(0);
      setZoomScale(1);
      setPan({ x: 0, y: 0 });
    } else {
      setIsActive(true);
      setIsLoaded(false);
      setHasError(false);
    }
  };

  const refreshRemote = () => {
    setRetryKey(prev => prev + 1);
    setIsLoaded(false);
    setHasError(false);
    setRetryCount(0);
  };

  const handleZoomIn = () => setZoomScale(p => Math.min(p + 0.5, 4));
  const handleZoomOut = () => {
    setZoomScale(p => {
      const newZoom = Math.max(p - 0.5, 1);
      if (newZoom === 1) setPan({ x: 0, y: 0 });
      return newZoom;
    });
  };

  const handlePointerDown = (e) => {
    if (zoomScale <= 1) return;
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
  };

  const handlePointerMove = (e) => {
    if (!isDragging || zoomScale <= 1) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.startPanX + dx, y: dragRef.current.startPanY + dy });
  };

  const handlePointerUp = () => setIsDragging(false);

  return (
    <div id="camera-card-container" className="h-full bg-white rounded-3xl relative">
      <CardShell className="overflow-hidden border-none shadow-xl h-full flex flex-col relative w-full bg-white">
        
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-gray-50 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 relative transition-transform hover:scale-105">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
              {isActive && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
                </span>
              )}
            </div>
            <div className={isRtl ? 'text-right' : 'text-left'}>
              <div className="text-lg font-bold text-gray-800 tracking-tight">{isEn ? 'Live Farm Cam' : 'مراقبة المزرعة'}</div>
            <div className={`text-[12px] flex items-center gap-1.5 font-semibold`}>
                {isActive ? (
                  <span className="flex items-center gap-1.5 text-red-500 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {isEn ? 'LIVE' : 'مباشر'}
                  </span>
                ) : (
                  <span className="text-gray-400">{isEn ? 'System Offline' : 'نظام المراقبة مغلق'}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} className="w-11 h-11 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center transition-all hover:bg-emerald-50 hover:text-emerald-600">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </button>
            <button onClick={toggleCamera} className={`px-5 py-2.5 rounded-2xl text-[14px] font-black transition-all ${isActive ? 'bg-red-500 text-white shadow-lg shadow-red-100' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'}`}>
              {isActive ? (isEn ? 'Stop' : 'إيقاف') : (isEn ? 'Start Live' : 'بدء البث')}
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center min-h-[350px]">
          {isActive && !isLoaded && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-950/80 backdrop-blur-md">
              <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
              <div className="text-white font-black text-xs tracking-[0.2em]">{isEn ? 'SYNCING...' : 'جاري المزامنة...'}</div>
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-slate-950 p-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
              </div>
              <div className="text-red-500 font-black mb-2">{isEn ? 'Connection Failed' : 'انقطع الاتصال'}</div>
              <button onClick={refreshRemote} className="px-5 py-2.5 bg-white/10 text-white rounded-xl text-xs font-black border border-white/20 hover:bg-white/20 transition-all">
                {isEn ? 'Retry' : 'إعادة محاولة'}
              </button>
            </div>
          )}

          {!isActive && (
            <div className="text-center opacity-20 group-hover:opacity-40 transition-opacity">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" className="mx-auto mb-4"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
              <div className="text-white text-[10px] font-black uppercase tracking-[0.4em]">Warif Digital Twin</div>
            </div>
          )}

          {isActive && remoteUrl && (
            <img
              key={retryKey}
              src={`${remoteUrl}${remoteUrl.includes('?') ? '&' : '?'}retry=${retryKey}`}
              alt="Stream"
              onLoad={() => { setIsLoaded(true); setHasError(false); setRetryCount(0); }}
              onError={() => {
                if (retryCount < 3) {
                  setTimeout(() => { setRetryCount(p => p + 1); setRetryKey(p => p + 1); }, 2000);
                } else {
                  setHasError(true);
                  setIsLoaded(true);
                }
              }}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
                transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className={`w-full h-full object-contain ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-700`}
              draggable={false}
            />
          )}

          {isActive && isLoaded && !hasError && (
            <div className={`absolute ${isRtl ? 'left-4' : 'right-4'} bottom-4 flex flex-col gap-2 z-20`}>
              <button onClick={handleZoomIn} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button onClick={handleZoomOut} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          )}
        </div>
      </CardShell>

      {/* Simplified Settings Modal */}
      {showSettings && (
        <Account_ModalShell onClose={() => setShowSettings(false)}>
           <div className={`bg-white rounded-3xl shadow-2xl p-6 w-[380px] max-w-[90vw] animate-modal-in ${isEn ? 'text-left' : 'text-right'}`} dir={isEn ? 'ltr' : 'rtl'}>
              <h3 className="text-lg font-black text-gray-800 mb-4">{isEn ? 'Camera Source' : 'مصدر الكاميرا'}</h3>
              <div className="space-y-4">
                 <div>
                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 block">{isEn ? 'Stream URL' : 'رابط البث'}</label>
                    <input 
                      type="text" 
                      value={remoteUrl} 
                      onChange={(e) => setRemoteUrl(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-emerald-500/20 font-mono text-[13px] outline-none transition-all"
                    />
                 </div>
                 <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100/50">
                    <p className="text-[12px] text-emerald-800 font-bold leading-relaxed">
                       {isEn ? 'This URL is global. Changes will affect visibility across all your devices.' : 'هذا الرابط عالمي، أي تغيير سيعتمد في كافة أجهزتك المتصلة بحساب وارِف.'}
                    </p>
                 </div>
                 <button onClick={() => setShowSettings(false)} className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100">{isEn ? 'Save & Close' : 'حفظ وإغلاق'}</button>
              </div>
           </div>
        </Account_ModalShell>
      )}
    </div>
  );
}
