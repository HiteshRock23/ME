import { auth } from './auth.js';
import { api } from './api.js';
import { ui } from './ui.js?v=3';
import { initPWA, promptInstall, dismissBanner, refreshApp } from './pwa.js';
import { initGoogleAuth } from './google.js';
import { router } from './router.js';
import { analytics } from './analytics.js';
import { memoryController } from './memory-controller.js';
import { CONFIG } from './config.js';

// --- Dev Cache Clearing & Auto-Login Backdoor ---
const searchParams = new URLSearchParams(window.location.search);
if (searchParams.has('clear_cache')) {
    if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let reg of registrations) {
                reg.unregister();
            }
        });
    }
    if (window.caches) {
        caches.keys().then(names => {
            for (let name of names) {
                caches.delete(name);
            }
        });
    }
    console.log("[DEV] Service worker and PWA Cache cleared.");
}

if (searchParams.has('dev_login')) {
    localStorage.setItem('me_access', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzg1MDUzNzYyLCJpYXQiOjE3ODUwNTE5NjIsImp0aSI6ImY2MjliMzBmNmQ3MTRjMzhhNWM2MjZhOGI2OTM2NjY4IiwidXNlcl9pZCI6MX0.mGt196kz5UoSohANnR8h5bIkUblCtIUbHu4IGtlicXo');
    localStorage.setItem('me_refresh', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NTY1Njc2MiwiaWF0IjoxNzg1MDUxOTYyLCJqdGkiOiJjNjIwNjhkOGUzOWI0ZjBiYWQzYzYyZjIxNjNhNTZmNCIsInVzZXJfaWQiOjF9.5GhTgdErsVkzttqk9RSEBkkuZExhLWvSWUX2W_vh4Vw');
    sessionStorage.setItem('me_access', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzg1MDUzNzYyLCJpYXQiOjE3ODUwNTE5NjIsImp0aSI6ImY2MjliMzBmNmQ3MTRjMzhhNWM2MjZhOGI2OTM2NjY4IiwidXNlcl9pZCI6MX0.mGt196kz5UoSohANnR8h5bIkUblCtIUbHu4IGtlicXo');
    sessionStorage.setItem('me_refresh', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc4NTY1Njc2MiwiaWF0IjoxNzg1MDUxOTYyLCJqdGkiOiJjNjIwNjhkOGUzOWI0ZjBiYWQzYzYyZjIxNjNhNTZmNCIsInVzZXJfaWQiOjF9.5GhTgdErsVkzttqk9RSEBkkuZExhLWvSWUX2W_vh4Vw');
    
    // Clean up query string and reload dashboard with cache buster
    const cleanUrl = new URL(window.location);
    cleanUrl.searchParams.delete('dev_login');
    cleanUrl.searchParams.delete('clear_cache');
    window.location.href = cleanUrl.pathname + '?v=3';
}

/**
 * App Initialization
 * Coordinates auth, api, and ui to run the application.
 */

async function handleDeleteClick(id) {
    await api.deleteMemory(id);
    ui.removeMemoryCard(id);
    analytics.capture('Memory Deleted', { memory_id: id });
}

async function handleEditTitleClick(id, newTitle) {
    const updatedMemory = await api.updateMemoryTitle(id, newTitle);
    ui.updateMemoryCard(updatedMemory, handleDeleteClick, handleEditTitleClick);
    analytics.capture('Memory Edited', {
        memory_id: id,
        memory_type: updatedMemory.memory_type || 'note',
        field: 'title'
    });
}

async function loadMemories() {
    ui.setTimelineLoading();
    try {
        const memories = await api.getMemories();
        ui.renderTimeline(memories, handleDeleteClick, handleEditTitleClick);
        startPollingIfPending();
        analytics.capture('Timeline Viewed', {
            result_count: memories ? memories.length : 0
        });
    } catch (e) {
        if (e.message.includes("Session expired") || e.message.includes("Unauthorized")) {
            auth.clearTokens();
            router.navigate('/auth');
        } else {
            ui.showError("Failed to load memories: " + e.message);
            ui.renderTimeline([], handleDeleteClick, handleEditTitleClick);
        }
    }
}

let pollingInterval = null;

function startPollingIfPending() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    // Check if any card has pending/processing status
    const pendingCards = document.querySelectorAll('.memory-card[data-ai-status="pending"], .memory-card[data-ai-status="processing"]');
    if (pendingCards.length > 0) {
        pollingInterval = setInterval(async () => {
            try {
                const memories = await api.getMemories();
                let stillPending = false;
                
                memories.forEach(mem => {
                    const card = document.getElementById(`memory-${mem.id}`);
                    if (card) {
                        const oldStatus = card.dataset.aiStatus;
                        const titleEl = card.querySelector('.memory-card-title');
                        const isTempTitle = titleEl && (titleEl.textContent === 'New Memory' || titleEl.textContent === 'Link Saved');
                        const hasNewTitle = mem.ai_title && isTempTitle;

                        if (oldStatus !== mem.ai_status || hasNewTitle) {
                            ui.updateMemoryCard(mem, handleDeleteClick, handleEditTitleClick);
                        }
                        if (mem.ai_status === 'pending' || mem.ai_status === 'processing') {
                            stillPending = true;
                        }
                    }
                });
                
                if (!stillPending) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                }
            } catch (e) {
                // Ignore silent poll errors
            }
        }, 3000);
    }
}

function initAuthListeners() {
    const authForm = document.getElementById('auth-form');
    if (!authForm) return;

    let authMode = 'login'; // 'login' or 'register'

    const switchText = document.getElementById('auth-switch-text');
    if (switchText) {
        switchText.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                e.preventDefault();
                authMode = authMode === 'login' ? 'register' : 'login';
                
                document.getElementById('auth-title').textContent = authMode === 'login' ? 'Welcome back' : 'Create your space';
                document.getElementById('auth-subtitle').textContent = authMode === 'login' ? 'Your digital sanctuary awaits' : 'Start capturing your thoughts today';
                
                const nameGroup = document.getElementById('name-group');
                if (nameGroup) nameGroup.classList.toggle('hidden', authMode === 'login');
                
                document.getElementById('auth-btn').textContent = authMode === 'login' ? 'Sign in' : 'Create account';
                e.target.textContent = authMode === 'login' ? 'Sign up' : 'Sign in';
                e.target.previousSibling.textContent = authMode === 'login' ? "Don't have an account? " : "Already have an account? ";
            }
        });
    }

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email-input').value.trim();
        const password = document.getElementById('password-input').value;
        const btn = document.getElementById('auth-btn');

        if (!email || !password) {
            ui.showError('Please enter email and password.');
            return;
        }

        const originalText = btn.textContent;
        btn.textContent = 'Processing...';
        btn.disabled = true;

        try {
            if (authMode === 'login') {
                await auth.login(email, password);
            } else {
                const firstName = document.getElementById('first-name-input').value.trim();
                const lastName = document.getElementById('last-name-input').value.trim();
                if (!firstName || !lastName) {
                    throw new Error('Please enter first and last name.');
                }
                await auth.register(firstName, lastName, email, password);
            }
            
            // Success
            router.navigate('/dashboard');
            document.getElementById('capture-input').focus();
        } catch (err) {
            ui.showError(err.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}

function initAppListeners() {
    const captureInput = document.getElementById('capture-input');
    const captureBtn = document.getElementById('capture-btn');
    const linkTitleInput = document.getElementById('link-title-input');
    const refreshBtn = document.getElementById('refresh-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (captureInput) {
        captureInput.addEventListener('input', () => {
            ui.updateCharCount();
            
            if (linkTitleInput) {
                const val = captureInput.value.trim();
                const isUrl = val.length > 0 && !val.includes(' ') && !val.includes('\n') && 
                              (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('www.'));
                if (isUrl) {
                    linkTitleInput.classList.remove('hidden');
                } else {
                    linkTitleInput.classList.add('hidden');
                }
            }
        });
    }

    if (captureBtn) {
        captureBtn.addEventListener('click', async () => {
            const content = captureInput.value.trim();
            if (!content) return;
            
            const linkTitle = (linkTitleInput && !linkTitleInput.classList.contains('hidden')) 
                ? linkTitleInput.value.trim() : "";

            ui.setCaptureState(true);

            const captureStartTime = performance.now();
            try {
                const response = await api.captureMemory(content, linkTitle);
                const durationMs = performance.now() - captureStartTime;

                analytics.capture('Memory Created', {
                    memory_id: response.id,
                    memory_type: response.memory_type || 'note',
                    duration_ms: durationMs,
                    source: 'capture_input'
                });

                if (response.memory_type === 'link') {
                    analytics.capture('Link Saved', {
                        memory_id: response.id,
                        duration_ms: durationMs
                    });
                }

                ui.clearCaptureInput();
                if (linkTitleInput) {
                    linkTitleInput.value = '';
                    linkTitleInput.classList.add('hidden');
                }
                // Reload timeline to show the new memory (which will be in pending state)
                await loadMemories();
            } catch (err) {
                ui.showError(err.message);
            } finally {
                ui.setCaptureState(false);
                ui.fixCaptureState(false); // Make sure button disabled state matches input length
            }
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadMemories();
        });
    }

    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    if (searchInput) {
        searchInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (!query) return;

                ui.setSearchLoading();
                const searchStartTime = performance.now();
                analytics.capture('Search Started', {
                    search_length: query.length
                });
                analytics.capture('AI Search Used', {
                    search_length: query.length
                });

                try {
                    const response = await api.searchMemories(query);
                    const durationMs = performance.now() - searchStartTime;

                    analytics.capture('Search Completed', {
                        search_length: query.length,
                        result_count: response.results ? response.results.length : 0,
                        duration_ms: durationMs
                    });

                    ui.renderSearchResults(response.results, async (id) => {
                        await handleDeleteClick(id);
                        // For simplicity, just clear and reload search if we delete a search result
                        const curQuery = searchInput.value.trim();
                        if (curQuery) {
                            const newResp = await api.searchMemories(curQuery);
                            ui.renderSearchResults(newResp.results, async (delId) => {
                                await handleDeleteClick(delId);
                                ui.clearSearch();
                                loadMemories();
                            }, handleEditTitleClick);
                        }
                    }, handleEditTitleClick);
                } catch (err) {
                    const durationMs = performance.now() - searchStartTime;
                    analytics.capture('Search Failed', {
                        search_length: query.length,
                        error_message: err.message || 'Unknown error',
                        duration_ms: durationMs
                    });
                    ui.showError("Search failed: " + err.message);
                    ui.clearSearch();
                }
            }
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            ui.clearSearch();
            // Don't need to reload memories, they are just hidden
        });
    }

    const askInput = document.getElementById('ask-input');
    const askBtn = document.getElementById('ask-btn');
    const askClearBtn = document.getElementById('ask-clear-btn');
    
    if (askBtn && askInput) {
        const handleAsk = async () => {
            const question = askInput.value.trim();
            if (!question) return;
            
            ui.setAskLoading(true);
            const askStartTime = performance.now();
            analytics.capture('AI Ask Started', {
                search_length: question.length
            });

            try {
                const response = await api.askQuestion(question);
                const durationMs = performance.now() - askStartTime;

                analytics.capture('AI Ask Completed', {
                    search_length: question.length,
                    result_count: response.referenced_memories ? response.referenced_memories.length : 0,
                    response_time_ms: durationMs,
                    ai_provider: response.ai_provider || 'nvidia'
                });

                ui.setAskLoading(false);
                ui.renderAskAnswer(response);
            } catch (err) {
                const durationMs = performance.now() - askStartTime;
                analytics.capture('AI Ask Failed', {
                    search_length: question.length,
                    error_message: err.message || 'Unknown error',
                    response_time_ms: durationMs
                });

                ui.setAskLoading(false);
                ui.clearAskAnswer();   // Hide the white container on error
                ui.showError(err.message);
            }
        };
        
        askBtn.addEventListener('click', handleAsk);
        askInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAsk();
            }
        });
    }
    
    if (askClearBtn) {
        askClearBtn.addEventListener('click', () => {
            ui.clearAskAnswer();
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await auth.logout();
            router.navigate('/');
        });
    }

    const pwaNavBtn = document.getElementById('pwa-nav-btn');
    if (pwaNavBtn) pwaNavBtn.addEventListener('click', promptInstall);

    const pwaBannerBtn = document.getElementById('pwa-banner-install-btn');
    if (pwaBannerBtn) pwaBannerBtn.addEventListener('click', promptInstall);

    const pwaBannerDismissBtn = document.getElementById('pwa-banner-dismiss-btn');
    if (pwaBannerDismissBtn) pwaBannerDismissBtn.addEventListener('click', dismissBanner);

    const pwaUpdateRefreshBtn = document.getElementById('pwa-update-refresh-btn');
    if (pwaUpdateRefreshBtn) pwaUpdateRefreshBtn.addEventListener('click', refreshApp);

    // Drawer close handlers
    const drawerCloseBtn = document.getElementById('drawer-close-btn');
    const drawerBackdrop = document.getElementById('memory-drawer-backdrop');

    // Viewer close: all paths go through router → MemoryController.close() → ui.closeMemoryViewer()
    const handleCloseViewer = () => {
        if (window.location.pathname.startsWith('/memory/')) {
            router.navigate('/dashboard');
        } else {
            // If somehow on dashboard already, just close visually (checking unsaved changes first)
            if (ui.hasUnsavedChanges && ui.hasUnsavedChanges()) {
                if (!confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                    return;
                }
                ui.resetUnsavedChanges();
            }
            ui.closeMemoryViewer();
        }
    };

    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', handleCloseViewer);
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', handleCloseViewer);

    // Click delegation: Ask ME referenced memories → Router
    const askSourcesGrid = document.getElementById('ask-sources-grid');
    if (askSourcesGrid) {
        askSourcesGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.memory-reference-card');
            if (card && card.dataset.memoryId) {
                router.navigate(`/memory/${card.dataset.memoryId}`);
            }
        });
    }

    // Click delegation: Related memories inside the viewer → Router
    const drawerRelatedGrid = document.getElementById('drawer-related-grid');
    if (drawerRelatedGrid) {
        drawerRelatedGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.memory-reference-card');
            if (card && card.dataset.memoryId) {
                router.navigate(`/memory/${card.dataset.memoryId}`);
            }
        });
    }

    // Keyboard: Escape closes viewer via Router
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.location.pathname.startsWith('/memory/')) {
            router.navigate('/dashboard');
        }
    });

    // Early Access / Feedback click handler with event delegation
    const landingScreen = document.getElementById('landing-screen');
    if (landingScreen) {
        landingScreen.addEventListener('click', (e) => {
            const trigger = e.target.closest('.early-access-trigger');
            if (trigger) {
                e.preventDefault();
                
                const location = trigger.getAttribute('data-location') || 'Unknown';
                
                // Track: Upgrade Button Clicked & Early Access CTA Click
                analytics.capture('Upgrade Button Clicked', {
                    source: `Early Access - ${location}`
                });
                analytics.track('Early Access CTA Click', { Location: location });
                
                // Fetch the Google Form URL from configuration
                const formUrl = CONFIG.EARLY_ACCESS_FORM_URL;
                if (formUrl) {
                    const newWindow = window.open(formUrl, '_blank');
                    // Return focus after a short delay for accessibility
                    if (newWindow) {
                        trigger.focus();
                    }
                } else {
                    console.error("Early Access Form URL is not configured in CONFIG.");
                }
            }
        });
    }

    // Paywall Modal Upgrade Button
    const paywallUpgradeBtn = document.querySelector('.paywall-upgrade-btn');
    if (paywallUpgradeBtn) {
        paywallUpgradeBtn.addEventListener('click', () => {
            analytics.capture('Upgrade Button Clicked', {
                source: 'Paywall Modal'
            });
        });
    }

    // Track Pricing Viewed using IntersectionObserver
    const pricingSection = document.getElementById('pricing');
    if (pricingSection) {
        let pricingTracked = false;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !pricingTracked) {
                    analytics.capture('Pricing Viewed', { source: 'Landing Page' });
                    pricingTracked = true;
                }
            });
        }, { threshold: 0.2 });
        observer.observe(pricingSection);
    }
}


