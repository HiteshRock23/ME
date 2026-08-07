/**
 * Native Network Wrapper Module
 * Monitors connectivity status and emits networkStatusChange events.
 * Gracefully degrades on standard web browsers.
 */
export const NativeNetwork = {
    isNative() {
        return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
    },

    async getStatus() {
        if (this.isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.Network) {
            return await window.Capacitor.Plugins.Network.getStatus();
        }
        return { connected: typeof navigator !== 'undefined' ? navigator.onLine : true, connectionType: 'unknown' };
    },

    async addListener(callback) {
        if (this.isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.Network) {
            return await window.Capacitor.Plugins.Network.addListener('networkStatusChange', callback);
        }

        if (typeof window !== 'undefined') {
            const onOnline = () => callback({ connected: true, connectionType: 'wifi' });
            const onOffline = () => callback({ connected: false, connectionType: 'none' });
            window.addEventListener('online', onOnline);
            window.addEventListener('offline', onOffline);
            return {
                remove: () => {
                    window.removeEventListener('online', onOnline);
                    window.removeEventListener('offline', onOffline);
                }
            };
        }

        return { remove: () => {} };
    }
};
