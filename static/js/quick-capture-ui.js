import { CaptureGateway, CaptureSession } from './capture-gateway.js';
import { overlayManager } from './overlay-manager.js';

export const quickCaptureUI = {
    _currentSession: null,
    _initialized: false,

    init() {
        if (this._initialized) return;
        this._initialized = true;

        const closeBtn = document.getElementById('quick-capture-close-btn');
        if (closeBtn) closeBtn.onclick = () => this.close();

        const cancelBtn = document.getElementById('quick-capture-cancel-btn');
        if (cancelBtn) cancelBtn.onclick = () => this.close();

        const pinBtn = document.getElementById('quick-capture-pin-btn');
        if (pinBtn) {
            pinBtn.onclick = () => {
                if (!this._currentSession) return;
                this._currentSession.isPinned = !this._currentSession.isPinned;
                pinBtn.setAttribute('aria-pressed', this._currentSession.isPinned ? 'true' : 'false');
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
        if (doneBtn) doneBtn.onclick = () => this.close();

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
        if (doneDupBtn) doneDupBtn.onclick = () => this.close();
    },

    /**
     * Open Quick Capture Screen with a CaptureSession.
     * Render UI immediately without waiting for link intelligence.
     * @param {CaptureSession} session
     */
    async open(session) {
        this.init();
        this._currentSession = session;

        const screen = document.getElementById('quick-capture-screen');
        if (!screen) return;
        screen.classList.remove('hidden');

        overlayManager.open('quick-capture-screen', () => this.close(), {
            type: 'transient',
            initialFocus: document.getElementById('quick-capture-submit-btn')
        });

        this._renderFormState();

        // Render skeleton state while fetching metadata asynchronously
        if (session.type === 'link') {
            this._showSkeleton(true);
            await CaptureGateway.analyzeLinkPreview(session);
            this._showSkeleton(false);
            this._renderFormState();
        }
    },

    close() {
        const screen = document.getElementById('quick-capture-screen');
        if (screen) screen.classList.add('hidden');
        overlayManager.close('quick-capture-screen');
        this._currentSession = null;
        try {
            localStorage.removeItem('me_pending_share_session');
        } catch (_) {}
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
            if (domainEl) domainEl.textContent = (prev && prev.site_name) || (prev && prev.domain) || 'Link';
            if (bodyEl) bodyEl.textContent = (prev && prev.summary) || (prev && prev.page_description) || s.rawContent;

            if (prev && prev.thumbnail_url) {
                if (thumbImg) thumbImg.src = prev.thumbnail_url;
                if (thumbBox) thumbBox.classList.remove('hidden');
            } else {
                if (thumbBox) thumbBox.classList.add('hidden');
            }
        } else {
            if (titleEl) titleEl.textContent = 'Note';
            if (domainEl) domainEl.textContent = 'Plain Text';
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

        if (s.status === 'saved') {
            if (formView) formView.classList.add('hidden');
            if (successView) successView.classList.remove('hidden');
            if (dupView) dupView.classList.add('hidden');
        } else if (s.status === 'duplicate') {
            if (formView) formView.classList.add('hidden');
            if (successView) successView.classList.add('hidden');
            if (dupView) dupView.classList.remove('hidden');
        } else {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save to ME';
            }
            alert(s.errorMessage || 'Failed to save memory.');
        }
    }
};
