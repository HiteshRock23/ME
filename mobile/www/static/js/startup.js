/**
 * ME Startup Initialization Pipeline
 * Executes application initialization in deterministic, observable stages.
 */

import { ENV, isDevelopment } from './environment.js';
import { network } from './network.js';
import { auth } from './auth.js';
import { analytics } from './analytics.js';

export const Startup = {
    async init(uiInitCallback, routerInitCallback) {
        const startTime = performance.now();
        console.log('[Startup] Beginning ME Application Launch Sequence...');

        try {
            // Stage 1: Environment Validation
            ENV.validateConfig();
            if (isDevelopment()) {
                console.log(`[Startup] Environment: ${ENV.ENVIRONMENT} | Platform: ${ENV.PLATFORM} | API_BASE: ${ENV.API_BASE}`);
            }

            // Stage 2: Network Layer Health Check (non-blocking, fast ping)
            network.checkBackendHealth().then(healthy => {
                if (isDevelopment()) console.log(`[Startup] Backend reachability status: ${healthy ? 'HEALTHY' : 'UNREACHABLE'}`);
            });

            // Stage 3: Restore Authentication
            if (auth.isAuthenticated()) {
                if (isDevelopment()) console.log('[Startup] Authenticated user session restored.');
            }

            // Stage 4: Analytics Setup
            if (typeof analytics !== 'undefined' && analytics.init) {
                analytics.init();
            }

            // Stage 5: Initialize UI Callbacks
            if (typeof uiInitCallback === 'function') {
                uiInitCallback();
            }

            // Stage 6: Initialize Router Callbacks
            if (typeof routerInitCallback === 'function') {
                routerInitCallback();
            }

            const totalMs = Math.round(performance.now() - startTime);
            console.log(`[Startup] ME Application Ready (${totalMs}ms).`);
            return true;

        } catch (err) {
            console.error('[Startup] Critical launch sequence error:', err);
            return false;
        }
    }
};

if (typeof window !== 'undefined') {
    window.Startup = Startup;
}