function init() {
    initPWA();
    initGoogleAuth();
    initAuthListeners();
    initAppListeners();

    analytics.initScrollTracking();

    // Dashboard enter: load the timeline.
    // Fired by the Router on /dashboard and on /memory/:id (deep links only, when feed is empty).
    // Debounce guard prevents double-fetch on rapid navigation.
    let _dashboardLoadPending = false;
    window.addEventListener('me:dashboard-enter', async () => {
        if (_dashboardLoadPending) return;
        _dashboardLoadPending = true;
        try {
            await loadMemories();
        } finally {
            _dashboardLoadPending = false;
        }
    });

    // Memory mutated (edit title or delete): refresh the timeline.
    window.addEventListener('me:memory-mutated', (e) => {
        loadMemories();
    });

    // Memory card events — dispatched by ui.js, handled here where router+memoryController are available
    window.addEventListener('me:open-memory', (e) => {
        router.navigate(`/memory/${e.detail.id}`);
    });
    window.addEventListener('me:prefetch-memory', (e) => {
        memoryController.prefetch(e.detail.id);
    });
    window.addEventListener('me:invalidate-memory', (e) => {
        memoryController.invalidate(e.detail.id);
    });
    window.addEventListener('me:navigate', (e) => {
        router.navigate(e.detail.path);
    });

    router.init();
}

// Start application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Hotkey listener for Cmd/Ctrl + K
document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const captureInput = document.getElementById('capture-input');
        if (captureInput) {
            captureInput.focus();
            if (window.analytics) window.analytics.track('Hotkey Used', { key: 'Cmd+K' });
        }
    }
});

