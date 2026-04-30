import { useState } from 'react'
import SignIn from './pages/dashboard/SignIn'
import Dashboard from './pages/dashboard/Dashboard'

export default function App() {
  const [screen, setScreen] = useState(() => {
    return localStorage.getItem('warif_logged_in') === 'true' ? 'dashboard' : 'login';
  });
  const [lang, setLang] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('warif_user') || '{}');
    return saved.language || 'ar';
  });

  function handleLangChange(newLang) {
    setLang(newLang);
    const saved = JSON.parse(localStorage.getItem('warif_user') || '{}');
    localStorage.setItem('warif_user', JSON.stringify({ ...saved, language: newLang }));
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {screen === 'login' && (
        <SignIn onLogin={() => setScreen('dashboard')} lang={lang} onLangChange={handleLangChange} />
      )}
      {screen === 'dashboard' && (
        <Dashboard onLogout={() => setScreen('login')} lang={lang} onLangChange={handleLangChange} />
      )}
    </div>
  )
}