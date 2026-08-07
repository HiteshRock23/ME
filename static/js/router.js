/**
 * Router
 *
 * The ONLY module that owns browser history.
 * Responsibilities:
 *   - Parse URL
 *   - Update window.history
 *   - Delegate to the appropriate controller or screen
 *
 * The Router NEVER:
 *   - Opens or closes drawers
 *   - Fetches data
 *   - Manipulates DOM elements
 *   - Dispatches custom events
 *
 * Architecture:
 *   User Action → router.navigate(path)
 *               → handleRoute(path)
 *               → Screen Controller (MemoryController / Dashboard)
 */

import { auth } from './auth.js';
import { ui } from './ui.js?v=4';
import { memoryController } from './memory-controller.js';
import { analytics } from './analytics.js';
import { CaptureGateway } from './capture-gateway.js';
import { quickCaptureUI } from './quick-capture-ui.js';

export const router = {
    currentPath: null,

    init() {
        this.currentPath = window.location.pathname;

        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => {
            if (ui.hasUnsavedChanges && ui.hasUnsavedChanges()) {
                if (!confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                    if (this.currentPath) {
                        window.history.pushState(null, '', this.currentPath);
                    }
                    return;
                }
                ui.resetUnsavedChanges();
            }
            this.currentPath = window.location.pathname;
            this.handleRoute(window.location.pathname);
        });

        // Intercept internal links (<a data-route>)
        document.body.addEventListener('click', (e) => {
            const link = e.target.closest('a[data-route]');
            if (link) {
                e.preventDefault();
                this.navigate(link.getAttribute('href'));
            }
        });

        // Resolve initial URL
        this.handleRoute(window.location.pathname);
    },

    /**
     * Navigate to a path. Updates browser history and resolves the route.
     * This is the single entry point for all navigation in the app.
     *
     * @param {string} path
     */
    navigate(path) {
        if (ui.hasUnsavedChanges && ui.hasUnsavedChanges()) {
            if (!confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                return;
            }
            ui.resetUnsavedChanges();
        }

        if (window.location.pathname !== path) {
            window.history.pushState(null, '', path);
        }
        this.currentPath = path;
        this.handleRoute(path);
    },

    /**
     * Resolve the current path to the correct application state.
     * Pure routing logic — no DOM manipulation.
     *
     * @param {string} path
     */
    handleRoute(path) {
        const isLoggedIn = auth.isAuthenticated();

        // Check for pending quick capture after login
        const pendingQuery = sessionStorage.getItem('pending_quick_capture');
        if (isLoggedIn && pendingQuery && path !== '/quick-capture' && path !== '/share-target') {
            this.navigate('/quick-capture');
            return;
        }

        // --- Root ---
        if (path === '/' || path === '/index.html') {
            memoryController.close();
            if (isLoggedIn) {
                this.navigate('/dashboard');
            } else {
                ui.showScreen('landing-screen');
                analytics.pageView('Landing Page');
            }
            return;
        }

        // --- Quick Capture & Share Target ---
        if (path === '/quick-capture' || path === '/share-target') {
            memoryController.close();

            const searchParams = new URLSearchParams(window.location.search);
            const hasSharedData = searchParams.has('url') || searchParams.has('text') || searchParams.has('title') || searchParams.has('link');

            if (!isLoggedIn) {
                if (hasSharedData) {
                    sessionStorage.setItem('pending_quick_capture', searchParams.toString());
                }
                this.navigate('/auth');
                return;
            }

            let sessionParams = searchParams;
            if (pendingQuery && !hasSharedData) {
                sessionParams = new URLSearchParams(pendingQuery);
                sessionStorage.removeItem('pending_quick_capture');
            }

            const session = CaptureGateway.createFromParams(sessionParams);
            ui.showScreen('app-screen');
            quickCaptureUI.open(session);
            analytics.pageView('Quick Capture');
            return;
        }

        // --- Auth ---
        if (path === '/auth') {
            memoryController.close();
            if (isLoggedIn) {
                this.navigate('/dashboard');
            } else {
                ui.showScreen('auth-screen');
                analytics.pageView('Authentication');
            }
            return;
        }

        // --- Quick Dump ---
        if (path === '/dump') {
            memoryController.close();
            ui.showScreen('dump-screen');
            analytics.pageView('Quick Dump');
            window.dispatchEvent(new CustomEvent('me:dump-enter'));
            return;
        }

        // --- Save Link ---
        if (path === '/save-link') {
            memoryController.close();
            ui.showScreen('save-link-screen');
            analytics.pageView('Save Link');
            window.dispatchEvent(new CustomEvent('me:save-link-enter'));
            return;
        }

        // --- Download ---
        if (path === '/download') {
            memoryController.close();
            ui.showScreen('download-screen');
            analytics.pageView('Download Page');
            window.dispatchEvent(new CustomEvent('me:download-page-viewed'));
            return;
        }

        // --- Dashboard ---
        if (path === '/dashboard') {
            memoryController.close();
            if (!isLoggedIn) {
                this.navigate('/auth');
                return;
            }
            ui.showScreen('app-screen');
            analytics.pageView('Dashboard');
            analytics.capture('Dashboard Opened');
            // Signal the dashboard to initialize/reload its timeline
            window.dispatchEvent(new CustomEvent('me:dashboard-enter'));
            return;
        }

        // --- Public Shared Memory Page (/s/<token>) ---
        if (path.startsWith('/s/') || path.startsWith('/m/')) {
            memoryController.close();
            const token = path.split('/')[2];
            if (!token) {
                this.navigate('/');
                return;
            }
            ui.showScreen('public-shared-screen');
            analytics.pageView('Public Shared Memory');
            ui.loadPublicSharedMemory(token);
            return;
        }

        // --- Memory Detail ---
        if (path.startsWith('/memory/')) {
            console.log('[ROUTER] /memory/ route hit, isLoggedIn:', isLoggedIn);
            if (!isLoggedIn) {
                this.navigate('/auth');
                return;
            }
            const memoryId = path.split('/')[2];
            console.log('[ROUTER] memoryId:', memoryId);
            if (!memoryId) {
                this.navigate('/dashboard');
                return;
            }
            ui.showScreen('app-screen');
            if (document.getElementById('memory-feed').children.length === 0) {
                window.dispatchEvent(new CustomEvent('me:dashboard-enter'));
            }
            console.log('[ROUTER] calling memoryController.open(', memoryId, ')');
            analytics.pageView('Memory Detail');
            memoryController.open(memoryId);
            return;
        }

        // --- Fallback ---
        memoryController.close();
        if (isLoggedIn) {
            this.navigate('/dashboard');
        } else {
            this.navigate('/');
        }
    },
};
