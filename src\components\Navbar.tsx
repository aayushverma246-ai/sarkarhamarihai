import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import { supabase } from '../utils/supabase';
import Logo from '../assets/logo';
import { useLanguage, LANGUAGE_NAMES, LangCode } from '../i18n/LanguageContext';
import { LANGUAGE_FLAGS } from '../i18n/translations';
import { Capacitor } from '@capacitor/core';
import { Home, Compass, Bell, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  user: any;
}

export default function Navbar({ user }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [notifCount, setNotifCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('sarkar_theme') || 'dark');
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const isNative = Capacitor.isNativePlatform();
  const lastTab = localStorage.getItem('dashboard_last_tab') || 'all';

  useEffect(() => {
    if (isNative) {
      let showListener: any;
      let hideListener: any;
      
      const initKeyboard = async () => {
        try {
          const { Keyboard } = await import('@capacitor/keyboard');
          showListener = await Keyboard.addListener('keyboardWillShow', () => {
            setKeyboardVisible(true);
          });
          hideListener = await Keyboard.addListener('keyboardWillHide', () => {
            setKeyboardVisible(false);
          });
        } catch (_) {}
      };

      initKeyboard();

      return () => {
        if (showListener) showListener.remove();
        if (hideListener) hideListener.remove();
      };
    }
  }, [isNative]);

  const tabs = [
    { path: `/dashboard?tab=${lastTab}`, label: t('nav.dashboard'), icon: Home, badge: 0 },
    { path: '/tracker', label: t('nav.tracker'), icon: Compass, badge: 0 },
    { path: '/notifications', label: t('nav.notifications'), icon: Bell, badge: notifCount },
    { path: '/profile', label: t('nav.profile'), icon: User, badge: 0 }
  ];

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [theme]);

  // Close language dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = (e: React.MouseEvent) => {
    const next = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('sarkar_theme', next);

    if (!document.startViewTransition) {
      setTheme(next);
      return;
    }

    // Get exact click coordinates for fluid ripple origin
    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    document.documentElement.classList.add('theme-transitioning');
    const transition = document.startViewTransition(() => {
      if (next === 'light') {
        document.documentElement.classList.add('light-mode');
      } else {
        document.documentElement.classList.remove('light-mode');
      }
      flushSync(() => {
        setTheme(next);
      });
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 600,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)"
        }
      );
    });

    // Clean up marker class after animation finishes
    transition.finished.then(() => {
      document.documentElement.classList.remove('theme-transitioning');
    });
  };

  useEffect(() => {
    const fetchNotifs = () => api.getNotificationCount().then(r => setNotifCount(r?.count || 0)).catch(() => { });
    fetchNotifs();
    window.addEventListener('app:likeToggled', fetchNotifs);
    window.addEventListener('app:notificationReceived', fetchNotifs);
    return () => {
      window.removeEventListener('app:likeToggled', fetchNotifs);
      window.removeEventListener('app:notificationReceived', fetchNotifs);
    };
  }, []);

  const active = (path: string) => location.pathname === path;

  const linkClass = (path: string) =>
    `px-3 py-1.5 rounded-md text-sm transition-colors ${active(path)
      ? 'bg-red-900/20 text-red-400 font-medium'
      : 'text-gray-500 hover:text-gray-300 hover:bg-[#151515]'
    }`;

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (_) { /* non-critical */ }
    clearToken();
    if (document.startViewTransition) {
      document.startViewTransition(() => navigate('/login'));
    } else {
      navigate('/login');
    }
  };

  const firstName = (typeof user?.full_name === 'string') ? user.full_name.split(' ')[0] : '';

  const langCodes = Object.keys(LANGUAGE_NAMES) as LangCode[];

  return (
    <>
      <nav className="cap-safe-top bg-[#080808] border-b border-[#0f0f0f] sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link
              to={`/dashboard?tab=${localStorage.getItem('dashboard_last_tab') || 'all'}`}
              viewTransition
              className="flex items-center gap-2 font-bold text-gray-200 hover:text-white transition-colors text-sm"
            >
              <Logo size={28} />
              <span className="hidden sm:block">SarkarHamariHai</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-1">
              <Link to={`/dashboard?tab=${localStorage.getItem('dashboard_last_tab') || 'all'}`} viewTransition className={linkClass('/dashboard')}>{t('nav.dashboard')}</Link>
              <Link to="/tracker" viewTransition className={linkClass('/tracker')}>{t('nav.tracker')}</Link>
              <Link to="/profile" viewTransition className={linkClass('/profile')}>{t('nav.profile')}</Link>
              <Link to="/notifications" viewTransition className={`${linkClass('/notifications')} relative`}>
                {t('nav.notifications')}
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-700 text-[9px] font-bold text-white">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </Link>
              <Link to="/admin" viewTransition className={linkClass('/admin')}>{t('nav.manage')}</Link>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Global Controls (Language & Theme) — compact, always visible in header */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Language Switcher */}
                <div className="relative" ref={langRef}>
                  <button
                    onClick={() => setLangOpen(!langOpen)}
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-white transition-colors rounded-md hover:bg-[#151515] border border-transparent hover:border-[#252525]"
                    title={t('lang.select')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                    <span className="hidden sm:inline">{LANGUAGE_NAMES[language]}</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {langOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 top-full mt-1 w-44 bg-[#111] border border-[#252525] rounded-lg shadow-2xl shadow-black/50 overflow-hidden z-[999]"
                      >
                        <div className="py-1 max-h-72 overflow-y-auto">
                          {langCodes.map((code) => (
                            <button
                              key={code}
                              onClick={() => { setLanguage(code); setLangOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${language === code
                                  ? 'bg-red-900/20 text-red-400 font-medium'
                                  : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                                }`}
                            >
                              <span className="text-base">{LANGUAGE_FLAGS[code]}</span>
                              <span>{LANGUAGE_NAMES[code]}</span>
                              {language === code && (
                                <svg className="w-3.5 h-3.5 ml-auto text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Theme Toggle */}
                <button
                  onClick={toggleTheme}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-md hover:bg-[#151515]"
                  title={theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}
                >
                  {theme === 'light' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Auth and Sign Out elements — hidden on mobile to prevent clutter */}
              <div className="hidden lg:flex items-center gap-1 sm:gap-2 pl-2 border-l border-[#1c1c24]">
                {firstName && (
                  <span className="hidden sm:block text-xs text-gray-600 pr-2">{firstName}</span>
                )}
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-red-400 transition-colors rounded-md hover:bg-[#151515]"
                >
                  {t('nav.signOut')}
                </button>
              </div>

              {/* Mobile menu button (3 lines) — visible on all mobile layouts */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden relative w-9 h-9 flex flex-col justify-center items-center rounded-xl hover:bg-[#151515] active:scale-90 transition-all duration-200"
                aria-label="Toggle navigation menu"
              >
                <div className="flex flex-col gap-1.5 w-5">
                  <span className={`h-0.5 w-full bg-gray-400 rounded-full transition-all duration-300 origin-center ${mobileOpen ? 'rotate-45 translate-y-[6px] bg-red-400' : ''}`} />
                  <span className={`h-0.5 w-full bg-gray-400 rounded-full transition-all duration-300 ${mobileOpen ? 'opacity-0 scale-0' : ''}`} />
                  <span className={`h-0.5 w-full bg-gray-400 rounded-full transition-all duration-300 origin-center ${mobileOpen ? '-rotate-45 -translate-y-[6px] bg-red-400' : ''}`} />
                </div>
              </button>
            </div>
          </div>

          {/* Mobile menu dropdown — fully custom, startup-grade controls */}
          <AnimatePresence>
            {mobileOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden lg:hidden border-t border-[#141414] bg-[#080808e0] backdrop-blur-xl border-b border-[#141414] w-full"
              >
                <div className="py-4 px-5 space-y-4">
                  {/* Core Nav Links */}
                  <div className="space-y-1">
                    {[
                      { path: '/dashboard', label: t('nav.dashboard') },
                      { path: '/tracker', label: t('nav.tracker') },
                      { path: '/profile', label: t('nav.profile') },
                      { path: '/notifications', label: `${t('nav.notifications')}${notifCount > 0 ? ` (${notifCount})` : ''}` },
                      { path: '/admin', label: t('nav.manage') },
                    ].map(({ path, label }) => (
                      <Link
                        key={path}
                        to={path === '/dashboard' ? `/dashboard?tab=${localStorage.getItem('dashboard_last_tab') || 'all'}` : path}
                        onClick={() => setMobileOpen(false)}
                        className={`block px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                          active(path) 
                            ? 'bg-red-900/20 text-red-400 font-bold shadow-sm' 
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
                        }`}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>

                  {/* User Profile / Logout */}
                  <div className="border-t border-[#141414] pt-3 flex items-center justify-between">
                    {firstName ? (
                      <span className="text-xs text-gray-500 font-medium">Signed in as {firstName}</span>
                    ) : (
                      <span className="text-xs text-gray-500 font-medium">Guest User</span>
                    )}
                    <button
                      onClick={handleLogout}
                      className="px-3.5 py-1.5 text-xs bg-red-600/10 border border-red-500/20 text-red-400 font-bold rounded-xl hover:bg-red-600/20 active:scale-95 transition-all"
                    >
                      {t('nav.signOut')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Floating glassmorphic bottom navigation tab bar for Native Mobile */}
      <AnimatePresence>
        {isNative && !keyboardVisible && (
          <motion.div 
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            style={{
              position: 'fixed',
              bottom: '16px',
              left: '16px',
              right: '16px',
              zIndex: 999
            }}
            className="native-bottom-bar bg-[#0c0c0cc0] border border-white/5 rounded-2xl backdrop-blur-xl px-2 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center justify-around cap-safe-bottom"
          >
            {tabs.map((tab) => {
              const activeTab = location.pathname === tab.path.split('?')[0];
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className="flex flex-col items-center gap-1 py-1 px-3.5 rounded-xl transition-all duration-300 relative active:scale-95 duration-150 select-none"
                >
                  {activeTab && (
                    <div
                      className="absolute inset-0 bg-white/5 rounded-xl animate-scaleIn"
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center gap-1">
                    <tab.icon className={`w-5 h-5 transition-transform duration-300 ${activeTab ? 'animate-heartbeat text-red-500' : 'text-gray-400'}`} />
                    {tab.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[8px] font-black text-white notif-badge">
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="relative z-10 text-[9px] font-black tracking-widest uppercase transition-colors mt-0.5">{tab.label}</span>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
