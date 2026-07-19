/**
 * PWA & Native Install Experience
 */

let deferredPrompt;

// Configuration
const BANNER_DISMISSAL_KEY = 'me_pwa_banner_dismissed_v1';
const DISMISSAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function initPWA() {
    registerServiceWorker();
    setupInstallListeners();
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/static/sw.js')
                .then(registration => {
                    console.log('[PWA] ServiceWorker registered with scope:', registration.scope);
                    
                    // Handle updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                showUpdateAvailable();
                            }
                        });
                    });
                })
                .catch(err => {
                    console.error('[PWA] ServiceWorker registration failed:', err);
                });
        });
    }
}

function setupInstallListeners() {
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        console.log('[PWA] beforeinstallprompt fired, installation available');
        
        // Show UI
        showInstallUI();
    });

    window.addEventListener('appinstalled', (evt) => {
        console.log('[PWA] app installed successfully');
        trackEvent('App Installed');
        hideInstallUI();
        deferredPrompt = null;
    });
}

function showInstallUI() {
    // Show navbar button if it exists
    const navBtn = document.getElementById('pwa-nav-btn');
    if (navBtn) {
        navBtn.classList.remove('hidden');
        trackEvent('Install Button Viewed');
    }

    // Show banner if not dismissed recently
    const lastDismissed = localStorage.getItem(BANNER_DISMISSAL_KEY);
    const now = Date.now();
    if (!lastDismissed || (now - parseInt(lastDismissed, 10)) > DISMISSAL_DURATION_MS) {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) {
            banner.classList.remove('hidden');
            trackEvent('Install Banner Viewed');
        }
    }
}

export function hideInstallUI() {
    const navBtn = document.getElementById('pwa-nav-btn');
    if (navBtn) navBtn.classList.add('hidden');

    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.classList.add('hidden');
}

export async function promptInstall() {
    if (!deferredPrompt) return;
    
    trackEvent('Install Button Clicked');
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response to the install prompt: ${outcome}`);
    
    if (outcome === 'accepted') {
        trackEvent('Install Accepted');
        hideInstallUI();
    } else {
        trackEvent('Install Cancelled');
    }
    
    // We've used the prompt, and can't use it again, discard it
    deferredPrompt = null;
}

export function dismissBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
        banner.classList.add('hidden');
        localStorage.setItem(BANNER_DISMISSAL_KEY, Date.now().toString());
        trackEvent('Install Banner Dismissed');
    }
}

function showUpdateAvailable() {
    console.log('[PWA] New version available');
    const updateBanner = document.getElementById('pwa-update-banner');
    if (updateBanner) {
        updateBanner.classList.remove('hidden');
    }
}

export function refreshApp() {
    window.location.reload();
}

function trackEvent(eventName) {
    // Integrate with analytics here
    console.log(`[Analytics] ${eventName}`);
}
