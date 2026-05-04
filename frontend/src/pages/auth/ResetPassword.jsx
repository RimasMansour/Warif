import React, { useState } from "react";
import { resetPassword } from "../../services/api";

export default function ResetPassword({ onBack, isRtl, T }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setError(isRtl ? "يرجى إدخال البريد الإلكتروني" : "Please enter your email");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await resetPassword(email);
      setDone(true);
    } catch (err) {
      setError(isRtl ? "حدث خطأ أثناء الطلب" : "An error occurred during request");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 animate-fade-in-up">
        <div className="w-24 h-24 bg-emerald-50 rounded-[32px] flex items-center justify-center mb-8 shadow-sm border border-emerald-100/50 relative">
          <div className="absolute inset-0 bg-emerald-500/10 rounded-[32px] animate-pulse"></div>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="relative z-10">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-gray-800 tracking-tight mb-4">
          {isRtl ? 'تم إرسال التعليمات' : 'Instructions Sent'}
        </h2>
        <p className="text-[15px] font-semibold text-gray-500 mb-10 max-w-[280px] leading-relaxed mx-auto">
          {isRtl 
            ? "يرجى التحقق من بريدك الإلكتروني لاتباع خطوات استعادة كلمة المرور." 
            : "Please check your email to follow the password recovery steps."}
        </p>
        <button
          onClick={onBack}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[15px] rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-200"
        >
          {isRtl ? 'العودة لتسجيل الدخول' : 'Back to Login'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-black text-emerald-900 tracking-tight">{isRtl ? 'استعادة كلمة المرور' : 'Reset Password'}</h1>
        <p className="text-[13px] font-bold text-gray-400 mt-1">
          {isRtl ? 'أدخل بريدك الإلكتروني المسجل لإرسال رابط الاستعادة' : 'Enter your registered email to receive a reset link'}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-black uppercase tracking-tight text-emerald-800/60">{isRtl ? 'البريد الإلكتروني' : 'Email Address'}</label>
          <div className="relative group">
            <div className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-gray-400 opacity-60 group-focus-within:text-emerald-500 transition-colors`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className={`w-full bg-white border-2 rounded-[20px] py-4 text-[14px] font-bold outline-none transition-all duration-300 ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-emerald-500'}`}
              placeholder="example@warif.sa"
              autoFocus
            />
          </div>
          {error && <p className="text-[11px] font-bold text-red-500 mt-1">{error}</p>}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-5 bg-emerald-800 text-white rounded-[24px] font-black text-lg shadow-xl hover:shadow-emerald-900/20 transition-all flex items-center justify-center gap-3"
        >
          {loading ? (
            <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
          ) : (
            <>
              {isRtl ? 'إرسال الرابط' : 'Send Reset Link'}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={isRtl ? 'rotate-180' : ''}><path d="M15 18l-6-6 6-6" /></svg>
            </>
          )}
        </button>

        <button
          onClick={onBack}
          className="w-full py-4 text-emerald-800/40 hover:text-emerald-700 transition-all font-black uppercase tracking-widest text-[12px]"
        >
          {isRtl ? 'العودة لتسجيل الدخول' : 'Back to Login'}
        </button>
      </div>
    </div>
  );
}
