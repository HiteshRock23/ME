/**
 * Native Filesystem Wrapper Module
 * Placeholder wrapper for local device filesystem operations.
 */
export const NativeFilesystem = {
    isSupported() {
        return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isPluginAvailable('Filesystem');
    }
};
