/**
 * Native Camera Wrapper Module
 * Placeholder wrapper for future camera & photo capture.
 */
export const NativeCamera = {
    isSupported() {
        return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isPluginAvailable('Camera');
    },

    async takePhoto() {
        console.log('[NativeCamera] Placeholder takePhoto called');
        return null;
    }
};
