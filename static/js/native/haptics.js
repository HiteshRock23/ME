/**
 * Native Haptics Wrapper Module
 * Placeholder wrapper for future haptic feedback.
 */
export const NativeHaptics = {
    isSupported() {
        return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isPluginAvailable('Haptics');
    },

    async vibrate() {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(15);
        }
    }
};
