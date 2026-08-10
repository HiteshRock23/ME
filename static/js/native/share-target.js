/**
 * ME Native Share Target Service
 * Safe JS wrapper over Capacitor native ShareTarget plugin.
 */

export const ShareTarget = {
    async getPendingShare() {
        if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.ShareTarget) {
            try {
                const res = await window.Capacitor.Plugins.ShareTarget.getPendingShare();
                if (res && res.hasShare && res.share) {
                    return res.share;
                }
            } catch (e) {
                console.warn('[ShareTarget] getPendingShare error:', e);
            }
        }
        return null;
    },

    async clearPendingShare() {
        if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.ShareTarget) {
            try {
                await window.Capacitor.Plugins.ShareTarget.clearPendingShare();
            } catch (e) {
                console.warn('[ShareTarget] clearPendingShare error:', e);
            }
        }
    },

    addListener(callback) {
        if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.ShareTarget) {
            try {
                return window.Capacitor.Plugins.ShareTarget.addListener('onShareReceived', (shareData) => {
                    if (typeof callback === 'function') {
                        callback(shareData);
                    }
                });
            } catch (e) {
                console.warn('[ShareTarget] addListener error:', e);
            }
        }
        return null;
    }
};

if (typeof window !== 'undefined') {
    window.ShareTarget = ShareTarget;
}
