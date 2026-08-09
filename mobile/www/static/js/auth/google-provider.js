import { isNative } from "../environment.js";
import { GoogleWebProvider } from "./providers/google-web-provider.js";
import { GoogleNativeProvider } from "./providers/google-native-provider.js";

function getActiveProvider() {
    return isNative() ? GoogleNativeProvider : GoogleWebProvider;
}

export const GoogleProvider = {
    async initialize(caller = "unknown") {
        const providerName = isNative() ? "NATIVE (ANDROID/IOS)" : "WEB (GIS)";
        console.log(`[GoogleProvider] Initializing auth provider: [${providerName}] called by [${caller}]...`);
        
        const activeProvider = getActiveProvider();
        const success = await activeProvider.initialize();
        this.renderButton();
        return success;
    },

    renderButton(containerId = "google-btn-container") {
        const activeProvider = getActiveProvider();
        activeProvider.renderButton(containerId);
    },

    async signIn() {
        const activeProvider = getActiveProvider();
        return await activeProvider.signIn();
    },

    async signOut() {
        const activeProvider = getActiveProvider();
        return await activeProvider.signOut();
    }
};

export async function initGoogleAuth(caller = "unknown") {
    return await GoogleProvider.initialize(caller);
}

export function renderGoogleButton(caller = "unknown") {
    GoogleProvider.renderButton();
}

export async function signInWithGoogle() {
    return await GoogleProvider.signIn();
}

export async function signOutGoogle() {
    return await GoogleProvider.signOut();
}
