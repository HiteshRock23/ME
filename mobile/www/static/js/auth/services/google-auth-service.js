import { auth } from "../../auth.js";
import { ui } from "../../ui.js?v=3";
import { analytics } from "../../analytics.js";
import { network } from "../../network.js";
import { PLATFORM } from "../../environment.js";

let googleClientId = null;

export const GoogleAuthService = {
    async fetchConfig() {
        if (googleClientId) return googleClientId;
        try {
            console.log(`[GoogleAuthService] Fetching Google config from /api/auth/google/config/...`);
            const data = await network.get("/api/auth/google/config/", { skipAuth: true });
            googleClientId = data.client_id;
            console.log(`[GoogleAuthService] Obtained Client ID:`, googleClientId);
            return googleClientId;
        } catch (e) {
            console.warn(`[GoogleAuthService] Failed to fetch Google Client ID:`, e.message || e);
            throw e;
        }
    },

    getClientId() {
        return googleClientId;
    },

    async processGoogleCredential(credentialToken, platformOverride = PLATFORM) {
        console.log(`[GoogleAuthService] Processing Google credential for platform: ${platformOverride}...`);
        const loginStartTime = performance.now();
        analytics.capture('Google Login Started', { platform: platformOverride });
        
        try {
            ui.clearError();
            
            console.log(`[GoogleAuthService] Sending POST /api/auth/google/...`);
            const data = await network.post("/api/auth/google/", { credential: credentialToken }, { skipAuth: true });

            console.log(`[GoogleAuthService] Received tokens from backend for user:`, data.user?.email);
            auth.setTokens(data.access, data.refresh);
            
            if (data.user) {
                analytics.identifyUser(data.user);
            }
            analytics.capture('Google Login Success', {
                platform: platformOverride,
                duration_ms: performance.now() - loginStartTime
            });
            
            console.log(`[GoogleAuthService] Tokens stored. Navigating to /dashboard...`);
            sessionStorage.setItem('me_just_logged_in', 'true');
            window.location.href = "/dashboard";
            return data;
        } catch (e) {
            console.error(`[GoogleAuthService] Backend Google Auth error:`, e);
            analytics.capture('Google Login Failed', {
                platform: platformOverride,
                error_message: e.message || 'Unknown error',
                duration_ms: performance.now() - loginStartTime
            });
            ui.showError(e.message || "Google authentication failed.");
            throw e;
        }
    }
};
