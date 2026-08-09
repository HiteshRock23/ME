/**
 * Native Clipboard Wrapper Module
 * Placeholder wrapper for clipboard reading and writing.
 */
export const NativeClipboard = {
    async writeText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        return false;
    },

    async readText() {
        if (navigator.clipboard && navigator.clipboard.readText) {
            return await navigator.clipboard.readText();
        }
        return '';
    }
};
