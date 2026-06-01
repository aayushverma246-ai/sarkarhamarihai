import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';
import './index.css';
import { initNativePushNotifications } from './utils/pushNotifications';

// ── Capacitor native plugin initialization ──────────────────────────
async function initCapacitor() {
  try {
    const { Capacitor } = await import('@capacitor/core');

    if (Capacitor.isNativePlatform()) {
      // Mark body so CSS can target native-only styles
      document.body.classList.add('capacitor-app');

      // Status bar: transparent overlay on content
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      StatusBar.setStyle({ style: Style.Dark });
      StatusBar.setBackgroundColor({ color: '#080808' });

      // Handle Android back button: go back in router history or exit
      const { App: CapApp } = await import('@capacitor/app');
      let lastBackPress = 0;
      CapApp.addListener('backButton', ({ canGoBack }) => {
        const rootPaths = ['/dashboard', '/login', '/signup', '/'];
        const currentPath = window.location.pathname;
        const isRoot = rootPaths.includes(currentPath);

        if (canGoBack && !isRoot) {
          window.history.back();
        } else {
          const now = Date.now();
          if (now - lastBackPress < 2000) {
            CapApp.exitApp();
          } else {
            lastBackPress = now;

            // Render a beautiful, custom floating toast in the DOM!
            let toast = document.getElementById('cap-exit-toast');
            if (!toast) {
              toast = document.createElement('div');
              toast.id = 'cap-exit-toast';
              toast.className = 'fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[10000] bg-black/85 border border-white/10 text-white text-xs font-semibold px-5 py-3 rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 opacity-0 pointer-events-none tracking-wide';
              toast.innerText = 'Press back again to exit SarkarHamariHai';
              document.body.appendChild(toast);
            }

            // Trigger animation
            toast.style.opacity = '1';
            toast.style.transform = 'translate(-50%, -10px)';

            setTimeout(() => {
              if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translate(-50%, 0)';
              }
            }, 2000);
          }
        }
      });

      // Handle deep links (such as OAuth redirect callbacks)
      CapApp.addListener('appUrlOpen', async (event: any) => {
        const url = event.url;
        if (url && (url.includes('access_token') || url.includes('refresh_token'))) {
          // Dynamic extractor supporting both query params (?) and hash fragments (#)
          let tokenPart = '';
          if (url.includes('#')) {
            tokenPart = url.split('#')[1];
          } else if (url.includes('?')) {
            tokenPart = url.split('?')[1];
          }

          if (tokenPart) {
            const params = new URLSearchParams(tokenPart);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            if (access_token && refresh_token) {
              try {
                const { supabase } = await import('./utils/supabase');
                const { data, error } = await supabase.auth.setSession({
                  access_token,
                  refresh_token
                });
                if (!error && data?.user) {
                  const { api, setCachedUser } = await import('./api');
                  const result = await api.ensureProfile();
                  if (result?.user) {
                    setCachedUser(result.user);
                    window.location.href = '/dashboard';
                  }
                }
              } catch (err) {
                console.error('Deep link session error:', err);
              }
            }
          }
        }
      });

      // Hide splash screen after app renders
      const { SplashScreen } = await import('@capacitor/splash-screen');
      SplashScreen.hide();

      // Register device for lockscreen push notifications
      await initNativePushNotifications();
    }
  } catch (_) {
    // Not running in Capacitor — web browser, do nothing
  }
}

// ── Render the app ──────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);

// Initialize Capacitor after mount
initCapacitor();
