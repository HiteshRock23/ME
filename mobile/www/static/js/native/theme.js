/**
 * Native Theme Wrapper Module
 * Centralized logic for initializing Status Bar and System Navigation Bar appearance.
 * Gracefully degrades on standard web browsers.
 */
export const NativeTheme = {
    isNative() {
        return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
    },

    async applyDarkTheme() {
        if (this.isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar) {
            try {
                await window.Capacitor.Plugins.StatusBar.setStyle({ style: 'DARK' });
                await window.Capacitor.Plugins.StatusBar.setBackgroundColor({ color: '#0A0A0A' });
                await window.Capacitor.Plugins.StatusBar.setOverlaysWebView({ overlay: false });
            } catch (e) {
                console.warn('[NativeTheme] StatusBar config error:', e);
            }
        }
    }
};
