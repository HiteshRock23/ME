/**
 * Native Share Wrapper Module
 * Provides unified interface for native Android share targets and navigator.share.
 * Gracefully degrades on standard web browsers.
 */
export const NativeShare = {
    isNative() {
        return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
    },

    async share({ title = 'ME Memory', text = '', url = '' } = {}) {
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({ title, text, url });
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }
};
