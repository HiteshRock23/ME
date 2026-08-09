/**
 * Google Auth Entry Point (Platform Abstraction Proxy)
 * Delegates authentication to GoogleProvider (Web GIS or Native Capacitor GoogleAuth).
 */

import { GoogleProvider, initGoogleAuth, renderGoogleButton, signInWithGoogle, signOutGoogle } from "./auth/google-provider.js";

export { initGoogleAuth, renderGoogleButton, signInWithGoogle, signOutGoogle, GoogleProvider };

// Automatically initialize Google Auth on module load
initGoogleAuth("module_load");

// Re-render when auth-screen is shown
if (typeof window !== 'undefined') {
    window.addEventListener("auth-screen-shown", () => {
        console.log("[google.js] Event 'auth-screen-shown' received. Refreshing Google Auth button...");
        initGoogleAuth("event:auth-screen-shown");
    });
}
