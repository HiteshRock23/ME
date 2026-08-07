/**
 * Native RevenueCat Wrapper Module
 * Placeholder wrapper for future native purchases & subscriptions.
 * Gracefully degrades on standard web browsers.
 */
export const NativeRevenueCat = {
    isSupported() {
        return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isPluginAvailable('Purchases');
    },

    async configure(apiKey) {
        console.log('[NativeRevenueCat] Placeholder configure called with key:', apiKey);
    },

    async getCustomerInfo() {
        return null;
    }
};
