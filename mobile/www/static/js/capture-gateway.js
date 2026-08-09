import { api } from './api.js';

/**
 * CaptureSession
 * Lightweight frontend session state for incoming shared knowledge.
 */
export class CaptureSession {
    constructor({ rawContent = '', title = '', type = 'text', source = 'WEB_SHARE' }) {
        this.rawContent = rawContent.trim();
        this.title = title.trim();
        this.type = type; // 'link' | 'text'
        this.source = source; // 'WEB_SHARE' | 'ANDROID_SHARE' | 'MANUAL' | 'EXTENSION'
        this.isPinned = false;
        this.previewData = null;
        this.status = 'idle'; // 'idle' | 'analyzing' | 'saving' | 'saved' | 'duplicate' | 'error'
        this.errorMessage = '';
        this.savedMemory = null;
    }
}

/**
 * Universal Capture Gateway
 * Provider-agnostic gateway for processing incoming knowledge from Web Share, Android, Extensions, etc.
 */
export class CaptureGateway {
    /**
     * Extract URL from text if present using regex.
     * @param {string} text
     * @returns {string|null}
     */
    static extractUrl(text) {
        if (!text) return null;
        const match = text.match(/https?:\/\/[^\s]+/i);
        return match ? match[0] : null;
    }

    /**
     * Create a CaptureSession from URL search parameters (Web Share / Android Share Target).
     * @param {URLSearchParams} params
     * @returns {CaptureSession}
     */
    static createFromParams(params) {
        const sharedUrl = params.get('url') || params.get('link') || '';
        const sharedText = params.get('text') || '';
        const sharedTitle = params.get('title') || '';

        let finalUrl = sharedUrl.trim();
        if (!finalUrl && sharedText) {
            const extracted = this.extractUrl(sharedText);
            if (extracted) {
                finalUrl = extracted;
            }
        }

        if (finalUrl) {
            return new CaptureSession({
                rawContent: finalUrl,
                title: sharedTitle,
                type: 'link',
                source: 'WEB_SHARE'
            });
        }

        const rawText = sharedText || sharedTitle;
        return new CaptureSession({
            rawContent: rawText,
            title: sharedTitle,
            type: 'text',
            source: 'WEB_SHARE'
        });
    }

    /**
     * Fetch link intelligence preview asynchronously without blocking initial UI render.
     * @param {CaptureSession} session
     * @returns {Promise<CaptureSession>}
     */
    static async analyzeLinkPreview(session) {
        if (session.type !== 'link' || !session.rawContent) return session;

        session.status = 'analyzing';
        try {
            const res = await api.analyzeLink(session.rawContent);
            session.previewData = res;
            if (!session.title && res.title) {
                session.title = res.title;
            }
            session.status = 'idle';
        } catch (err) {
            console.warn('[CaptureGateway] Link analysis fallback:', err);
            session.status = 'idle'; // Fallback gracefully: preserve raw URL
        }
        return session;
    }

    /**
     * Submit a CaptureSession to the backend pipeline.
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
                if (err.existing_memory) {
                    session.savedMemory = err.existing_memory;
                }
            } else {
                session.status = 'error';
                session.errorMessage = err.message || 'Failed to save memory. Please check your connection.';
            }
        }
        return session;
    }
}
