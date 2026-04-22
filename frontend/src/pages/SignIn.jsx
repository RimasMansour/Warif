import React, { useState, useEffect } from "react";
import { translations } from "../i18n";

/* =========================================================
   WARIF | Ultra-Premium Sign-In & Registration Flow
   - Advanced Glassmorphism
   - Dynamic Animated Background
   - Micro-Interactions & Fluid Transitions
   ========================================================= */

export default function SignIn({ onLogin, lang: propLang, onLangChange }) {
  const [page, setPage] = useState('login');
  const [step, setStep] = useState(1);
  const [userData, setUserData] = useState({});
  const [transitioning, setTransitioning] = useState(false);
  const [direction, setDirection] = useState('forward');
  const lang = propLang || 'ar';
  const T = translations[lang];
  const isRtl = lang === 'ar';

  const goTo = (target, dir = 'forward') => {
    setDirection(dir);
    setTransitioning(true);
    setTimeout(() => {
      if (target === 'registerFarm') {
        setPage('registerFarm');
        setStep(1);
      } else {
        setPage(target);
      }
      setTransitioning(false);
    }, 250);
  };

  const goBack = () => {
    if (page === 'registerUser') goTo('login', 'back');
    else if (page === 'registerFarm') {
      if (step === 1) goTo('registerUser', 'back');
      else {
        setDirection('back');
        setTransitioning(true);
        setTimeout(() => {
          setStep(s => s - 1);
          setTransitioning(false);
        }, 250);
      }
    }
  };

  const nextStep = () => {
    setDirection('forward');
    setTransitioning(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setTransitioning(false);
    }, 250);
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center overflow-hidden relative font-['IBM_Plex_Sans_Arabic']" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Dynamic Animated Background */}
      <div className="absolute inset-0 bg-[#f7f7f4] z-0 overflow-hidden">
        {/* Animated Orbs */}
        <div className="orb orb-1 opacity-40 mix-blend-multiply" />
        <div className="orb orb-2 opacity-30 mix-blend-screen" />
        <div className="orb orb-3 opacity-35" />
        <div className="orb orb-4 opacity-25" />
        
        {/* Subtle geometric pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
          style={{
            backgroundImage: 'radial-gradient(circle, #065f46 1.5px, transparent 1.5px)',
            backgroundSize: '48px 48px'
          }} />
      </div>

      {/* Language Toggle - Floating Premium Style */}
      <div className="absolute top-8 left-8 z-50 animate-fade-in">
        <button
          onClick={() => onLangChange && onLangChange(lang === 'ar' ? 'en' : 'ar')}
          className="group flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-xl shadow-black/5 text-[13px] font-black text-emerald-800 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-all duration-500 active:scale-95"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-100 group-hover:bg-white/20 flex items-center justify-center transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </div>
          {T.langToggle}
        </button>
      </div>

      {/* Main Authentication Card */}
      <div className={`relative z-10 w-[480px] max-w-[94vw] max-h-[90vh] overflow-y-auto overflow-x-hidden custom-scrollbar
                       glass-strong p-0 rounded-[40px] shadow-2xl transition-all duration-300
                       ${transitioning ? 'pointer-events-none' : ''}`}
           style={{ border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 30px 100px rgba(0,0,0,0.08)' }}>
        
        {/* Back Button - Contextual */}
        {page !== 'login' && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); goBack(); }}
            className={`absolute top-6 ${isRtl ? 'left-8' : 'right-8'} z-[60] flex items-center gap-2 group transition-all active:scale-95`}
          >
            <div className="w-10 h-10 rounded-2xl bg-white/50 backdrop-blur-sm border border-white/60 flex items-center justify-center shadow-sm group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#065f46" strokeWidth="2.5" strokeLinecap="round" className={isRtl ? '' : 'rotate-180'}><path d="M15 18l-6-6 6-6" /></svg>
            </div>
          </button>
        )}

        {/* Brand Header Section (Logo + Progress) */}
        <div className="pt-6 px-8 flex flex-col items-center">
            <div className="animate-float">
              <img src="/logo.png" alt="وارِف" className="w-24 h-24 object-contain drop-shadow-2xl" />
            </div>
           
           {page === 'registerFarm' && (
            <div className="flex items-center gap-2.5 mt-2 animate-fade-in-up">
              {[1, 2, 3].map(s => (
                <div key={s} className="relative group">
                  <div className={`h-1.5 rounded-full transition-all duration-700 ease-in-out ${s === step ? 'w-12 bg-emerald-600 shadow-[0_0_12px_rgba(5,150,105,0.4)]' :
                      s < step ? 'w-4 bg-emerald-300' : 'w-4 bg-gray-200'
                    }`} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content Wrapper with Animated Swipes */}
        <div className={`px-8 pt-2 pb-4 transition-all duration-300 ease-out ${transitioning
            ? direction === 'forward'
              ? 'opacity-0 translate-x-[-40px] scale-[0.98]'
              : 'opacity-0 translate-x-[40px] scale-[0.98]'
            : 'opacity-100 translate-x-0 scale-100'
          }`}>
          
          {page === 'login' && (
            <LoginPage onLogin={onLogin} onNewUser={() => goTo('registerUser')} T={T} isRtl={isRtl} />
          )}
          
          {page === 'registerUser' && (
            <RegisterUserPage
              onNext={(data) => { setUserData(d => ({ ...d, ...data })); goTo('registerFarm'); }}
              T={T}
              isRtl={isRtl}
            />
          )}
          
          {page === 'registerFarm' && (
            <>
              {step === 1 && <FarmInfoStep onNext={(data) => { setUserData(d => ({ ...d, ...data })); nextStep(); }} T={T} isRtl={isRtl} />}
              {step === 2 && <SensorSelectionStep onNext={(data) => { setUserData(d => ({ ...d, ...data })); nextStep(); }} T={T} />}
              {step === 3 && <DeviceScanPage onFinish={() => {
                const final = { ...userData };
                localStorage.setItem('warif_user', JSON.stringify(final));
                onLogin();
              }} T={T} isRtl={isRtl} selectedSensors={userData.sensors || []} />}
            </>
          )}
        </div>

        {/* Footer Polish */}
        <div className="pb-8 text-center px-8">
           <p className="text-[11px] font-black text-emerald-800/40 uppercase tracking-[0.2em]">{T.systemSubtitle}</p>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- REUSABLE INPUT ----------------------------- */
function InputField({ label, placeholder, type = "text", value, onChange, error, onKeyDown, icon, isRtl }) {
  const [showPassword, setShowPassword] = useState(false);
  const [focussed, setFocussed] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={`flex flex-col gap-1.5 ${isRtl ? 'text-right' : 'text-left'} animate-fade-in-up duration-500`}>
      <label className={`text-[12px] font-black uppercase tracking-tight text-emerald-800/60 transition-colors ${focussed ? 'text-emerald-600' : ''}`}>{label}</label>
      <div className="relative group/input">
        <div className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 transition-colors duration-300 ${focussed ? 'text-emerald-500' : 'text-gray-400 opacity-60'}`}>
          {icon}
        </div>
        <input
          type={isPassword && showPassword ? "text" : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocussed(true)}
          onBlur={() => setFocussed(false)}
          className={`w-full bg-white border-2 rounded-[20px] py-4 text-[14px] font-bold outline-none transition-all duration-300 input-enhanced
                     ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'}
                     ${error ? 'border-[var(--status-error)] bg-red-50/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 
                       focussed ? 'border-emerald-500 bg-white shadow-xl shadow-emerald-500/10' : 'border-gray-200 hover:border-emerald-200'
                     }`}
          placeholder={placeholder}
        />
        {isPassword && value && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-600 transition-colors`}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        )}
      </div>
      <div className={`overflow-hidden transition-all duration-500 ${error ? 'max-h-6 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
        <span className="text-[11px] font-black text-red-600 flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          {error}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------- LOGIN PAGE ----------------------------- */
function LoginPage({ onLogin, onNewUser, T, isRtl }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('warif_remember');
    if (saved) {
      const { username: u, password: p } = JSON.parse(saved);
      setUsername(u); setPassword(p); setRemember(true);
    }
  }, []);

  const validate = () => {
    const errs = {};
    const savedUser = JSON.parse(localStorage.getItem('warif_user') || '{}');
    if (!username.trim()) errs.username = T.errUsernameRequired;
    else if (username !== 'admin' && username !== savedUser.username) errs.username = T.errUsernameWrong;
    if (!password) errs.password = T.errPasswordRequired;
    else if (username === 'admin' && password !== '123456') errs.password = T.errPasswordWrong;
    else if (username === savedUser.username && password !== savedUser.password) errs.password = T.errPasswordWrong;
    return errs;
  };

  const handleLogin = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    if (remember) localStorage.setItem('warif_remember', JSON.stringify({ username, password }));
    else localStorage.removeItem('warif_remember');
    setLoading(true);
    setTimeout(() => { setLoading(false); localStorage.setItem('warif_logged_in', 'true'); onLogin(); }, 1200);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center animate-fade-in-up mb-1">
        <h1 className="text-xl font-black text-emerald-900 tracking-tight leading-tight">{T.loginTitle}</h1>
      </div>

      <div className="flex flex-col gap-4">
        <div className="animate-fade-in-up delay-1">
          <InputField
            label={T.username} placeholder={T.usernamePlaceholder} value={username} isRtl={isRtl}
            onChange={v => { setUsername(v); setErrors(e => ({ ...e, username: '' })); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()} error={errors.username}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="8" r="4"/><path d="M6 20c0-4 3-6 6-6s6 2 6 6" /></svg>}
          />
        </div>
        <div className="animate-fade-in-up delay-2">
          <InputField
            label={T.password} placeholder={T.passwordPlaceholder} value={password} type="password" isRtl={isRtl}
            onChange={v => { setPassword(v); setErrors(e => ({ ...e, password: '' })); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()} error={errors.password}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
          />
        </div>
      </div>

      <div className={`flex items-center gap-3 cursor-pointer group animate-fade-in-up delay-3 ${isRtl ? 'flex-row' : 'flex-row-reverse justify-end'}`} onClick={() => setRemember(!remember)}>
        <div className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${remember ? 'bg-emerald-600 border-emerald-600 shadow-lg shadow-emerald-500/20' : 'border-emerald-100 group-hover:border-emerald-300'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" className={`transition-all ${remember ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span className="text-[13px] font-bold text-emerald-800/60 group-hover:text-emerald-700 transition-colors">{T.rememberMe}</span>
      </div>

      <div className="animate-fade-in-up delay-4">
        <button
          onClick={handleLogin} disabled={loading}
          className="btn-primary w-full py-4 bg-gradient-to-l from-emerald-800 to-emerald-600 text-white rounded-[24px] font-black text-lg shadow-xl shadow-emerald-900/10 hover:shadow-emerald-900/20 transition-all flex items-center justify-center gap-3 mt-2"
        >
          {loading ? (
            <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
          ) : (
            <>
              {T.loginBtn}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={isRtl ? '' : 'rotate-180'}><path d="M15 18l-6-6 6-6" /></svg>
            </>
          )}
        </button>
      </div>

      <div className="animate-fade-in-up delay-5 text-center">
        <button onClick={onNewUser} className="text-[13px] text-emerald-800/40 hover:text-emerald-700 transition-all group font-black uppercase tracking-widest">
          {T.noAccount} <span className="text-emerald-600 underline underline-offset-4 decoration-emerald-200 group-hover:decoration-emerald-500">{T.registerNow}</span>
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- REGISTER USER PAGE ----------------------------- */
function RegisterUserPage({ onNext, T, isRtl }) {
  const [fullName, setFullName] = useState('');
  const [fullNameEn, setFullNameEn] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!fullName.trim()) errs.fullName = T.errFullNameRequired;
    if (!fullNameEn.trim()) errs.fullNameEn = T.errFullNameEnRequired || (isRtl ? "الاسم بالإنجليزية مطلوب" : "English name required");
    if (!username.trim()) errs.username = T.errUsernameRequired;
    else if (!/^[a-zA-Z0-9._]+$/.test(username)) errs.username = T.errUsernameEnglish;
    if (!email.trim()) errs.email = T.errEmailRequired;
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = T.errEmailInvalid;
    if (!password) errs.password = T.errPasswordRequired;
    else if (password.length < 6) errs.password = T.errPasswordLength;
    if (password !== confirm) errs.confirm = T.errPasswordMatch;
    return errs;
  };

  const handleNext = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onNext({ fullName, fullNameEn, username, email, password });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center mb-1 animate-fade-in-up">
        <h1 className="text-xl font-black text-emerald-900 tracking-tight">{T.createAccount}</h1>
        <p className="text-[11px] font-bold text-gray-400 mt-0.5">{T.enterData}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="animate-fade-in-up delay-1">
          <InputField label={T.fullName} placeholder={T.fullNamePlaceholder} value={fullName} onChange={setFullName} error={errors.fullName} isRtl={isRtl}
            onKeyDown={e => e.key === "Enter" && handleNext()} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="8" r="4"/><path d="M6 20c0-4 3-6 6-6s6 2 6 6"/></svg>}
          />
        </div>
        <div className="animate-fade-in-up delay-2">
          <InputField label={T.fullNameEn} placeholder={T.fullNameEnPlaceholder} value={fullNameEn} onChange={setFullNameEn} error={errors.fullNameEn} isRtl={isRtl}
            onKeyDown={e => e.key === "Enter" && handleNext()} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="8" r="4"/><path d="M6 20c0-4 3-6 6-6s6 2 6 6"/></svg>}
          />
        </div>
        <div className="animate-fade-in-up delay-3">
          <InputField label={T.usernameEn} placeholder={T.usernamePlaceholder} value={username} onChange={v => setUsername(v.replace(/[^a-zA-Z0-9._]/g, ''))} error={errors.username} isRtl={isRtl}
            onKeyDown={e => e.key === "Enter" && handleNext()} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          />
        </div>
        <div className="animate-fade-in-up delay-4">
          <InputField label={T.email} placeholder="example@warif.sa" type="email" value={email} onChange={setEmail} error={errors.email} isRtl={isRtl}
            onKeyDown={e => e.key === "Enter" && handleNext()} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>}
          />
        </div>
        <div className="animate-fade-in-up delay-5">
          <InputField label={T.password} placeholder={T.passwordPlaceholder} type="password" value={password} onChange={setPassword} error={errors.password} isRtl={isRtl}
            onKeyDown={e => e.key === "Enter" && handleNext()} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
          />
        </div>
        <div className="animate-fade-in-up delay-6">
          <InputField label={T.confirmPassword} placeholder={T.passwordPlaceholder} type="password" value={confirm} onChange={setConfirm} error={errors.confirm} isRtl={isRtl}
            onKeyDown={e => e.key === "Enter" && handleNext()} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
          />
        </div>
      </div>

      <div className="animate-fade-in-up delay-7">
        <button
          onClick={handleNext}
          className="btn-primary w-full py-5 bg-emerald-800 text-white rounded-[24px] font-black text-lg shadow-xl hover:shadow-emerald-900/20 transition-all mt-4 tracking-tight"
        >
          {T.next}
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- SELECT MENU (PREMIUM CUSTOM) ----------------------------- */
const SelectMenu = ({ label, value, options, onChange, delayClass, isRtl, isOpen, onToggle }) => {
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col gap-1.5 ${isRtl ? 'text-right' : 'text-left'} animate-fade-in-up duration-500 ${delayClass} relative ${isOpen ? 'z-[1000]' : 'z-10'}`}
    >
       <label className={`text-[12px] font-black uppercase tracking-tight text-emerald-800/60 transition-colors ${isOpen ? 'text-emerald-600' : ''}`}>{label}</label>
       
       {/* Trigger */}
       <div 
         onClick={onToggle}
         className={`w-full bg-white/40 border-2 rounded-[20px] py-4 px-5 text-[14px] font-bold outline-none cursor-pointer transition-all duration-300 flex items-center justify-between group
                    ${isOpen ? 'border-emerald-500 bg-white shadow-xl shadow-emerald-500/10' : 'border-emerald-600/10 hover:border-emerald-200 hover:bg-white/60'}`}
       >
          <span className={isOpen ? 'text-emerald-900' : 'text-emerald-800/80'}>{value}</span>
          <div className={`transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`}>
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isOpen ? 'text-emerald-600' : 'text-gray-400 opacity-60'}><path d="M6 9l6 6 6-6"/></svg>
          </div>
       </div>

       {/* Options Dropdown - CODE Style */}
       {isOpen && (
         <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[1002] bg-white border border-emerald-100 rounded-[24px] overflow-hidden shadow-[0_15px_40px_-5px_rgba(0,0,0,0.12)] animate-scale-in origin-top p-2">
           <div className="max-h-[220px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
             {options.map((opt) => {
               const isSelected = value === opt;
               return (
                 <button
                   key={opt}
                   type="button"
                   onClick={() => { onChange(opt); onToggle(); }}
                   className={`w-full ${isRtl ? 'text-right' : 'text-left'} px-4 py-3.5 rounded-[16px] text-[13px] font-bold transition-all duration-300 flex items-center justify-between group/opt
                              ${isSelected 
                                 ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                                 : 'text-gray-700 hover:bg-emerald-50'}`}
                 >
                   <span>{opt}</span>
                   {isSelected ? (
                     <div className="animate-scale-bounce">
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                     </div>
                   ) : (
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-200 opacity-0 group-hover/opt:opacity-100 transition-opacity" />
                   )}
                 </button>
               );
             })}
           </div>
         </div>
       )}
    </div>
  );
};

/* ----------------------------- FARM INFO ----------------------------- */
function FarmInfoStep({ onNext, T, isRtl }) {
  const [farmType, setFarmType] = useState(isRtl ? 'محمية (مغلقة)' : 'Greenhouse (Closed)');
  const [cropType, setCropType] = useState(isRtl ? 'زراعة طبيعية' : 'Natural Farming');
  const [farmName, setFarmName] = useState('');
  const [error, setError] = useState('');
  const [activeMenu, setActiveMenu] = useState(null); // 'farmType' or 'cropType' or null

  const handleNext = () => {
    if (!farmName.trim()) { setError(T.errFarmNameRequired); return; }
    onNext({ farmType, cropType, farmName });
  };

  const toggleMenu = (menuId) => {
    setActiveMenu(prev => prev === menuId ? null : menuId);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center mb-1 animate-fade-in-up">
        <h1 className="text-xl font-black text-emerald-900 tracking-tight">{T.farmInfo}</h1>
        <p className="text-[11px] font-bold text-gray-400 mt-0.5">{T.step1of3}</p>
      </div>

      <div className="animate-fade-in-up delay-1">
        <InputField label={T.farmName} placeholder={T.farmNamePlaceholder} value={farmName} isRtl={isRtl}
          onChange={v => { setFarmName(v); setError(''); }} error={error}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>}
        />
      </div>

      <SelectMenu label={T.farmType} value={farmType} onChange={setFarmType} options={[T.farmTypeClosed, T.farmTypeOpen]} delayClass="delay-2" isRtl={isRtl} isOpen={activeMenu === 'farmType'} onToggle={() => toggleMenu('farmType')} />
      <SelectMenu label={T.cropType} value={cropType} onChange={setCropType} options={[T.cropNatural, T.cropOrganic, T.cropHydro]} delayClass="delay-3" isRtl={isRtl} isOpen={activeMenu === 'cropType'} onToggle={() => toggleMenu('cropType')} />

      <div className="animate-fade-in-up delay-4">
        <button onClick={handleNext} className="btn-primary w-full py-5 bg-emerald-800 text-white rounded-[24px] font-black text-lg shadow-xl hover:shadow-emerald-900/20 transition-all mt-4 tracking-tight">
          {T.continue}
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- SENSOR SELECTION ----------------------------- */
function SensorSelectionStep({ onNext, T }) {
  const devices = [
    { name: T.sensorTemp, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="#fee2e2" stroke="#ef4444" strokeWidth="2.2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>, key: "temp", desc: T.sensorTempDesc },
    { name: T.sensorHumidity, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2.2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>, key: "humidity", desc: T.sensorHumidityDesc },
    { name: T.sensorSoil, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="#dcfce7" stroke="#16a34a" strokeWidth="2.2"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/></svg>, key: "soil", desc: T.sensorSoilDesc },
    { name: T.sensorIrrigation, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="#ccfbf1" stroke="#0d9488" strokeWidth="2.2"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>, key: "irrigation", desc: T.sensorIrrigationDesc }
  ];
  const [selected, setSelected] = useState([]);
  const toggle = k => setSelected(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-black text-emerald-900 tracking-tight">{T.selectDevices}</h1>
        <p className="text-[12px] font-bold text-gray-400 mt-1">{T.step2of3}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {devices.map((d, i) => (
          <button
            key={d.key} onClick={() => toggle(d.key)}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-[24px] border-2 transition-all duration-500 animate-scale-bounce
                       ${selected.includes(d.key) 
                         ? 'bg-white border-emerald-500 shadow-lg shadow-emerald-500/5 ring-4 ring-emerald-500/5' 
                         : 'bg-gray-50/50 border-gray-100 hover:border-emerald-200 hover:bg-white'}`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className={`transition-transform duration-500 ${selected.includes(d.key) ? 'scale-105 rotate-3' : 'scale-90 opacity-60'}`}>{d.icon}</div>
            <span className={`text-[13px] font-black transition-colors ${selected.includes(d.key) ? 'text-emerald-900' : 'text-emerald-900/70'}`}>{d.name}</span>
            <span className={`text-[10px] font-bold px-1 text-center leading-tight transition-colors ${selected.includes(d.key) ? 'text-emerald-700/80' : 'text-gray-500'}`}>{d.desc}</span>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500 mt-1
                           ${selected.includes(d.key) ? 'bg-[var(--status-success)] scale-100 shadow-md' : 'bg-gray-200/50 scale-90'}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className={selected.includes(d.key) ? 'opacity-100' : 'opacity-0'}><path d="M20 6L9 17l-5-5"/></svg>
            </div>
          </button>
        ))}
      </div>

      <div className="text-center animate-fade-in-up py-2">
        <p className="text-[12px] font-semibold text-emerald-800/50 italic px-4 leading-relaxed">
          {T.addLater}
        </p>
      </div>

      <button onClick={() => onNext({ sensors: selected })} className="btn-primary w-full py-5 bg-emerald-800 text-white rounded-[24px] font-black text-lg shadow-xl shadow-emerald-900/10 transition-all">
        {selected.length > 0 ? T.continue : T.skip}
      </button>
    </div>
  );
}

