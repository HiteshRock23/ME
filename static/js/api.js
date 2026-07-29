import { auth } from './auth.js';
import { analytics } from './analytics.js';

/**
 * API Module
 * Handles interactions with the backend ME API.
 */

const API_URLS = {
    memories: '/api/memories/',
    capture: '/api/memories/capture/',
    search: '/api/memories/search/',
    ask: '/api/memories/ask/',
    analyzeLink: '/api/memories/analyze-link/',
};

// Internal fetch wrapper that automatically handles Bearer tokens and 401 refresh
async function apiFetch(url, options = {}) {
    if (!auth.isAuthenticated()) {
        throw new Error("Unauthorized");
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.getAccessToken()}`,
        ...(options.headers || {})
    };

    const startTime = performance.now();
    const method = options.method || 'GET';
    let response;
    let errorOccurred = false;
    let statusCode = null;
    let errMsg = null;

    try {
        response = await fetch(url, { ...options, headers });

        // Handle token expiration
        if (response.status === 401) {
            try {
                await auth.refreshToken();
                // Retry the original request with the new token
                headers['Authorization'] = `Bearer ${auth.getAccessToken()}`;
                response = await fetch(url, { ...options, headers });
            } catch (e) {
                auth.clearTokens();
                throw new Error("Session expired. Please log in again.");
            }
        }

        statusCode = response.status;

        // Handle generic errors
        if (!response.ok) {
            errorOccurred = true;
            let msg = "A network error occurred.";
            let existingMemory = null;
            try {
                const data = await response.json();
                msg = data.detail || data.error || JSON.stringify(data);
                if (data.existing_memory) {
                    existingMemory = data.existing_memory;
                }
            } catch(e) {}
            errMsg = msg;
            const err = new Error(msg);
            err.status = statusCode;
            if (existingMemory) {
                err.existingMemory = existingMemory;
            }
            throw err;
        }

        // Handle 204 No Content for delete
        if (response.status === 204) {
            return null;
        }

        return await response.json();

    } catch (err) {
        errorOccurred = true;
        if (!errMsg) errMsg = err.message || "Unknown error";
        throw err;
    } finally {
        const endTime = performance.now();
        const durationMs = endTime - startTime;

        if (errorOccurred) {
            analytics.capture('API Error', {
                endpoint: url,
                method: method,
                status_code: statusCode,
                duration_ms: durationMs,
                error_type: errMsg
            });
        }
    }
}

export const api = {
    async captureMemory(content, linkTitle = "", previewId = null) {
        const payload = { raw_content: content };
        if (linkTitle) payload.link_title = linkTitle;
        if (previewId) payload.preview_id = previewId;

        return await apiFetch(API_URLS.capture, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async analyzeLink(url) {
        const response = await fetch(API_URLS.analyzeLink, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        if (!response.ok) {
            let msg = "Failed to analyze link.";
            try {
                const data = await response.json();
                msg = data.error || data.detail || msg;
            } catch(e) {}
            throw new Error(msg);
        }
        
        return await response.json();
    },

    async getMemories() {
        return await apiFetch(API_URLS.memories);
    },

    async getMemory(id) {
        return await apiFetch(`${API_URLS.memories}${id}/`);
    },

    async getRelatedMemories(id) {
        return await apiFetch(`${API_URLS.memories}${id}/related/`);
    },

    async deleteMemory(id) {
        return await apiFetch(`${API_URLS.memories}${id}/`, {
            method: 'DELETE'
        });
    },

    async updateMemoryTitle(id, linkTitle) {
        return await apiFetch(`${API_URLS.memories}${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ link_title: linkTitle })
        });
    },

    async updateMemoryContent(id, rawContent) {
        return await apiFetch(`${API_URLS.memories}${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ raw_content: rawContent })
        });
    },

    async searchMemories(query) {
        return await apiFetch(`${API_URLS.search}?q=${encodeURIComponent(query)}`);
    },
    
    async askQuestion(question) {
        return await apiFetch(API_URLS.ask, {
            method: 'POST',
            body: JSON.stringify({ question })
        });
    }
};
