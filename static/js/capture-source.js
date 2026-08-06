/**
 * Centralized CaptureSource Enumeration
 * Keeps frontend capture sources in sync with backend Memory.CaptureSource choices.
 */
export const CaptureSource = Object.freeze({
    MANUAL: 'MANUAL',
    WEB_SHARE: 'WEB_SHARE',
    ANDROID_SHARE: 'ANDROID_SHARE',
    EXTENSION: 'EXTENSION',
    DESKTOP: 'DESKTOP',
    API: 'API',
    IMPORT: 'IMPORT',
});