/* ----------------------------- DEVICE SCAN ----------------------------- */
function DeviceScanPage({ onFinish, T, isRtl, selectedSensors }) {
  const [permissions, setPermissions] = useState({ wifi: true, bluetooth: false, location: false });
  const [selectedDevice, setSelectedDevice] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [foundDevices, setFoundDevices] = useState([]);
  const [connecting, setConnecting] = useState(null);
  const [selectedWifi, setSelectedWifi] = useState('Farm_Network_Primary');

  const wifiNetworks = ['Agri_Mesh_G1', 'Farm_Central_Wifi', 'Research_Lab_EXT'];
  const isScanEnabled = permissions.bluetooth && permissions.location;

  const handleScan = () => {
    if (!isScanEnabled) return;
    setScanning(true); setScanDone(false); setFoundDevices([]);
    setConnecting(null); setSelectedDevice('');
    
    setTimeout(() => {
      // Generic technical device discovery compatible with Warif System
      const results = ['Agri_Gateway_V2'];
      
      const sensorMap = { 
        temp: 'SensorNode_Temp_X', 
        humidity: 'Humid_Node_92', 
        soil: 'Soil_Probe_SN7', 
        irrigation: 'Ctrl_Valve_Master' 
      };

      selectedSensors.forEach(s => { if (sensorMap[s]) results.push(sensorMap[s]); });
      
      setFoundDevices(results);
      setScanning(false);
      setScanDone(true);
    }, 2800);
  };

  const handleConnect = (device) => {
    setConnecting(device);
    setSelectedDevice('');
    setTimeout(() => {
      setConnecting(null);
      setSelectedDevice(device);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-black text-emerald-900 tracking-tight">{T.pairDevices}</h1>
        <p className="text-[12px] font-bold text-gray-400 mt-1">{T.step3of3}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {Object.entries({ wifi: T.wifi, bluetooth: T.bluetooth, location: T.location }).map(([key, label], i) => (
          <div key={key} className="flex flex-col">
            <div className={`flex justify-between items-center px-5 py-3.5 rounded-[22px] transition-all duration-300 ${permissions[key] ? 'bg-emerald-50/50 border-emerald-200 shadow-sm' : 'bg-gray-50/50 border-gray-100'} border animate-fade-in-up ${isRtl ? 'flex-row-reverse' : ''}`}
              style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${permissions[key] ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-gray-100 text-gray-400'}`}>
                    {key === 'wifi' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12" y2="20"/></svg>}
                    {key === 'bluetooth' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m7 7 10 10-5 5V2l5 5L7 17"/></svg>}
                    {key === 'location' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
                </div>
                <span className="text-[14px] font-bold text-emerald-900">{label}</span>
              </div>
              <button
                onClick={() => setPermissions(p => ({ ...p, [key]: !p[key] }))}
                className={`w-12 h-7 rounded-full transition-all duration-300 relative ${permissions[key] ? 'bg-emerald-600' : 'bg-gray-200'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-1 shadow-md transition-all duration-300 ${permissions[key] ? (isRtl ? 'right-6' : 'left-6') : (isRtl ? 'right-1' : 'left-1')}`} />
              </button>
            </div>
            
            {key === 'wifi' && permissions.wifi && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto py-1 px-1 custom-scrollbar-hide h-8 items-center animate-fade-in no-scrollbar">
                {wifiNetworks.map(net => (
                  <button 
                    key={net}
                    onClick={() => setSelectedWifi(net)}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-black transition-all border 
                               ${selectedWifi === net ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white/80 border-emerald-50 text-emerald-800/60 hover:bg-white'}`}
                  >
                    {net}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="relative">
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-0">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full animate-radar" />
            <div className="w-40 h-40 bg-emerald-500/10 rounded-full animate-radar delay-300" />
          </div>
        )}
        
        <button onClick={handleScan} disabled={scanning || !isScanEnabled}
          className={`btn-primary w-full py-4 border-2 rounded-[24px] font-black text-sm flex items-center justify-center gap-3 transition-all relative z-10
                     ${isScanEnabled ? 'border-emerald-600 text-emerald-700 hover:bg-emerald-50 animate-scan-glow' : 'border-gray-200 text-gray-400 bg-gray-50 opacity-60'}`}>
          {scanning ? (
            <>
              <svg className="animate-spin h-5 w-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
              <span className="animate-pulse">{T.scanning}</span>
            </>
          ) : (
            <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg> {T.scanDevices}</>
          )}
        </button>
        
        {!isScanEnabled && !scanning && (
          <div className="text-[10px] text-red-500 font-bold text-center mt-2 animate-bounce">
            {isRtl ? 'يرجى تفعيل البلوتوث والموقع للبحث عن الأجهزة' : 'Please enable Bluetooth and Location to scan'}
          </div>
        )}
      </div>

      <div className="bg-gray-50/30 rounded-[28px] border border-gray-100 overflow-hidden min-h-[160px] flex flex-col shadow-inner shadow-black/5">
        <div className={`text-[11px] font-black text-emerald-800/40 px-5 py-3 border-b border-white/20 uppercase tracking-widest ${isRtl ? 'text-right' : 'text-left'}`}>{T.availableDevices}</div>
        <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar">
          {scanDone && foundDevices.length > 0 ? (
            foundDevices.map((d, i) => {
              const info = d === 'Agri_Gateway_V2' ? (isRtl ? 'جهاز التحكم المركزي' : 'Master Gateway Controller') : (isRtl ? 'حساس متوافق مع النظام' : 'Compatible System Sensor');
              return (
                <button key={d} onClick={() => handleConnect(d)}
                  disabled={scanning}
                  className={`w-full flex flex-col gap-1 px-5 py-4 transition-all animate-fade-in-up 
                             ${selectedDevice === d ? 'bg-emerald-600 text-white shadow-lg' : 'hover:bg-white/40 text-emerald-900'} ${isRtl ? 'text-right' : 'text-left'}`}
                  style={{ animationDelay: `${i * 100}ms` }}>
                  <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-2 h-2 rounded-full ${selectedDevice === d ? 'bg-white shadow-[0_0_10px_white]' : 'bg-emerald-400 animate-pulse'}`} />
                    <span className="font-black flex-1 text-sm">{d.replace(/_/g, ' ')}</span>
                    {connecting === d && <div className="w-5 h-5 border-2 border-emerald-300 border-t-white rounded-full animate-spin" />}
                    {selectedDevice === d && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <span className={`text-[10px] ${selectedDevice === d ? 'text-white/70' : 'text-gray-400'} font-bold`}>{info}</span>
                </button>
              );
            })
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-8 opacity-40">
               {scanning ? (
                 <div className="animate-pulse flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-3" />
                    <span className="text-[12px] font-bold">{isRtl ? 'جاري العثور على الأجهزة...' : 'Discovering...'}</span>
                 </div>
               ) : (
                 <>
                   <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2"><circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                   <span className="text-[12px] font-bold">{scanDone ? (isRtl ? 'لم يتم العثور على أجهزة مطابقة' : 'No matching devices found') : (isRtl ? 'يرجى بدء البحث للعثور على أجهزة' : 'Start scan to discover devices')}</span>
                 </>
               )}
            </div>
          )}
        </div>
      </div>

      <div className={`animate-fade-in-up transition-all duration-500 ${selectedDevice ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none h-0 p-0 overflow-hidden'}`}>
        <InputField label={T.deviceNameLabel} placeholder={T.deviceNamePlaceholder} value={deviceName} isRtl={isRtl}
          onChange={setDeviceName} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>}
        />
      </div>

      <button onClick={() => onFinish({ sensors: selectedSensors, linkedDevice: selectedDevice, deviceName, wifi: selectedWifi })} 
        className={`btn-primary w-full py-4 rounded-[24px] font-black text-lg transition-all duration-500
                   ${selectedDevice ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/30 grow-animation' : 'bg-emerald-800 text-white shadow-xl shadow-emerald-900/10'}`}>
        {selectedDevice ? T.connectAndEnter : T.skipAndEnter}
      </button>
    </div>
  );
}
