/**
 * ME Download Module
 *
 * Single home for all APK distribution logic:
 *   - Android device detection
 *   - Download button state machine
 *   - Analytics events
 *   - Release manifest loading + page population
 *   - Landing CTA adaptation (Android / non-Android)
 *   - Feedback link wiring
 *
 * Called once from app.js via initDownload().
 * No download logic lives anywhere else.
 */

import { analytics } from './analytics.js';

// ---------------------------------------------------------------------------
// Device Detection
// ---------------------------------------------------------------------------

function isAndroid() {
    return /android/i.test(navigator.userAgent);
}

function getPlatform() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua))              return 'Android';
    if (/iphone|ipad|ipod/i.test(ua))    return 'iOS';
    if (/macintosh|mac os x/i.test(ua))  return 'macOS';
    if (/windows/i.test(ua))             return 'Windows';
    if (/linux/i.test(ua))               return 'Linux';
    return 'Other';
}

function getBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes('Edg'))                                return 'Edge';
    if (ua.includes('Chrome') && !ua.includes('Chromium')) return 'Chrome';
    if (ua.includes('Firefox'))                            return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome'))   return 'Safari';
    return 'Other';
}

// ---------------------------------------------------------------------------
// Download Button State Machine
// ---------------------------------------------------------------------------

const STATE = { IDLE: 'idle', PREPARING: 'preparing', STARTED: 'started' };

let _downloadInProgress = false;

function setButtonState(btn, state, idleLabel) {
    if (!btn) return;
    btn.dataset.state = state;
    const labels = {
        [STATE.IDLE]:      idleLabel || 'Download APK',
        [STATE.PREPARING]: 'Preparing download\u2026',
        [STATE.STARTED]:   '\u2713 Download started',
    };
    const iconHtml = '<img src="/static/icons/icon-192.png" alt="ME" style="width: 22px; height: 22px; border-radius: 5px; object-fit: cover; flex-shrink: 0; margin-right: 8px; vertical-align: middle;" />';
    btn.innerHTML = iconHtml + '<span>' + labels[state] + '</span>';
    if (state === STATE.IDLE) {
        btn.removeAttribute('aria-disabled');
        btn.style.pointerEvents = '';
    } else {
        btn.setAttribute('aria-disabled', 'true');
        btn.style.pointerEvents = 'none';
    }
}

function resetButton(btn, idleLabel, delay) {
    setTimeout(() => {
        setButtonState(btn, STATE.IDLE, idleLabel);
        _downloadInProgress = false;
    }, delay);
}

// ---------------------------------------------------------------------------
// Release Manifest
// ---------------------------------------------------------------------------

