import { GoogleAuthService } from "../services/google-auth-service.js";

let isInitialized = false;
let googleClientId = null;

export const GoogleWebProvider = {
    async initialize() {
        if (isInitialized) return true;
        try {
            googleClientId = await GoogleAuthService.fetchConfig();
            if (!googleClientId) return false;
            
            this.setupGIS();
            return true;
        } catch (e) {
            console.warn("[GoogleWebProvider] Initialization error:", e);
            return false;
        }
    },

    setupGIS() {
        const initializeGIS = () => {
            if (!isInitialized && window.google && window.google.accounts && window.google.accounts.id) {
                console.log("[GoogleWebProvider] Initializing window.google.accounts.id...");
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: (response) => this.handleCredentialResponse(response),
                    auto_select: false,
                    cancel_on_tap_outside: false
                });
                isInitialized = true;
                console.log("[GoogleWebProvider] GIS successfully initialized.");
            }
            this.renderButton();
        };

        if (window.google && window.google.accounts && window.google.accounts.id) {
            initializeGIS();
        } else {
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if (window.google && window.google.accounts && window.google.accounts.id) {
                    clearInterval(interval);
                    initializeGIS();
                } else if (attempts > 30) {
                    clearInterval(interval);
                    console.warn("[GoogleWebProvider] Google Identity Services script not loaded.");
                }
            }, 100);
        }
    },

    renderButton(containerId = "google-btn-container") {
        if (!isInitialized || !window.google || !window.google.accounts || !window.google.accounts.id) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            console.log(`[GoogleWebProvider] Rendering GIS button into #${containerId}...`);
            container.innerHTML = "";
            window.google.accounts.id.renderButton(
                container,
                { theme: "filled_black", shape: "pill", size: "large", width: 280, text: "continue_with" }
            );
        } catch (err) {
            console.error("[GoogleWebProvider] GSI render error:", err);
        }
    },

    async handleCredentialResponse(response) {
        console.log("[GoogleWebProvider] handleCredentialResponse received credential token.");
        if (!response || !response.credential) {
            console.warn("[GoogleWebProvider] No credential received in GIS response.");
            return;
        }
        return await GoogleAuthService.processGoogleCredential(response.credential, "WEB");
    },

    async signIn() {
        if (!isInitialized) {
            await this.initialize();
        }
        if (window.google && window.google.accounts && window.google.accounts.id) {
            window.google.accounts.id.prompt();
        } else {
            console.warn("[GoogleWebProvider] GIS not available for signIn prompt.");
        }
    },

    async signOut() {
        if (window.google && window.google.accounts && window.google.accounts.id) {
            window.google.accounts.id.disableAutoSelect();
        }
    }
};
