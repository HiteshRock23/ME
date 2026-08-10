/**
 * ME Share Target Handler
 * Manages native share intent events, cold-start checking, authentication guards,
 * deduplication, and post-auth pending share resumption.
 */

import { ShareTarget } from './native/share-target.js';
import { CaptureGateway } from './capture-gateway.js';
import { quickCaptureUI } from './quick-capture-ui.js';
import { auth } from './auth.js';
import { router } from './router.js';

const PENDING_SHARE_KEY = 'me_pending_share_session';
const SHARE_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes

let _lastProcessedShareSignature = null;
let _lastProcessedTimestamp = 0;

export const ShareTargetHandler = {
    init() {
        // 1. Listen for background/foreground share events from native layer
        ShareTarget.addListener((payload) => {
            this.handleSharePayload(payload);
        });

        // 2. Process cold-start shares when app signal app-ready fires
        window.addEventListener('app-ready', async () => {
            await this.processColdStartShare();
            this.checkAndResumePendingShare();
        }, { once: true });

        // 3. Check for pending share whenever user enters dashboard
        window.addEventListener('me:dashboard-enter', () => {
            this.checkAndResumePendingShare();
        });
    },

    async processColdStartShare() {
        try {
            const payload = await ShareTarget.getPendingShare();
            if (payload) {
                await this.handleSharePayload(payload);
            }
        } catch (e) {
            console.warn('[ShareTargetHandler] Error reading cold start pending share:', e);
        }
    },

    async handleSharePayload(payload) {
        if (!payload || (!payload.text && !payload.url && !payload.title)) {
            return;
        }

        const timestamp = payload.timestamp || Date.now();
        const signature = `${payload.title || ''}::${payload.text || ''}::${payload.url || ''}::${timestamp}`;

        // Deduplication check
        if (signature === _lastProcessedShareSignature || (timestamp && timestamp === _lastProcessedTimestamp)) {
            return;
        }
        _lastProcessedShareSignature = signature;
        _lastProcessedTimestamp = timestamp;

        const session = CaptureGateway.createFromSharePayload(payload);
        if (!session) return;

        if (auth.isAuthenticated()) {
            // User authenticated -> open quick capture directly
            this.clearPendingStorage();
            quickCaptureUI.open(session);
        } else {
            // User unauthenticated -> preserve in localStorage with timestamp guard
            this.savePendingShare(payload);
            router.navigate('/auth');
        }
    },

    savePendingShare(payload) {
        try {
            const existingRaw = localStorage.getItem(PENDING_SHARE_KEY);
            if (existingRaw) {
                const existing = JSON.parse(existingRaw);
                // Do not overwrite a newer pending share with an older one
                if (existing.timestamp && payload.timestamp && payload.timestamp < existing.timestamp) {
                    return;
                }
            }
            const storedData = {
                payload,
                storedAt: Date.now(),
                timestamp: payload.timestamp || Date.now()
            };
            localStorage.setItem(PENDING_SHARE_KEY, JSON.stringify(storedData));
        } catch (e) {
            console.error('[ShareTargetHandler] Error saving pending share:', e);
        }
    },

    checkAndResumePendingShare() {
        if (!auth.isAuthenticated()) return;

        try {
            const storedRaw = localStorage.getItem(PENDING_SHARE_KEY);
            if (!storedRaw) return;

            // Clear immediately to prevent multiple triggers
            localStorage.removeItem(PENDING_SHARE_KEY);

            const stored = JSON.parse(storedRaw);
            const now = Date.now();

            // Discard stale pending shares older than 30 minutes
            if (stored.storedAt && (now - stored.storedAt > SHARE_EXPIRATION_MS)) {
                console.log('[ShareTargetHandler] Discarding stale pending share (expired).');
                return;
            }

            const payload = stored.payload;
            if (payload) {
                const session = CaptureGateway.createFromSharePayload(payload);
                if (session) {
                    quickCaptureUI.open(session);
                }
            }
        } catch (e) {
            console.error('[ShareTargetHandler] Error resuming pending share:', e);
            localStorage.removeItem(PENDING_SHARE_KEY);
        }
    },

    clearPendingStorage() {
        try {
            localStorage.removeItem(PENDING_SHARE_KEY);
        } catch (_) {}
    }
};

if (typeof window !== 'undefined') {
    window.ShareTargetHandler = ShareTargetHandler;
}
