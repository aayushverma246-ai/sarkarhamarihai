import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import Logo from '../assets/logo';
import { useLanguage, LANGUAGE_NAMES, LangCode } from '../i18n/LanguageContext';
import { LANGUAGE_FLAGS } from '../i18n/translations';

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
    const fetchNotifs = () => api.getNotifications().then(n => setNotifCount(n.length)).catch(() => { });
    fetchNotifs();
    window.addEventListener('app:likeToggled', fetchNotifs);
    return () => window.removeEventListener('app:likeToggled', fetchNotifs);
  }, []);

  const active = (path: string) => location.pathname === path;

  const linkClass = (path: string) =>
    `px-3 py-1.5 rounded-md text-sm transition-colors ${active(path)
      ? 'bg-red-900/20 text-red-400 font-medium'
      : 'text-gray-500 hover:text-gray-300 hover:bg-[#151515]'
    }`;

  const handleLogout = () => {
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
    <nav className="bg-[#080808] border-b border-[#0f0f0f] sticky top-0 z-50 backdrop-blur-sm">
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
          <div className="hidden md:flex items-center gap-1">
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

              {langOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-[#111] border border-[#252525] rounded-lg shadow-2xl shadow-black/50 overflow-hidden z-[999] animate-slideDown">
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
                </div>
              )}
            </div>

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
            {firstName && (
              <span className="hidden sm:block text-xs text-gray-600 pl-2 border-l border-[#1a1a1a]">{firstName}</span>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-red-400 transition-colors rounded-md hover:bg-[#151515]"
            >
              {t('nav.signOut')}
            </button>

            {/* Mobile menu */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1.5 text-gray-500 hover:text-gray-300 rounded-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="animate-slideDown md:hidden border-t border-[#111] py-2 space-y-0.5">
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
                className={`block px-3 py-2 rounded-md text-sm ${active(path) ? 'bg-red-900/20 text-red-400' : 'text-gray-500 hover:text-gray-300 hover:bg-[#151515]'}`}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
