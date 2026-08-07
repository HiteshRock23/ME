import { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration for ME Mobile Native Shell
 * Configures SplashScreen, StatusBar, Keyboard, and environment-driven server settings.
 */
const isDevelopment = process.env.NODE_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'com.me.memory.app',
  appName: 'ME — Your AI Memory',
  webDir: 'www',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    allowNavigation: ['accounts.google.com', '*.google.com', 'google.com'],
    cleartext: isDevelopment,
    ...(isDevelopment && process.env.CAPACITOR_SERVER_URL ? { url: process.env.CAPACITOR_SERVER_URL } : {})
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '801509973157-xxxxxxxx.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    },
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: '#0A0A0A',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashImmersive: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0A0A',
      overlaysWebView: false
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true
    }
  }
};

export default config;
