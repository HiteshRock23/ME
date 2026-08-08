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
  server: {
    androidScheme: 'https',
    allowNavigation: ['accounts.google.com', '*.google.com', 'google.com'],
    cleartext: isDevelopment,
    ...(isDevelopment && process.env.CAPACITOR_SERVER_URL ? { url: process.env.CAPACITOR_SERVER_URL } : {})
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      clientId: '801509973157-k8sabl6gkamg3uuoh6ssl546e1hls6a6.apps.googleusercontent.com',
      serverClientId: '801509973157-gfvt981m9tl29hkvj4sue73mmu5ji018.apps.googleusercontent.com',
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
