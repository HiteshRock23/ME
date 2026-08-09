import { api } from './api.js';
import { ui } from './ui.js';
import { analytics } from './analytics.js';
import { auth } from './auth.js';
import { router } from './router.js';

class SaveLinkController {
    constructor() {
        // State
        this.currentPreviewId = null;
        this.currentUrl = "";
        
        // DOM Elements
        this.input = document.getElementById('save-link-input');
        this.analyzeBtn = document.getElementById('save-link-analyze-btn');
        this.loadingState = document.getElementById('save-link-loading');
        this.resultState = document.getElementById('save-link-result');
        this.exampleBtns = document.querySelectorAll('.save-link-example-btn');
        
        // Progress elements
        this.progressDetecting = document.getElementById('progress-detecting');
        this.progressReading = document.getElementById('progress-reading');
        this.progressUnderstanding = document.getElementById('progress-understanding');
        this.progressPreparing = document.getElementById('progress-preparing');
        
        // Preview elements
        this.previewTitle = document.getElementById('preview-title');
        this.previewSummary = document.getElementById('preview-summary');
        this.previewSiteName = document.getElementById('preview-site-name');
        this.previewPlatformBadge = document.getElementById('preview-platform-badge');
        this.previewOriginalLink = document.getElementById('preview-original-link');
        this.previewThumbnail = document.getElementById('preview-thumbnail');
        this.previewThumbnailContainer = document.getElementById('preview-thumbnail-container');
        this.previewTags = document.getElementById('preview-tags');
        
        // Action buttons
        this.saveForeverBtn = document.getElementById('save-link-forever-btn');
        this.analyzeAnotherBtn = document.getElementById('save-link-another-btn');
        
        this.initEventListeners();
    }

    initEventListeners() {
        if (!this.input) return;

        // Listen for screen enter event
        window.addEventListener('me:save-link-enter', () => {
            this.reset();
            this.input.focus();
        });

        // URL Validation
        this.input.addEventListener('input', () => {
            const val = this.input.value.trim();
            const isValid = this.isValidUrl(val);
            this.analyzeBtn.disabled = !isValid;
        });

        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !this.analyzeBtn.disabled) {
                e.preventDefault();
                this.analyze();
            }
        });

        this.analyzeBtn.addEventListener('click', () => this.analyze());

        // Example buttons
        this.exampleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.input.value = btn.dataset.url;
                this.analyzeBtn.disabled = false;
                this.analyze();
                analytics.capture('Save Link Example Clicked', { url: btn.dataset.url });
            });
        });

        // Save forever action
        this.saveForeverBtn.addEventListener('click', () => this.saveForever());

        // Analyze another
        this.analyzeAnotherBtn.addEventListener('click', () => {
            this.reset();
            this.input.focus();
        });
    }

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch (_) {
            return false;
        }
    }

    reset() {
        this.input.value = "";
        this.analyzeBtn.disabled = true;
        this.input.parentElement.classList.remove('hidden');
        this.analyzeBtn.parentElement.classList.remove('hidden');
        document.getElementById('save-link-examples').classList.remove('hidden');
        
        this.loadingState.classList.add('hidden');
        this.resultState.classList.add('hidden');
        this.currentPreviewId = null;
        this.currentUrl = "";
        
        // Reset progress opacity
        this.progressReading.style.opacity = '0.5';
        this.progressUnderstanding.style.opacity = '0.5';
        this.progressPreparing.style.opacity = '0.5';
        
        // Reset preview
        this.previewThumbnailContainer.classList.add('hidden');
        this.previewTags.innerHTML = '';
    }

    simulateProgress() {
        setTimeout(() => this.progressReading.style.opacity = '1', 800);
        setTimeout(() => this.progressUnderstanding.style.opacity = '1', 2000);
        setTimeout(() => this.progressPreparing.style.opacity = '1', 3500);
    }

    async analyze() {
        const url = this.input.value.trim();
        if (!this.isValidUrl(url)) return;

        this.currentUrl = url;
        analytics.capture('Save Link Analyze Started', { domain: new URL(url).hostname });

        // Hide inputs, show loading
        this.input.parentElement.classList.add('hidden');
        this.analyzeBtn.parentElement.classList.add('hidden');
        document.getElementById('save-link-examples').classList.add('hidden');
        this.loadingState.classList.remove('hidden');
        
        this.simulateProgress();

        try {
            const result = await api.analyzeLink(url);
            
            // Ensure minimum loading time for perceived value
            setTimeout(() => {
                this.showResult(result);
            }, Math.max(0, 1500));
            
        } catch (error) {
            ui.showToast(error.message, 'error');
            this.reset();
            this.input.value = url; // Restore input
            this.analyzeBtn.disabled = false;
            analytics.capture('Save Link Error', { error: error.message });
        }
    }

    showResult(result) {
        this.loadingState.classList.add('hidden');
        this.currentPreviewId = result.preview_id;
        
        // Populate preview
        this.previewTitle.textContent = result.title || result.page_title || "Unknown Link";
        this.previewSummary.textContent = result.summary || result.page_description || "";
        this.previewSiteName.textContent = result.site_name || new URL(result.url || this.currentUrl).hostname;
        
        // Platform Badge
        let badgeIcon = '🌐';
        let badgeText = result.platform ? result.platform.charAt(0).toUpperCase() + result.platform.slice(1) : 'Website';
        
        if (result.platform === 'github') badgeIcon = '🐙';
        if (result.platform === 'youtube') badgeIcon = '📺';
        if (result.platform === 'twitter') badgeIcon = '🐦';
        
        this.previewPlatformBadge.textContent = `${badgeIcon} ${badgeText}`;
        
        // Original Link
        this.previewOriginalLink.href = result.url || this.currentUrl;

        // Thumbnail
        if (result.thumbnail_url) {
            this.previewThumbnail.src = result.thumbnail_url;
            this.previewThumbnailContainer.classList.remove('hidden');
        } else {
            this.previewThumbnailContainer.classList.add('hidden');
        }

        // Tags
        this.previewTags.innerHTML = '';
        if (result.tags && result.tags.length > 0) {
            result.tags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'memory-card-tag';
                tagEl.textContent = tag;
                this.previewTags.appendChild(tagEl);
            });
        }

        this.resultState.classList.remove('hidden');
        analytics.capture('Save Link Analyze Success');
    }

    async saveForever() {
        if (!this.currentPreviewId) return;

        if (auth.isAuthenticated()) {
            // User is already logged in, save it directly
            analytics.capture('Save Link Convert (Auth)');
            
            // We can prefill capture and let the normal flow handle it, 
            // or directly call API and go to dashboard.
            try {
                ui.showToast("Saving memory...", "info");
                const mem = await api.captureMemory(this.currentUrl, "", this.currentPreviewId);
                router.navigate('/dashboard');
                ui.showToast("Link saved successfully!", "success");
            } catch (error) {
                if (error.status === 409) {
                    ui.showToast("You've already saved this link.", "info");
                    router.navigate('/dashboard');
                } else {
                    ui.showToast(error.message, "error");
                }
            }
        } else {
            // User needs to auth
            analytics.capture('Save Link Convert (Unauth)');
            
            // Store preview state in session storage so we can resume after auth
            sessionStorage.setItem('me_pending_preview_id', this.currentPreviewId);
            sessionStorage.setItem('me_pending_preview_url', this.currentUrl);
            
            // Go to auth
            ui.showScreen('auth-screen');
        }
    }
}

export const saveLinkController = new SaveLinkController();
