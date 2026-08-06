import { CaptureSource } from './capture-source.js';

/**
 * ShareSession Normalization Layer
 * Normalizes OS share targets (Web Share, Android Intent, Extension, Desktop)
 * into a single unified data model before passing to CaptureGateway.
 */
export class ShareSession {
    constructor({ rawUrl = '', rawText = '', rawTitle = '', source = CaptureSource.WEB_SHARE }) {
        this.source = source;
        this.rawTitle = (rawTitle || '').trim();
        this.rawText = (rawText || '').trim();
        this.rawUrl = (rawUrl || '').trim();

        // Extracted / Normalized properties
        this.normalizedUrl = this._extractAndValidateUrl();
        this.originatingApp = this.detectSourceApp();
        this.contentType = this.normalizedUrl ? 'link' : 'text';
        this.primaryContent = this.normalizedUrl || this.rawText || this.rawTitle;
    }

    /**
     * Helper to validate and extract clean HTTP/HTTPS URL from input.
     * Rejects javascript:, data:, malformed URIs.
     * @returns {string|null}
     */
    _extractAndValidateUrl() {
        let candidate = this.rawUrl;

        // Extract URL embedded in text if url param is absent
        if (!candidate && this.rawText) {
            const match = this.rawText.match(/https?:\/\/[^\s]+/i);
            if (match) {
                candidate = match[0];
            }
        }

        if (!candidate) return null;

        // Clean up trailing punctuation from extracted URL
        candidate = candidate.replace(/[.,;)]+$/, '');

        try {
            const parsed = new URL(candidate);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.href;
            }
        } catch (e) {
            // Invalid URL
        }

        return null;
    }

    /**
     * Source Detection: Automatically infer the originating application from URL or text.
     * @returns {string} App Name or 'Web'
     */
    detectSourceApp() {
        const target = (this.normalizedUrl || this.rawText || '').toLowerCase();

        if (target.includes('youtube.com') || target.includes('youtu.be')) return 'YouTube';
        if (target.includes('twitter.com') || target.includes('x.com')) return 'X';
        if (target.includes('reddit.com') || target.includes('redd.it')) return 'Reddit';
        if (target.includes('github.com')) return 'GitHub';
        if (target.includes('medium.com')) return 'Medium';
        if (target.includes('linkedin.com')) return 'LinkedIn';
        if (target.includes('t.me') || target.includes('telegram.')) return 'Telegram';
        if (target.includes('whatsapp.com') || target.includes('wa.me')) return 'WhatsApp';
        if (target.includes('mail.google.com') || target.includes('gmail.')) return 'Gmail';
        if (target.includes('slack.com')) return 'Slack';

        return 'Web';
    }

    /**
     * Create ShareSession from URLSearchParams (GET method Web Share Target)
     * @param {URLSearchParams} params
     * @param {string} defaultSource
     * @returns {ShareSession}
     */
    static fromSearchParams(params, defaultSource = CaptureSource.ANDROID_SHARE) {
        const rawUrl = params.get('url') || params.get('link') || '';
        const rawText = params.get('text') || '';
        const rawTitle = params.get('title') || '';

        return new ShareSession({
            rawUrl,
            rawText,
            rawTitle,
            source: defaultSource
        });
    }
}
