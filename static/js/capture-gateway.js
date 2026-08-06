import { api } from './api.js';
import { CaptureSource } from './capture-source.js';
import { ShareSession } from './share-session.js';

const OFFLINE_QUEUE_KEY = 'me_offline_capture_queue';

/**
 * CaptureSession
 * Frontend session state representation for incoming knowledge.
 */
export class CaptureSession {
    constructor({ rawContent = '', title = '', type = 'text', source = CaptureSource.WEB_SHARE, originatingApp = 'Web' }) {
        this.rawContent = (rawContent || '').trim();
        this.title = (title || '').trim();
        this.type = type; // 'link' | 'text'
        this.source = source; // CaptureSource enum value
        this.originatingApp = originatingApp;
        this.isPinned = false;
        this.previewData = null;
        this.status = 'idle'; // 'idle' | 'analyzing' | 'saving' | 'saved' | 'duplicate' | 'error' | 'offline_saved'
        this.errorMessage = '';
        this.savedMemory = null;
        this.abortController = new AbortController();
    }

    cancelPendingAnalysis() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = new AbortController();
        }
    }
}

/**
 * Universal Capture Gateway
 * Provider-agnostic gateway for processing incoming knowledge from Web Share, Android, Extensions, etc.
 */
export class CaptureGateway {
    /**
     * Create a CaptureSession from URLSearchParams (Web Share / Android Share Target) using ShareSession.
     * @param {URLSearchParams} params
     * @param {string} defaultSource
     * @returns {CaptureSession}
     */
    static createFromParams(params, defaultSource = CaptureSource.ANDROID_SHARE) {
        const shareSession = ShareSession.fromSearchParams(params, defaultSource);

        return new CaptureSession({
            rawContent: shareSession.primaryContent,
            title: shareSession.rawTitle,
            type: shareSession.contentType,
            source: shareSession.source,
            originatingApp: shareSession.originatingApp
        });
    }

    /**
     * Fetch link intelligence preview asynchronously without blocking initial UI render.
     * Supports AbortSignal for cancellation.
     * @param {CaptureSession} session
     * @returns {Promise<CaptureSession>}
     */
    static async analyzeLinkPreview(session) {
        if (session.type !== 'link' || !session.rawContent) return session;

        session.status = 'analyzing';
        try {
            const res = await api.analyzeLink(session.rawContent, {
                signal: session.abortController.signal
            });
            session.previewData = res;
            if (!session.title && res.title) {
                session.title = res.title;
            }
            session.status = 'idle';
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('[CaptureGateway] Link analysis aborted by user.');
                return session;
            }
            console.warn('[CaptureGateway] Link analysis fallback:', err);
            session.status = 'idle'; // Fallback gracefully: preserve raw URL
        }
        return session;
    }

    /**
     * Submit a CaptureSession to the backend pipeline.
     * Supports offline fallback queue if offline.
     * @param {CaptureSession} session
     * @returns {Promise<CaptureSession>}
     */
    static async submitSession(session) {
        if (!session.rawContent) {
            session.status = 'error';
            session.errorMessage = 'Content cannot be empty.';
            return session;
        }

        session.status = 'saving';

        // Offline check
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            this.enqueueOfflineSession(session);
            session.status = 'offline_saved';
            return session;
        }

        try {
            const payload = {
                raw_content: session.rawContent,
                is_pinned: session.isPinned,
                link_title: session.title,
                capture_source: session.source,
            };
            if (session.previewData && session.previewData.preview_id) {
                payload.preview_id = session.previewData.preview_id;
            }

            const saved = await api.captureMemory(payload);
            session.savedMemory = saved;
            session.status = 'saved';
        } catch (err) {
            if (err.status === 409 || (err.message && err.message.toLowerCase().includes('already saved'))) {
                session.status = 'duplicate';
                session.errorMessage = 'Already saved in your ME memory.';
                if (err.existingMemory) {
                    session.savedMemory = err.existingMemory;
                } else if (err.existing_memory) {
                    session.savedMemory = err.existing_memory;
                }
            } else if (!navigator.onLine || err.message?.toLowerCase().includes('network')) {
                this.enqueueOfflineSession(session);
                session.status = 'offline_saved';
            } else {
                session.status = 'error';
                session.errorMessage = err.message || 'Failed to save memory. Please check your connection.';
            }
        }
        return session;
    }

    /**
     * Enqueue session to local storage for offline synchronization
     * @param {CaptureSession} session
     */
    static enqueueOfflineSession(session) {
        try {
            const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
            queue.push({
                rawContent: session.rawContent,
                title: session.title,
                isPinned: session.isPinned,
                source: session.source,
                timestamp: Date.now()
            });
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
            console.log('[CaptureGateway] Queued capture for offline sync.');
        } catch (e) {
            console.error('[CaptureGateway] Failed to queue offline capture:', e);
        }
    }

    /**
     * Synchronize offline queue when connectivity returns.
     */
    static async syncOfflineQueue() {
        if (!navigator.onLine) return;
        try {
            const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
            if (queue.length === 0) return;

            console.log(`[CaptureGateway] Syncing ${queue.length} offline captures...`);
            const remaining = [];

            for (const item of queue) {
                try {
                    await api.captureMemory({
                        raw_content: item.rawContent,
                        link_title: item.title,
                        is_pinned: item.isPinned,
                        capture_source: item.source || CaptureSource.ANDROID_SHARE
                    });
                } catch (err) {
                    if (err.status !== 409) {
                        remaining.push(item);
                    }
                }
            }

            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
            console.log('[CaptureGateway] Offline sync complete.');
        } catch (e) {
            console.error('[CaptureGateway] Offline sync error:', e);
        }
    }
}

// Auto-sync listener when browser comes back online
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => CaptureGateway.syncOfflineQueue());
}
