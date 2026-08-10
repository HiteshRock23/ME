/**
 * ME Native Platform Service
 * Single unified wrapper around Capacitor native APIs and Web fallbacks.
 * Desktop calls safely no-op or fallback to Web APIs without crashing.
 */

import { isNative } from './environment.js';
import { ShareTarget } from './native/share-target.js';

export const Native = {
    shareTarget: ShareTarget,
    async share({ title, text, url }) {
        if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Share) {
            try {
                return await window.Capacitor.Plugins.Share.share({ title, text, url, dialogTitle: 'Share Memory' });
            } catch (e) {
                console.warn('[Native.share] Capacitor share error:', e);
            }
        }
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                return await navigator.share({ title, text, url });
            } catch (e) {
                // User cancelled or share failed
            }
        }
        return false;
    },

    async clipboard(text) {
        if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Clipboard) {
            try {
                await window.Capacitor.Plugins.Clipboard.write({ string: text });
                return true;
            } catch (e) {
                console.warn('[Native.clipboard] Capacitor clipboard error:', e);
            }
        }
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) {
                console.warn('[Native.clipboard] Web clipboard error:', e);
            }
        }
        return false;
    },

    haptics() {
        if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Haptics) {
            try {
                window.Capacitor.Plugins.Haptics.impact({ style: 'LIGHT' });
                return true;
            } catch (e) {
                // Ignore haptic errors
            }
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
                navigator.vibrate(10);
                return true;
            } catch (e) {}
        }
        return false;
    },

    async keyboard(show = true) {
        if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Keyboard) {
            try {
                if (show) await window.Capacitor.Plugins.Keyboard.show();
                else await window.Capacitor.Plugins.Keyboard.hide();
                return true;
            } catch (e) {}
        }
        return false;
    },

    async networkStatus() {
        if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Network) {
            try {
                const status = await window.Capacitor.Plugins.Network.getStatus();
                return status.connected;
            } catch (e) {}
        }
        return typeof navigator !== 'undefined' ? navigator.onLine : true;
    },

    async getDeviceInfo() {
        if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Device) {
            try {
                return await window.Capacitor.Plugins.Device.getInfo();
            } catch (e) {}
        }
        return {
            platform: isNative() ? 'android' : 'web',
            isVirtual: false
        };
    },

    _splashHidden: false,

    async hideSplashScreen() {
        if (this._splashHidden) return;
        this._splashHidden = true;

        if (typeof window === 'undefined' || !window.Capacitor?.Plugins?.SplashScreen) {
            return; // No-op on web / desktop
        }

        console.log('[Native] Requesting SplashScreen.hide()...');
        try {
            await window.Capacitor.Plugins.SplashScreen.hide();
            console.log('[Native] SplashScreen hidden successfully.');
        } catch (e) {
            console.warn('[Native] SplashScreen hide failed:', e);
        }
    }
};

if (typeof window !== 'undefined') {
    window.Native = Native;

    // React to the canonical application-ready lifecycle signal.
    // This keeps the Native layer independent of startup orchestration:
    // it does not know how routing works, it only knows when the app is ready.
    window.addEventListener('app-ready', async () => {
        await Native.hideSplashScreen();
    }, { once: true });
}