async function fetchManifest() {
    const url = window.CONFIG && window.CONFIG.RELEASE_MANIFEST_URL;
    if (!url) return null;
    try {
        const res = await fetch(url, { cache: 'default' });
        if (!res.ok) return null;
        return await res.json();
    } catch (_) {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Download Page Population
// ---------------------------------------------------------------------------

function setEl(id, value) {
    if (value === null || value === undefined || value === '') return;
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
}

function populateDownloadPage(latest) {
    const { version, build, channel, size_display, sha256, released, min_android, min_sdk } = latest;
    const pkg = latest['package'];

    setEl('dl-version',     version);
    setEl('dl-build',       build);
    setEl('dl-channel',     channel === 'developer-preview' ? 'Developer Preview' : channel);
    setEl('dl-size',        size_display);
    setEl('dl-sha256',      sha256);
    setEl('dl-package',     pkg);
    setEl('dl-min-android', min_android ? 'Android ' + min_android + ' (API ' + min_sdk + ')' : null);

    if (released) {
        try {
            const d = new Date(released + 'T00:00:00Z');
            setEl('dl-released', d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
        } catch (_) {
            setEl('dl-released', released);
        }
    }

    // Update version labels inside buttons
    document.querySelectorAll('[data-apk-version-label]').forEach(el => {
        if (version) el.textContent = version;
    });
}

function renderReleaseHistory(history) {
    const container = document.getElementById('download-history-list');
    if (!container || !history || !history.length) return;
    container.innerHTML = history.map(function(release) {
        const highlights = (release.highlights || []).map(function(h) {
            return '<li>' + h + '</li>';
        }).join('');
        return '<div class="download-history-item">' +
            '<div class="download-history-header">' +
            '<span class="download-history-version">v' + release.version + '</span>' +
            '<span class="download-history-date">' + (release.released || '') + '</span>' +
            '</div>' +
            '<ul class="download-history-highlights">' + highlights + '</ul>' +
            '</div>';
    }).join('');
}

// ---------------------------------------------------------------------------
// Core Download Handler
// ---------------------------------------------------------------------------

function handleDownloadClick(btn, apkUrl, version, source) {
    if (_downloadInProgress) return;
    _downloadInProgress = true;

    const idleLabel = '\u2193 Download APK  \u00b7  v' + version;
    const platform  = getPlatform();
    const browser   = getBrowser();

    analytics.capture('APK Download Button Clicked', {
        version:    version,
        source:     source,
        platform:   platform,
        browser:    browser,
        is_android: isAndroid(),
    });

    setButtonState(btn, STATE.PREPARING, idleLabel);

    analytics.capture('APK Download Started', {
        version:      version,
        apk_filename: apkUrl.split('/').pop(),
        source:       source,
        platform:     platform,
        browser:      browser,
    });

    // Trigger download immediately within user gesture thread
    // window.location.href triggers native attachment download without navigating page
    window.location.href = apkUrl;

    setTimeout(function() {
        setButtonState(btn, STATE.STARTED, idleLabel);

        // Show post-download confirmation banner
        var confirmation = document.getElementById('download-confirmation');
        if (confirmation) {
            confirmation.classList.remove('hidden');
            var retryLink = document.getElementById('download-retry-link');
            if (retryLink) {
                retryLink.href = apkUrl;
                retryLink.setAttribute('download', apkUrl.split('/').pop());
            }
        }

        resetButton(btn, idleLabel, 4000);
    }, 400);
}

// ---------------------------------------------------------------------------
// Landing CTA — Android vs Non-Android
// ---------------------------------------------------------------------------

function adaptLandingCTA(apkUrl, version) {
    var downloadBtn = document.getElementById('landing-download-apk-btn');
    var androidHint = document.getElementById('landing-android-hint');

    if (!downloadBtn) return;

    downloadBtn.href = apkUrl;
    downloadBtn.setAttribute('download', apkUrl.split('/').pop());

    // Replace previous click listener cleanly
    var newBtn = downloadBtn.cloneNode(true);
    if (downloadBtn.parentNode) {
        downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
    }

    newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        handleDownloadClick(newBtn, apkUrl, version, 'landing');
    });

    if (androidHint) {
        androidHint.classList.add('hidden');
    }
}

// ---------------------------------------------------------------------------
// Download Page Button
// ---------------------------------------------------------------------------

function initDownloadPageButton(apkUrl, version) {
    var btn = document.getElementById('download-apk-btn');
    if (!btn) return;
    btn.href = apkUrl;
    // Remove any previous listener to avoid double-firing on manifest re-init
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        handleDownloadClick(newBtn, apkUrl, version, 'download_page');
    });
}

// ---------------------------------------------------------------------------
// Feedback Links
// ---------------------------------------------------------------------------

function wireFeedbackLinks() {
    var feedbackUrl = window.CONFIG && window.CONFIG.EARLY_ACCESS_FORM_URL;
    if (!feedbackUrl) return;
    document.querySelectorAll('[data-feedback-link]').forEach(function(el) {
        el.href = feedbackUrl;
    });
    var dlFeedback = document.getElementById('download-feedback-link');
    if (dlFeedback) dlFeedback.href = feedbackUrl;
}

// ---------------------------------------------------------------------------
// Download Page Viewed Analytics
// ---------------------------------------------------------------------------

function trackDownloadPageView(version) {
    analytics.capture('Download Page Viewed', {
        version:  version,
        platform: getPlatform(),
        browser:  getBrowser(),
        source:   'download_screen',
    });
}

// ---------------------------------------------------------------------------
// Public Init — called once from app.js
// ---------------------------------------------------------------------------

export function initDownload() {
    var apkUrl  = window.CONFIG && window.CONFIG.LATEST_ANDROID_APK_URL;
    var version = '1.0.2'; // fallback until manifest loads

    wireFeedbackLinks();
    adaptLandingCTA(apkUrl, version);
    initDownloadPageButton(apkUrl, version);

    // Analytics: fire when download screen is entered via router
    window.addEventListener('me:download-page-viewed', function() {
        trackDownloadPageView(version);
    });

    // Load manifest and hydrate download page
    fetchManifest().then(function(manifest) {
        if (!manifest || !manifest.latest) return;
        version = manifest.latest.version || version;

        // Re-wire buttons with correct version
        adaptLandingCTA(apkUrl, version);
        initDownloadPageButton(apkUrl, version);

        populateDownloadPage(manifest.latest);

        if (manifest.history) {
            renderReleaseHistory(manifest.history);
        }
    });
}