import { auth } from './auth.js';
import { api } from './api.js';
import { ui } from './ui.js';

/**
 * App Initialization
 * Coordinates auth, api, and ui to run the application.
 */

async function loadMemories() {
    ui.setTimelineLoading();
    try {
        const memories = await api.getMemories();
        ui.renderTimeline(memories, async (id) => {
            await api.deleteMemory(id);
            ui.removeMemoryCard(id);
        });
        startPollingIfPending();
    } catch (e) {
        ui.showError("Failed to load memories: " + e.message);
        if (e.message.includes("Session expired") || e.message.includes("Unauthorized")) {
            ui.showScreen('auth-screen');
        } else {
            ui.renderTimeline([], () => {});
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
                        if (oldStatus !== mem.ai_status) {
                            ui.updateMemoryCard(mem, async (id) => {
                                await api.deleteMemory(id);
                                ui.removeMemoryCard(id);
                            });
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
            ui.showScreen('app-screen');
            loadMemories();
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
    const refreshBtn = document.getElementById('refresh-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (captureInput) {
        captureInput.addEventListener('input', () => {
            ui.updateCharCount();
        });
    }

    if (captureBtn) {
        captureBtn.addEventListener('click', async () => {
            const content = captureInput.value.trim();
            if (!content) return;

            ui.setCaptureState(true);

            try {
                await api.captureMemory(content);
                ui.clearCaptureInput();
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
                try {
                    const response = await api.searchMemories(query);
                    ui.renderSearchResults(response.results, async (id) => {
                        await api.deleteMemory(id);
                        // For simplicity, just clear and reload search if we delete a search result
                        const curQuery = searchInput.value.trim();
                        if (curQuery) {
                            const newResp = await api.searchMemories(curQuery);
                            ui.renderSearchResults(newResp.results, async (id) => {
                                await api.deleteMemory(id);
                                ui.clearSearch();
                                loadMemories();
                            });
                        }
                    });
                } catch (err) {
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
            try {
                const response = await api.askQuestion(question);
                ui.setAskLoading(false);
                ui.renderAskAnswer(response);
            } catch (err) {
                ui.setAskLoading(false);
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
            ui.showScreen('auth-screen');
        });
    }
}

function init() {
    initAuthListeners();
    initAppListeners();

    if (auth.isAuthenticated()) {
        ui.showScreen('app-screen');
        loadMemories();
    } else {
        ui.showScreen('auth-screen');
    }
}

// Start application
document.addEventListener('DOMContentLoaded', init);
