/**
 * ME Environment Layer
 * Pure environment detection, configuration resolution, capability discovery, and feature flags.
 * 
 * Single Responsibility: Environment & Configuration only.
 * Dependencies: None. Does NOT import network, auth, fetch, or UI.
 */

export const APP_CONFIG = {
    version: '1.0.0',
    apiVersion: 'v1',
    developmentBackend: 'http://10.0.2.2:8000',
    productionBackend: 'https://me.lyrprompt.cloud',
    stagingBackend: 'https://staging.me.lyrprompt.cloud',
    debug: true
};

function detectPlatform() {
    if (typeof window === 'undefined') return 'WEB';

    const cap = window.Capacitor;
    if (cap && typeof cap.getPlatform === 'function') {
        const p = cap.getPlatform();
        if (p === 'android') return 'ANDROID';
        if (p === 'ios') return 'IOS';
    }
    if (cap && cap.platform) {
        if (cap.platform === 'android') return 'ANDROID';
        if (cap.platform === 'ios') return 'IOS';
    }
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
        return 'ANDROID';
    }

    if (window.location.hostname === 'localhost' && window.location.protocol === 'https:') {
        return 'ANDROID';
    }

    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        return 'PWA';
    }

    return 'WEB';
}

function detectEnvironment() {
    if (typeof window === 'undefined') return 'production';

    const isLocalhost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    const isHttp = window.location.protocol === 'http:';

    if (isLocalhost && isHttp) {
        return 'development';
    }

    if (window.location.hostname.includes('staging')) {
        return 'staging';
    }

    return 'production';
}

// function resolveApiBase() {
//     const platform = detectPlatform();
//     const environment = detectEnvironment();

//     if (platform === 'ANDROID' || platform === 'IOS') {
//         return APP_CONFIG.productionBackend;
//     }

//     if (typeof window !== 'undefined' && window.location && window.location.origin) {
//         return window.location.origin;
//     }

//     return APP_CONFIG.productionBackend;
// }

function resolveApiBase() {
    const platform = detectPlatform();

    // During development, Android emulator talks to the host machine
    if (platform === 'ANDROID' || platform === 'IOS') {
        return APP_CONFIG.developmentBackend;
    }

    if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return window.location.origin;
    }

    return APP_CONFIG.productionBackend;
}

export function isDevelopment() {
    return detectEnvironment() === 'development';
}

export function isProduction() {
    return detectEnvironment() === 'production';
}

export function isNative() {
    const platform = detectPlatform();
    return platform === 'ANDROID' || platform === 'IOS';
}

export function validateConfig() {
    const apiBase = resolveApiBase();
    const env = detectEnvironment();

    if (!apiBase) {
        throw new Error("[Config Error] Invalid configuration: API_BASE is missing.");
    }

    if (env === 'production' && !apiBase.startsWith('https://') && !apiBase.includes('localhost')) {
        console.warn("[Config Warning] Production environment detected without HTTPS protocol:", apiBase);
    }

    return true;
}

function discoverCapabilities() {
    if (typeof window === 'undefined') {
        return {
            share: false,
            clipboard: false,
            haptics: false,
            camera: false,
            notifications: false,
            biometrics: false,
            filesystem: false
        };
    }

    const platform = detectPlatform();
    const native = platform === 'ANDROID' || platform === 'IOS';

    return {
        share: typeof navigator !== 'undefined' && Boolean(navigator.share || native),
        clipboard: typeof navigator !== 'undefined' && Boolean(navigator.clipboard),
        haptics: native || (typeof navigator !== 'undefined' && Boolean(navigator.vibrate)),
        camera: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
        notifications: typeof window !== 'undefined' && 'Notification' in window,
        biometrics: native,
        filesystem: native
    };
}

export const FeatureFlags = {
    voiceCapture: false,
    nativeShareTarget: true,
    revenueCat: false,
    askMev2: false,
    experimentalSearch: false
};

export const PLATFORM = detectPlatform();
export const ENVIRONMENT = detectEnvironment();
export const API_BASE = resolveApiBase();
export const Capabilities = discoverCapabilities();

console.log("========== ENVIRONMENT ==========");
console.log("Platform:", PLATFORM);
console.log("Environment:", ENVIRONMENT);
console.log("API_BASE:", API_BASE);
console.log("=================================");



APP_CONFIG.debug = ENVIRONMENT === 'development';

validateConfig();

/**
 * Builds a full API URL given a relative endpoint path.
 * @param {string} path 
 * @param {string} [version]
 * @returns {string}
 */
export function buildApiUrl(path, version = null) {
    if (!path) return API_BASE;
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    if (version) {
        return `${API_BASE}/api/${version}${cleanPath.replace(/^\/api\//, '/')}`;
    }

    return `${API_BASE}${cleanPath}`;
}

export const ENV = {
    PLATFORM,
    ENVIRONMENT,
    API_BASE,
    APP_CONFIG,
    Capabilities,
    FeatureFlags,
    isDevelopment,
    isProduction,
    isNative,
    buildApiUrl,
    validateConfig
};

if (typeof window !== 'undefined') {
    window.ENV = ENV;
    window.buildApiUrl = buildApiUrl;
    window.isDevelopment = isDevelopment;
    window.isProduction = isProduction;
    window.isNative = isNative;
}
