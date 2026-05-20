import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sarkarhamarihai.app',
  appName: 'SarkarHamariHai',
  webDir: 'dist',
  server: {
    // Use a consistent hostname so localStorage/cookies persist
    hostname: 'sarkarhamarihai.app',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#080808',
      showSpinner: true,
      spinnerColor: '#ef4444',
      androidSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#080808',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true, // Remove in production
  },
};

export default config;
