/**
 * ME Application Configuration
 *
 * Single source of truth for all externally-referenced URLs.
 * To update the APK for a new release, change LATEST_ANDROID_APK_URL here only.
 */
export const CONFIG = {
    /** Google Form used for all feedback + early access sign-ups across the product. */
    EARLY_ACCESS_FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLSfwYygBbrkdoEmdkfZR8U5XplwUdxuv1nVUbRV6f-uQrY0jWA/viewform?usp=dialog",

    /** Hosted Android release APK — Developer Preview v1.0.0. Relative path works on both localhost and production VPS. */
    LATEST_ANDROID_APK_URL: "/downloads/ME-1.0.3.apk?v=1.0.3",

    /** Release manifest — JSON file describing the latest release and history. Relative path works on both localhost and production VPS. */
    RELEASE_MANIFEST_URL: "/downloads/manifest.json",
};

// Attach to window object for global accessibility (used by inline scripts)
window.CONFIG = CONFIG;
