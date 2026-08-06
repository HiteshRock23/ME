import { CaptureGateway, CaptureSession } from './capture-gateway.js';
import { overlayManager } from './overlay-manager.js';
import { analytics } from './analytics.js';

const PIN_PREF_KEY = 'me_quick_capture_pin_pref';

function formatRelativeTime(dateString) {
    if (!dateString) return 'Previously saved';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) return `Saved ${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    if (diffHour > 0) return `Saved ${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffMin > 0) return `Saved ${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    return 'Saved just now';
}

export const quickCaptureUI = {
    _currentSession: null,
    _initialized: false,
    _autoReturnTimer: null,

    init() {
        if (this._initialized) return;
        this._initialized = true;

        const closeBtn = document.getElementById('quick-capture-close-btn');
        if (closeBtn) closeBtn.onclick = () => this.cancel();

        const cancelBtn = document.getElementById('quick-capture-cancel-btn');
        if (cancelBtn) cancelBtn.onclick = () => this.cancel();

        const pinBtn = document.getElementById('quick-capture-pin-btn');
        if (pinBtn) {
            pinBtn.onclick = () => {
                if (!this._currentSession) return;
                this._currentSession.isPinned = !this._currentSession.isPinned;
                pinBtn.setAttribute('aria-pressed', this._currentSession.isPinned ? 'true' : 'false');
                try {
                    localStorage.setItem(PIN_PREF_KEY, this._currentSession.isPinned ? 'true' : 'false');
                } catch(e) {}
            };
        }

        const submitBtn = document.getElementById('quick-capture-submit-btn');
        if (submitBtn) {
            submitBtn.onclick = async () => {
                await this.submit();
            };
        }

        const openBtn = document.getElementById('quick-capture-open-btn');
        if (openBtn) {
            openBtn.onclick = () => {
                this.clearAutoReturn();
                const mem = this._currentSession?.savedMemory;
                this.close();
                if (mem && mem.id) {
                    window.dispatchEvent(new CustomEvent('me:navigate', { detail: { path: `/memory/${mem.id}` } }));
                } else {
                    window.dispatchEvent(new CustomEvent('me:navigate', { detail: { path: '/dashboard' } }));
                }
            };
        }

        const doneBtn = document.getElementById('quick-capture-done-btn');
        if (doneBtn) doneBtn.onclick = () => {
            this.clearAutoReturn();
            this.attemptCloseOrReturn();
        };

        const openDupBtn = document.getElementById('quick-capture-open-dup-btn');
        if (openDupBtn) {
            openDupBtn.onclick = () => {
                const mem = this._currentSession?.savedMemory;
                this.close();
                if (mem && mem.id) {
                    window.dispatchEvent(new CustomEvent('me:navigate', { detail: { path: `/memory/${mem.id}` } }));
                } else {
                    window.dispatchEvent(new CustomEvent('me:navigate', { detail: { path: '/dashboard' } }));
                }
            };
        }

        const doneDupBtn = document.getElementById('quick-capture-done-dup-btn');
        if (doneDupBtn) doneDupBtn.onclick = () => this.attemptCloseOrReturn();
    },

    /**
     * Open Quick Capture Screen with a CaptureSession.
     * Render UI immediately without waiting for link intelligence.
     * @param {CaptureSession} session
     */
    async open(session) {
        this.init();
        this.clearAutoReturn();
        this._currentSession = session;

        // Restore pin preference if available
        try {
            const savedPinPref = localStorage.getItem(PIN_PREF_KEY);
            if (savedPinPref !== null) {
                session.isPinned = savedPinPref === 'true';
            }
        } catch(e) {}

        const screen = document.getElementById('quick-capture-screen');
        if (!screen) return;
        screen.classList.remove('hidden');

        overlayManager.open('quick-capture-screen', () => this.cancel(), {
            type: 'transient',
            initialFocus: document.getElementById('quick-capture-submit-btn')
        });

        analytics.capture('share_received', {
            type: session.type,
            source: session.source,
            originating_app: session.originatingApp
        });

        this._renderFormState();

        // Render skeleton state while fetching metadata asynchronously
        if (session.type === 'link') {
            this._showSkeleton(true);
            await CaptureGateway.analyzeLinkPreview(session);
            this._showSkeleton(false);

            if (session.previewData) {
                analytics.capture('preview_loaded', {
                    domain: session.previewData.domain,
                    site_name: session.previewData.site_name
                });
            }
            this._renderFormState();
        }
    },

    cancel() {
        if (this._currentSession) {
            this._currentSession.cancelPendingAnalysis();
            analytics.capture('capture_cancelled', {
                source: this._currentSession.source,
                type: this._currentSession.type
            });
        }
        this.close();
    },

    close() {
        this.clearAutoReturn();
        const screen = document.getElementById('quick-capture-screen');
        if (screen) screen.classList.add('hidden');
        overlayManager.close('quick-capture-screen');
        this._currentSession = null;
    },

    clearAutoReturn() {
        if (this._autoReturnTimer) {
            clearTimeout(this._autoReturnTimer);
            this._autoReturnTimer = null;
        }
    },

    /**
     * Premium UX Requirement:
     * Attempt to automatically return user to originating app via window.close() / history.back()
     * Fallback to closing Quick Capture or redirecting to dashboard.
     */
    attemptCloseOrReturn() {
        this.close();
        try {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.close();
            }
        } catch(e) {
            window.dispatchEvent(new CustomEvent('me:navigate', { detail: { path: '/dashboard' } }));
        }
    },

    _renderFormState() {
        const s = this._currentSession;
        if (!s) return;

        const formView = document.getElementById('quick-capture-form-view');
        const successView = document.getElementById('quick-capture-success-view');
        const dupView = document.getElementById('quick-capture-duplicate-view');

        if (formView) formView.classList.remove('hidden');
        if (successView) successView.classList.add('hidden');
        if (dupView) dupView.classList.add('hidden');

        // Pin Pill State
        const pinBtn = document.getElementById('quick-capture-pin-btn');
        if (pinBtn) pinBtn.setAttribute('aria-pressed', s.isPinned ? 'true' : 'false');

        // Preview Meta
        const titleEl = document.getElementById('quick-capture-title-text');
        const domainEl = document.getElementById('quick-capture-domain-text');
        const bodyEl = document.getElementById('quick-capture-body-text');
        const thumbBox = document.getElementById('quick-capture-thumb-box');
        const thumbImg = document.getElementById('quick-capture-thumb-img');

        const prev = s.previewData;

        if (s.type === 'link') {
            if (titleEl) titleEl.textContent = s.title || (prev && prev.title) || s.rawContent;
            if (domainEl) domainEl.textContent = (prev && prev.site_name) || (prev && prev.domain) || s.originatingApp || 'Link';
            if (bodyEl) bodyEl.textContent = (prev && prev.summary) || (prev && prev.page_description) || s.rawContent;

            if (prev && prev.thumbnail_url) {
                if (thumbImg) thumbImg.src = prev.thumbnail_url;
                if (thumbBox) thumbBox.classList.remove('hidden');
            } else {
                if (thumbBox) thumbBox.classList.add('hidden');
            }
        } else {
            if (titleEl) titleEl.textContent = s.title || 'Note';
            if (domainEl) domainEl.textContent = s.originatingApp ? `${s.originatingApp} Note` : 'Plain Text';
            if (bodyEl) bodyEl.textContent = s.rawContent;
            if (thumbBox) thumbBox.classList.add('hidden');
        }

        const submitBtn = document.getElementById('quick-capture-submit-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save to ME';
        }
    },

    _showSkeleton(show) {
        const skeleton = document.getElementById('quick-capture-skeleton');
        const content = document.getElementById('quick-capture-preview-content');
        if (skeleton) skeleton.classList.toggle('hidden', !show);
        if (content) content.classList.toggle('hidden', show);
    },

    async submit() {
        const s = this._currentSession;
        if (!s) return;

        const submitBtn = document.getElementById('quick-capture-submit-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';
        }

        await CaptureGateway.submitSession(s);

        const formView = document.getElementById('quick-capture-form-view');
        const successView = document.getElementById('quick-capture-success-view');
        const dupView = document.getElementById('quick-capture-duplicate-view');

        if (s.status === 'saved' || s.status === 'offline_saved') {
            if (formView) formView.classList.add('hidden');
            if (successView) successView.classList.remove('hidden');
            if (dupView) dupView.classList.add('hidden');

            const titleEl = document.getElementById('quick-capture-success-title');
            const metaEl = document.getElementById('quick-capture-success-meta');
            if (titleEl) titleEl.textContent = s.title || s.rawContent;
            if (metaEl) {
                metaEl.textContent = s.status === 'offline_saved' 
                    ? 'Saved Offline. Will sync automatically when online.' 
                    : 'Saved just now';
            }

            analytics.capture('capture_saved', {
                type: s.type,
                source: s.source,
                is_pinned: s.isPinned,
                offline: s.status === 'offline_saved'
            });

            // Schedule optional auto-return to caller app after 1.5 seconds if available
            this.clearAutoReturn();
            this._autoReturnTimer = setTimeout(() => {
                this.attemptCloseOrReturn();
            }, 1500);

        } else if (s.status === 'duplicate') {
            if (formView) formView.classList.add('hidden');
            if (successView) successView.classList.add('hidden');
            if (dupView) dupView.classList.remove('hidden');

            const dupTitleEl = document.getElementById('quick-capture-dup-title');
            const dupMetaEl = document.getElementById('quick-capture-dup-meta');
            if (dupTitleEl) dupTitleEl.textContent = s.title || s.rawContent;
            if (dupMetaEl) {
                const savedAt = s.savedMemory?.created_at;
                dupMetaEl.textContent = formatRelativeTime(savedAt);
            }

            analytics.capture('capture_duplicate', {
                source: s.source,
                type: s.type
            });

        } else {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save to ME';
            }

            analytics.capture('capture_failed', {
                source: s.source,
                type: s.type,
                error: s.errorMessage
            });

            alert(s.errorMessage || 'Failed to save memory.');
        }
    }
};
