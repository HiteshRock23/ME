/**
 * Native Keyboard Wrapper Module
 * UI-agnostic wrapper emitting keyboardWillShow and keyboardWillHide events.
 * Does NOT manipulate DOM elements directly.
 */
export const NativeKeyboard = {
    isNative() {
        return typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
    },

    async addListener(eventName, callback) {
        if (this.isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard) {
            return await window.Capacitor.Plugins.Keyboard.addListener(eventName, callback);
        }
        return { remove: () => {} };
    },

    async hide() {
        if (this.isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard) {
            await window.Capacitor.Plugins.Keyboard.hide();
        }
    }
};
