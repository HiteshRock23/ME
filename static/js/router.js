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
import { ui } from './ui.js';
import { memoryController } from './memory-controller.js';
import { analytics } from './analytics.js';

export const router = {
    init() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => {
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
        if (window.location.pathname !== path) {
            window.history.pushState(null, '', path);
        }
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

        // --- Root ---
        if (path === '/' || path === '/index.html') {
            memoryController.close();
            if (isLoggedIn) {
                this.navigate('/dashboard');
            } else {
                ui.showScreen('landing-screen');
                analytics.track('Landing Viewed');
            }
            return;
        }

        // --- Auth ---
        if (path === '/auth') {
            memoryController.close();
            if (isLoggedIn) {
                this.navigate('/dashboard');
            } else {
                ui.showScreen('auth-screen');
                analytics.track('Auth Page Viewed');
            }
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
            analytics.track('Dashboard Loaded');
            // Signal the dashboard to initialize/reload its timeline
            window.dispatchEvent(new CustomEvent('me:dashboard-enter'));
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
