import { auth } from "./auth.js";
import { ui } from "./ui.js";

let googleClientId = null;
let isInitialized = false;

export async function initGoogleAuth() {
    try {
        console.log("[GIS TRACE] Fetching Google config...");
        const res = await fetch("/api/auth/google/config/");
        if (!res.ok) {
            console.warn("[GIS TRACE] Google Client ID endpoint failed or not configured.");
            return;
        }
        
        const data = await res.json();
        googleClientId = data.client_id;
        console.log("[GIS TRACE] Obtained Client ID:", googleClientId);
        
        if (!googleClientId) {
            console.warn("[GIS TRACE] Google Client ID is empty.");
            return;
        }

        setupGIS();
    } catch (e) {
        console.error("[GIS TRACE] Failed to initialize Google Auth:", e);
    }
}

function setupGIS() {
    const initialize = () => {
        if (!isInitialized && window.google && window.google.accounts && window.google.accounts.id) {
            console.log("[GIS TRACE] Initializing google.accounts.id...");
            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: handleGoogleCredentialResponse,
                auto_select: false,
                cancel_on_tap_outside: false
            });
            isInitialized = true;
        }
        renderGoogleButton();
    };

    if (window.google && window.google.accounts && window.google.accounts.id) {
        initialize();
    } else {
        let attempts = 0;
        const interval = setInterval(() => {
            if (window.google && window.google.accounts && window.google.accounts.id) {
                clearInterval(interval);
                initialize();
            } else if (attempts > 30) {
                clearInterval(interval);
                console.warn("[GIS TRACE] Google Identity Services script not loaded.");
            }
            attempts++;
        }, 100);
    }
}

export function renderGoogleButton() {
    if (!isInitialized || !window.google || !window.google.accounts || !window.google.accounts.id) return;

    const container = document.getElementById("google-btn-container");
    if (!container) return;

    try {
        console.log("[GIS TRACE] Rendering Google button into container...");
        container.innerHTML = "";
        window.google.accounts.id.renderButton(
            container,
            { theme: "filled_black", shape: "pill", size: "large", width: 280, text: "continue_with" }
        );
    } catch (err) {
        console.error("[GIS TRACE] GSI render error:", err);
    }
}

// Re-render when auth-screen is shown
window.addEventListener("auth-screen-shown", () => {
    if (isInitialized) {
        renderGoogleButton();
    } else {
        initGoogleAuth();
    }
});

async function handleGoogleCredentialResponse(response) {
    console.log("[GIS TRACE] handleGoogleCredentialResponse CALLED with response:", response);
    try {
        ui.clearError();
        
        console.log("[GIS TRACE] Sending POST to /api/auth/google/...");
        const res = await fetch("/api/auth/google/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ credential: response.credential }),
        });

        console.log("[GIS TRACE] Response status from /api/auth/google/:", res.status);

        if (!res.ok) {
            let msg = "Google Login failed.";
            try {
                const data = await res.json();
                msg = data.detail || msg;
                console.error("[GIS TRACE] Backend error data:", data);
            } catch(e) {}
            throw new Error(msg);
        }

        const data = await res.json();
        console.log("[GIS TRACE] Received tokens from backend:", data);
        auth.setTokens(data.access, data.refresh);
        console.log("[GIS TRACE] Tokens stored. Navigating to dashboard...");
        
        window.location.href = "/dashboard";
    } catch (e) {
        console.error("[GIS TRACE] Google Auth error:", e);
        ui.showError(e.message);
    }
}
