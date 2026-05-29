import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';
import './index.css';

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
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          CapApp.exitApp();
        }
      });

      // Hide splash screen after app renders
      const { SplashScreen } = await import('@capacitor/splash-screen');
      SplashScreen.hide();
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
