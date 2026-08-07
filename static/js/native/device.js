/**
 * Native Device Wrapper Module
 * Exposes device info (platform, model, OS version, app version).
 * Gracefully degrades on standard web browsers.
 */
export const NativeDevice = {
    isNative() {
        return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
    },

    async getInfo() {
        if (this.isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.Device) {
            return await window.Capacitor.Plugins.Device.getInfo();
        }
        return {
            platform: 'web',
            model: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
            osVersion: 'unknown',
            appVersion: '1.0.0'
        };
    }
};
