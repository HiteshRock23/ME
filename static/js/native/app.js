/**
 * Native App Wrapper Module
 * Emits pure platform events (appStateChange, backButton) and handles app exit/splash.
 * Strictly platform-focused: contains NO business, API, or authentication logic.
 */
export const NativeApp = {
    isNative() {
        return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
    },

    async addListener(eventName, callback) {
        if (this.isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            return await window.Capacitor.Plugins.App.addListener(eventName, callback);
        }
        return { remove: () => {} };
    },

    async exitApp() {
        if (this.isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
            return await window.Capacitor.Plugins.App.exitApp();
        }
    },

    async hideSplashScreen() {
        if (this.isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen) {
            try {
                await window.Capacitor.Plugins.SplashScreen.hide();
            } catch (e) {
                console.warn('[NativeApp] SplashScreen hide error:', e);
            }
        }
    }
};
