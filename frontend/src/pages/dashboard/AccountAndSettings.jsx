import { useState } from 'react';
import { translations } from '../../i18n';
import { 
  Account_Card, 
  Account_EditableField, 
  Account_ListRow, 
  Account_IconButton, 
  Account_ModalShell, 
  Account_PencilIcon, 
  Account_TrashIcon, 
  Account_PlusIcon, 
  Account_SensorIcon 
} from './DashboardShared';
import { guides } from './GuidesContent';
import { updateUser, getMe, deleteAccount, getFarms } from '../../services/api';
import { fetchWithRetry, getAuthHeaders, apiConfig } from '../../config/api';
import { useEffect } from 'react';

export function AccountAndSettingsPages({ initialPage = "profile", onBack, onLogout, onNameUpdate, sensors: propSensors, onSensorsChange, language: currentLang, onLanguageChange }) {

  const [page, setPage] = useState(initialPage);
  const [showToast, setShowToast] = useState(false);
  const [showPasswordDraft, setShowPasswordDraft] = useState(false);
  const [userFarms, setUserFarms] = useState([]);
  const [editingFarm, setEditingFarm] = useState(null);
  const [farmDraft, setFarmDraft] = useState('');

  const triggerToast = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const lang = currentLang || 'ar';
  const isEn = lang === 'en';
  const isRtl = !isEn;

  // Local T for this page
  const T = {
    profile: isEn ? "My Profile" : "الملف الشخصي",
    settings: isEn ? "System Settings" : "إعدادات النظام",
    account: isEn ? "Account" : "الحساب",
    sensors: isEn ? "Hardware" : "العتاد",
    profileSub: isEn ? "Personl data and authentication" : "بياناتك الشخصية ووسائل المصادقة المباشرة",
    settingsSub: isEn ? "Customize sensors and Warif AI" : "تخصيص الحساسات وأتمتة وارِف الذكية",
    admin: isEn ? "System Admin" : "مشرف النظام",
    fullName: isEn ? "Full Name" : "الاسم المعتمد",
    username: isEn ? "Username" : "اسم المستخدم",
    email: isEn ? "Email Address" : "البريد الإلكتروني",
    password: isEn ? "Password" : "رمز المرور",
    sensorsTitle: isEn ? "Sensors & Hardware Management" : "إدارة الحساسات والأجهزة",
    sensorsSub: isEn ? "Control equipment connected to Warif center" : "التحكم في العتاد المتصل بمركز وارِف",
    addSensor: isEn ? "Add Sensor" : "إضافة حساس",
    userGuide: isEn ? "Warif User Guide" : "دليل المستخدم",
    userGuideSub: isEn ? "How to use the dashboard and basic functions" : "شرح استخدام لوحة التحكم والوظائف الأساسية",
    sustainability: isEn ? "Digital Sustainability Guide" : "دليل الاستدامة الرقمي",
    sustainabilitySub: isEn ? "How to optimize resources and protect crops" : "كيفية تحسين استهلاك الموارد وحماية المحصول",
    openGuide: isEn ? "Open Guide" : "فتح الدليل",
    logout: isEn ? "Sign Out from Warif" : "تسجيل الخروج من وارِف",
    save: isEn ? "Save Changes" : "حفظ التغييرات",
    cancel: isEn ? "Cancel" : "إلغاء",
    updateData: isEn ? "Update Information" : "تحديث البيانات",
    placeholder: isEn ? "Enter new value..." : "أدخل القيمة الجديدة...",
    addHardware: isEn ? "Add New Hardware" : "إضافة عتاد جديد",
    updateSensor: isEn ? "Update Sensor Data" : "تحديث بيانات الحساس",
    setupDevice: isEn ? "Install Device" : "تثبيت الجهاز",
    sensorLabel: isEn ? "Device Label" : "المسمى التعريفي",
    sensorKind: isEn ? "Unit / Sensor Type" : "نوع الوحدة / الحساس",
    langLabel: isEn ? "System Language" : "لغة النظام",
    langDesc: isEn ? "Change interface and logic language" : "تغيير لغة الواجهة والمنطق",
  };

  const savedUser = JSON.parse(localStorage.getItem('warif_user') || '{}');

  const [profile, setProfile] = useState({
    fullName: savedUser.fullName || savedUser.full_name || "",
    fullNameEn: savedUser.fullNameEn || savedUser.full_name_en || "",
    username: savedUser.username || "",
    email: savedUser.email || "",
    password: savedUser.password || "********",
    farmName: savedUser.farmName || "",
    farmType: savedUser.farmType || "",
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getMe();
        setProfile({
          fullName: data.full_name || "",
          fullNameEn: data.full_name_en || "",
          username: data.username || "",
          email: data.email || "",
          password: "********",
        });

        try {
          const farms = await getFarms();
          setUserFarms(farms || []);
        } catch { setUserFarms([]); }

      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    }
    loadProfile();
  }, []);

  const [editingField, setEditingField] = useState(null);
  const [draftValue, setDraftValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeFarm, setActiveFarm] = useState(0);
  const [showUnifiedGuide, setShowUnifiedGuide] = useState(false);
  const userLang = lang || 'ar';
  const t = (window.localStorage.getItem('warif_user') && JSON.parse(window.localStorage.getItem('warif_user')).language === 'en') ? guides['en'] : guides['ar'];

  const sensors = propSensors || [];

  const [sensorModal, setSensorModal] = useState({
    open: false,
    mode: "add",
    id: null,
    name: "",
    type: "",
  });

  function openEdit(fieldKey) {
    setEditingField(fieldKey);
    setDraftValue(profile[fieldKey] || "");
    setShowPasswordDraft(false);
  }

  function closeEdit() {
    setEditingField(null);
    setDraftValue("");
  }

  async function saveEdit() {
    if (!editingField) return;
    const newValue = draftValue.trim();
    
    // Validation
    if (!newValue) {
      setErrorMsg(translations[lang].errFieldEmpty);
      return;
    }
    if (editingField === 'email' && !/\S+@\S+\.\S+/.test(newValue)) {
      setErrorMsg(translations[lang].errEmailInvalid);
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const updateData = {};
      if (editingField === 'fullName') updateData.full_name = newValue;
      else if (editingField === 'fullNameEn') updateData.full_name_en = newValue;
      else updateData[editingField] = newValue;

      const updatedUser = await updateUser(updateData);
      
      setProfile((p) => ({ ...p, [editingField]: newValue }));
      const saved = JSON.parse(localStorage.getItem('warif_user') || '{}');
      localStorage.setItem('warif_user', JSON.stringify({ 
        ...saved, 
        ...updatedUser,
        fullName: updatedUser.full_name,
        fullNameEn: updatedUser.full_name_en
      }));
      
      if ((editingField === 'fullName' || editingField === 'fullNameEn') && onNameUpdate) {
        onNameUpdate(newValue, editingField === 'fullNameEn');
      }
      
      triggerToast();
      closeEdit();
    } catch (err) {
      setErrorMsg(isEn ? "Failed to save changes" : "فشل حفظ التغييرات");
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteAccount = async () => {
    const ok = confirm(isEn ? "WARNING: This will permanently delete your account and all farm data. This action cannot be undone. Are you sure?" : "تحذير: سيؤدي هذا إلى حذف حسابك وكافة بيانات المزارع بشكل نهائي. لا يمكن التراجع عن هذا الإجراء. هل أنت متأكد؟");
    if (!ok) return;
    
    setLoading(true);
    try {
      await deleteAccount();
      localStorage.clear();
      onLogout?.();
    } catch (err) {
      setErrorMsg(isEn ? "Failed to delete account" : "فشل حذف الحساب");
    } finally {
      setLoading(false);
    }
  };

  const openFarmEdit = (farm) => {
    setEditingFarm(farm);
    setFarmDraft(farm.name);
  };

  const saveFarmName = async () => {
    if (!editingFarm || !farmDraft.trim()) return;
    try {
      await fetchWithRetry(
        `${apiConfig.baseURL}/api/v1/farms/${editingFarm.id}`,
        {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            ...getAuthHeaders() 
          },
          body: JSON.stringify({ name: farmDraft.trim() })
        }
      );
      setUserFarms(prev => prev.map(f => 
        f.id === editingFarm.id ? { ...f, name: farmDraft.trim() } : f
      ));
      setEditingFarm(null);
      triggerToast();
    } catch {
      console.error('Failed to update farm name');
    }
  };

  function openAddSensor() {
    setSensorModal({ open: true, mode: "add", id: null, name: "", type: "" });
  }

  function openEditSensor(item) {
    setSensorModal({ open: true, mode: "edit", id: item.id, name: item.name, type: item.type });
  }

  function closeSensorModal() {
    setSensorModal({ open: false, mode: "add", id: null, name: "", type: "" });
  }

  function saveSensorModal() {
    const name = sensorModal.name.trim();
    const type = sensorModal.type.trim();
    if (!name || !type) return;

    let updated;
    if (sensorModal.mode === "add") {
      const newId = `S${Math.floor(Math.random() * 9000 + 1000)}`;
      updated = [{ id: newId, name, type }, ...sensors];
    } else {
      updated = sensors.map((s) => (s.id === sensorModal.id ? { ...s, name, type } : s));
    }

    onSensorsChange?.(updated);
    triggerToast();
    closeSensorModal();
  }

  function deleteSensor(id) {
    const ok = confirm(isEn ? "Are you sure you want to delete this sensor?" : "هل تريد حذف هذا الحساس بصورة نهائية؟");
    if (!ok) return;
    onSensorsChange?.(sensors.filter((s) => s.id !== id));
  }

  return (
    <div className="relative w-full h-full bg-[#f7f7f4] font-['IBM_Plex_Sans_Arabic'] overflow-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-3xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-100/50">
              {page === "profile" 
                ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              }
            </div>
            <div className={isRtl ? 'text-right' : 'text-left'}>
              <h1 className="text-xl font-black text-gray-800 tracking-tight leading-tight">{T[page]}</h1>
              <p className="text-[12px] font-medium text-gray-400 mt-1">{page === "profile" ? T.profileSub : T.settingsSub}</p>
            </div>
          </div>
          <button onClick={onBack} className="p-2.5 rounded-xl bg-white border border-gray-100 shadow-sm text-gray-500 hover:text-emerald-600 transition-all active:scale-95">
             <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={isEn ? 'rotate-180' : ''}><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="bg-white/50 p-1.5 rounded-2xl border border-gray-100 flex gap-2 w-max mx-auto md:mx-0">
          <button onClick={() => setPage("profile")}
            className={`px-8 py-2.5 rounded-xl text-[13px] font-black transition-all ${page === "profile" ? "bg-white text-emerald-700 shadow-sm border border-emerald-50" : "text-gray-400 hover:text-emerald-600"}`}>
            {T.profile}
          </button>
          <button onClick={() => setPage("settings")}
            className={`px-8 py-2.5 rounded-xl text-[13px] font-black transition-all ${page === "settings" ? "bg-white text-emerald-700 shadow-sm border border-emerald-50" : "text-gray-400 hover:text-emerald-600"}`}>
            {T.settings}
          </button>
        </div>

        {page === "profile" ? (
          <div className="flex flex-col gap-5 animate-fade-in-up">
              <div className="animate-fade-in-up delay-1">
                <Account_Card className="relative overflow-hidden card-interactive">
                  <div className={`absolute top-0 ${isRtl ? 'right-0 -mr-10' : 'left-0 -ml-10'} w-32 h-32 bg-emerald-50/30 rounded-full blur-3xl -mt-10`} />
                  <div className={`flex items-center gap-5 relative z-10 ${isRtl ? 'text-right' : 'text-left'}`}>
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-400 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-emerald-200/50">
                      {(profile.fullName || profile.username || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className={isRtl ? 'text-right' : 'text-left'}>
                      <h2 className="text-xl font-black text-gray-800">{profile.fullName || profile.username}</h2>
                      <p className="text-sm font-bold text-gray-400 mt-1">{profile.email}</p>
                    </div>
                  </div>
                </Account_Card>
              </div>

              <div className="animate-fade-in-up delay-2">
                <Account_Card className="card-interactive">
                  <h3 className={`text-[15px] font-black text-gray-800 mb-5 pb-2 border-b border-gray-50 uppercase tracking-tighter ${isRtl ? 'text-right' : 'text-left'}`}>{isEn ? 'Basic Data' : 'البيانات الأساسية'}</h3>
                  <div className="flex flex-col gap-4">
                    <Account_EditableField T={translations[lang]} isRtl={isRtl} label={translations[lang].fullName} value={profile.fullName} onEdit={() => openEdit("fullName")} />
                    <Account_EditableField T={translations[lang]} isRtl={isRtl} label={translations[lang].fullNameEn} value={profile.fullNameEn} onEdit={() => openEdit("fullNameEn")} />
                    <Account_EditableField T={translations[lang]} isRtl={isRtl} label={T.username} value={profile.username} onEdit={() => openEdit("username")} />
                    <Account_EditableField T={translations[lang]} isRtl={isRtl} label={T.email} value={profile.email} onEdit={() => openEdit("email")} />
                    <Account_EditableField T={translations[lang]} isRtl={isRtl} label={T.password} value="********" onEdit={() => openEdit("password")} />
                  </div>
                </Account_Card>
              </div>

              <div className="animate-fade-in-up delay-3">
                <div className="rounded-3xl border border-gray-100 bg-white shadow-sm p-5 flex flex-col gap-3">
                  <h3 className="text-sm font-black text-gray-700 text-right">
                    {isEn ? 'My Greenhouses' : 'محمياتي'}
                  </h3>
                  
                  {userFarms.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">
                      {isEn ? 'No greenhouses found' : 'لا توجد محميات مسجلة'}
                    </p>
                  )}
                  
                  {userFarms.map((farm) => (
                    <div key={farm.id} 
                      className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0">
                      <button
                        onClick={() => openFarmEdit(farm)}
                        className="text-xs text-emerald-600 font-black hover:text-emerald-800 transition-colors"
                      >
                        {isEn ? 'Edit' : 'تعديل'}
                      </button>
                      <div className="text-right">
                        <p className="text-sm font-black text-gray-800">{farm.name}</p>
                        <p className="text-[10px] text-gray-400 uppercase">{farm.farm_type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="animate-fade-in-up delay-4">
                <button 
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className={`w-full p-4 rounded-2xl bg-white border border-red-100 text-red-600 font-black text-[13px] hover:bg-red-50 transition-all flex items-center justify-center gap-3 shadow-sm card-interactive ${loading ? 'opacity-50' : ''}`}
                >
                  <Account_TrashIcon />
                  {isEn ? "Delete Account Permanently" : "حذف الحساب نهائياً"}
                </button>
              </div>
          </div>
        ) : (
            <div className="flex flex-col gap-5">
              {/* Language Switch Card */}
              <div className="animate-fade-in-up delay-1">
                <Account_Card className="card-interactive">
                  <div className={`flex items-center justify-between`}>
                      <div className={isRtl ? 'text-right' : 'text-left'}>
                        <div className="text-lg font-bold text-gray-800 tracking-tight">{T.langLabel}</div>
                        <div className="text-[12px] font-medium text-gray-400 mt-0.5">{T.langDesc}</div>
                      </div>
                      <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                        <button onClick={() => onLanguageChange?.('ar')} className={`px-4 py-1.5 rounded-lg text-[12px] font-black transition-all ${lang === 'ar' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-400'}`}>عربي</button>
                        <button onClick={() => onLanguageChange?.('en')} className={`px-4 py-1.5 rounded-lg text-[12px] font-black transition-all ${lang === 'en' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-400'}`}>English</button>
                      </div>
                  </div>
                </Account_Card>
              </div>

              <div className="animate-fade-in-up delay-2">
                <Account_Card className="card-interactive">
                  <div className={`flex items-center justify-between mb-6`}>
                    <div className={isRtl ? 'text-right' : 'text-left'}>
                      <div className="text-lg font-bold text-gray-800 tracking-tight">{T.sensorsTitle}</div>
                      <div className="text-[12px] font-medium text-gray-400 mt-1">{T.sensorsSub}</div>
                    </div>
                    <button onClick={openAddSensor} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 transition-all shadow-md shadow-emerald-100">
                      <Account_PlusIcon /> {T.addSensor}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sensors.map((s, idx) => (
                      <div key={s.id} className={`p-4 rounded-2xl border border-gray-100 bg-white/50 hover:border-emerald-200 transition-all flex items-center justify-between group animate-fade-in-up`} style={{ animationDelay: `${idx * 50}ms` }}>
                        <div className={`flex items-center gap-3`}>
                          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors">
                            <Account_SensorIcon />
                          </div>
                          <div className={isRtl ? 'text-right' : 'text-left'}>
                            <div className="text-[13px] font-black text-gray-800">{s.name}</div>
                            <div className="text-[12px] font-bold text-gray-400">{s.type} • {s.id}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Account_IconButton onClick={() => openEditSensor(s)}><Account_PencilIcon /></Account_IconButton>
                          <Account_IconButton danger onClick={() => deleteSensor(s.id)}><Account_TrashIcon /></Account_IconButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </Account_Card>
              </div>

              {/* Unified Guide Card */}
              <div className="animate-fade-in-up delay-3">
                <Account_Card className="card-interactive">
                  <div className={`flex flex-col md:flex-row items-center justify-between gap-6 p-2`}>
                    <div className={`flex items-center gap-5 ${isRtl ? 'text-right' : 'text-left'}`}>
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm transition-transform hover:scale-105">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-800 tracking-tight">{T.userGuide}</div>
                        <div className="text-[12px] font-medium text-gray-400 mt-1 max-w-sm">{isEn ? 'A comprehensive guide for the system and sustainability.' : 'الدليل المتكامل لقواعد التشغيل وأسس الاستدامة الرقمية.'}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowUnifiedGuide(true)} 
                      className="whitespace-nowrap px-8 py-3 rounded-2xl bg-emerald-600 text-white font-black text-[14px] hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                    >
                      {T.openGuide}
                    </button>
                  </div>
                </Account_Card>
              </div>

              <div className="animate-fade-in-up delay-4">
                <button 
                  onClick={() => { localStorage.removeItem('warif_remember'); onLogout?.(); }}
                  className={`w-full p-4 rounded-2xl bg-white border border-red-50 text-red-500 font-black text-[14px] hover:bg-red-50 transition-all flex items-center justify-center gap-3 shadow-sm card-interactive`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={isRtl ? 'rotate-180' : ''}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  {T.logout}
                </button>
              </div>
            </div>
          )}
        </div>
      {/* Unified Master Guide Modal */}
      {showUnifiedGuide && (
        <Account_ModalShell onClose={() => setShowUnifiedGuide(false)} isRtl={isRtl}>
           <div className={`bg-white rounded-3xl shadow-2xl border border-gray-100 w-[440px] max-w-[92vw] overflow-hidden animate-modal-in flex flex-col h-[460px] ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
              <div className="p-5 bg-emerald-600 text-white relative">
                 <button onClick={() => setShowUnifiedGuide(false)} className={`absolute top-6 ${isRtl ? 'left-6' : 'right-6'} p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all z-10`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                 </button>
                 <div className="flex items-center gap-3.5 mb-1.5">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 20H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                    </div>
                    <div>
                       <h2 className="text-xl font-black">{guides[lang].masterGuide.title}</h2>
                       <p className="text-emerald-100 text-xs font-bold font-sans uppercase tracking-[0.15em]">{isEn ? 'Interactive Knowledge Hub' : 'مركز المعرفة التفاعلي لوارِف'}</p>
                    </div>
                 </div>
              </div>
              <div className="flex-1 overflow-auto p-4 flex flex-col gap-4 custom-scrollbar">
                 {guides[lang].masterGuide.sections.map((section, idx) => (
                   <div key={section.id} className="flex flex-col gap-1.5 group animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                      <div className={`flex items-center gap-3 ${isEn ? 'flex-row' : ''}`}>
                         <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                            {idx + 1}
                         </div>
                         <h3 className={`text-[14.5px] font-black text-gray-800 ${isEn ? 'text-left' : 'text-right'}`}>{section.title}</h3>
                      </div>
                      <p className={`text-[11.5px] text-gray-400 font-bold leading-relaxed ${isEn ? 'pl-9 text-left' : 'pr-9 text-right'}`}>
                         {section.content}
                      </p>
                      {idx < guides[lang].masterGuide.sections.length - 1 && (
                        <div className={`h-px bg-gray-50 mt-2 ${isEn ? 'ml-9' : 'mr-9'}`} />
                      )}
                   </div>
                 ))}
                 
                 {/* Decorative Footer inside modal */}
                 <div className={`mt-2 p-4 bg-emerald-50 rounded-[20px] border border-emerald-100 flex items-center gap-4 ${isEn ? 'text-left' : 'text-right'}`}>
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </div>
                    <div>
                       <div className="text-[13px] font-black text-emerald-900 mb-0.5">{isEn ? 'Digital Twin Verified' : 'تم التحقق بواسطة التوأم الرقمي'}</div>
                       <div className="text-xs font-bold text-emerald-700/70">{isEn ? 'Your farm data is handled with maximum privacy and intelligence.' : 'يتم التعامل مع بيانات مزرعتك بأعلى مستويات الخصوصية والذكاء الإصطناعي.'}</div>
                    </div>
                 </div>
              </div>
              <div className={`p-4 bg-white border-t border-gray-50 flex justify-end`}>
                 <button onClick={() => setShowUnifiedGuide(false)} className="px-8 py-2.5 rounded-[18px] bg-emerald-600 text-white font-black text-[13px] shadow-lg shadow-emerald-100 active:scale-95 transition-all">
                    {isEn ? 'Got it' : 'فهمت ذلك'}
                 </button>
              </div>
           </div>
        </Account_ModalShell>
      )}

      {/* Profile Edit Modal */}
      {editingField && (
        <Account_ModalShell onClose={closeEdit}>
          <div className={`bg-white rounded-3xl shadow-2xl border border-gray-100 w-[420px] max-w-[92vw] p-6 animate-modal-in ${isEn ? 'text-left' : 'text-right'}`}>
            <h3 className="text-[16px] font-black text-gray-800 mb-6">{T.updateData}</h3>
            <div className="flex flex-col gap-4">
              <div className="relative">
                <input
                  value={draftValue}
                  onChange={(e) => { setDraftValue(e.target.value); setErrorMsg(""); }}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                  type={editingField === 'password' ? (showPasswordDraft ? 'text' : 'password') : 'text'}
                  className={`w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all font-bold ${isEn ? 'text-left' : 'text-right'} ${editingField === 'password' ? (isRtl ? 'pl-12' : 'pr-12') : ''}`}
                  placeholder={T.placeholder}
                  autoFocus
                />
                {editingField === 'password' && (
                  <button
                    type="button"
                    onClick={() => setShowPasswordDraft(v => !v)}
                    className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'left-3' : 'right-3'} text-gray-400 hover:text-emerald-600 transition-colors p-1`}
                  >
                    {showPasswordDraft ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                )}
              </div>
              {errorMsg && <p className="text-[11px] font-bold text-red-500 mt-1">{errorMsg}</p>}
              <div className={`flex gap-2 mt-2 ${isEn ? 'flex-row-reverse' : ''}`}>
                 <button 
                  onClick={saveEdit} 
                  disabled={loading}
                  className={`flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2 ${loading ? 'opacity-70' : ''}`}
                 >
                   {loading && <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>}
                   {T.save}
                 </button>
                 <button onClick={closeEdit} className="px-6 py-3 bg-gray-50 text-gray-500 rounded-2xl font-black text-sm hover:bg-gray-100 transition-all">{T.cancel}</button>
              </div>
            </div>
          </div>
        </Account_ModalShell>
      )}

      {/* Sensor Modal */}
      {sensorModal.open && (
        <Account_ModalShell onClose={closeSensorModal}>
          <div className={`bg-white rounded-3xl shadow-2xl border border-gray-100 w-[400px] max-w-[92vw] p-6 animate-modal-in ${isEn ? 'text-left' : 'text-right'}`}>
            <h3 className="text-[17px] font-black text-gray-800 mb-6">{sensorModal.mode === "add" ? T.addHardware : T.updateSensor}</h3>
            <div className="flex flex-col gap-4">
               <div>
                  <label className="text-[12px] font-black text-gray-400 mb-2 block uppercase tracking-tighter">{T.sensorLabel}</label>
                  <input
                    value={sensorModal.name}
                    onChange={(e) => setSensorModal(m => ({ ...m, name: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && saveSensorModal()}
                    className={`w-full px-4 py-3 rounded-2xl border border-gray-200 focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none font-bold ${isEn ? 'text-left' : 'text-right'}`}
                  />
               </div>
               <div>
                  <label className="text-[12px] font-black text-gray-400 mb-2 block uppercase tracking-tighter">{T.sensorKind}</label>
                  <input
                    value={sensorModal.type}
                    onChange={(e) => setSensorModal(m => ({ ...m, type: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && saveSensorModal()}
                    className={`w-full px-4 py-3 rounded-2xl border border-gray-200 focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none font-bold ${isEn ? 'text-left' : 'text-right'}`}
                  />
               </div>
               <div className={`flex gap-2 mt-4 ${isEn ? 'flex-row-reverse' : ''}`}>
                 <button onClick={saveSensorModal} className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-200 transition-all active:scale-95">{T.setupDevice}</button>
                 <button onClick={closeSensorModal} className="px-6 py-3 bg-gray-50 text-gray-500 rounded-2xl font-black text-sm hover:bg-gray-100 transition-all">{T.cancel}</button>
              </div>
            </div>
          </div>
        </Account_ModalShell>
      )}
      {/* Success Toast */}
      {showToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-toast-in">
           <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md border border-white/20">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <span className="text-sm font-black tracking-tight">{translations[lang].saveSuccess}</span>
           </div>
        </div>
      )}

      {editingFarm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setEditingFarm(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-gray-800 text-right text-base">
              {isEn ? 'Edit Greenhouse Name' : 'تعديل اسم المحمية'}
            </h3>
            <input
              value={farmDraft}
              onChange={e => setFarmDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveFarmName()}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 font-bold text-right transition-all"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setEditingFarm(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-600 font-black text-sm hover:bg-gray-200 transition-colors">
                {isEn ? 'Cancel' : 'إلغاء'}
              </button>
              <button onClick={saveFarmName} className="flex-1 py-3 rounded-2xl bg-gradient-to-l from-emerald-800 to-emerald-600 text-white font-black text-sm shadow-lg hover:opacity-90 transition-opacity">
                {isEn ? 'Save' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
