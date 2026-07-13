import { auth } from './auth.js';

/**
 * API Module
 * Handles interactions with the backend ME API.
 */

const API_BASE = '/api/memories';

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

    let response = await fetch(url, { ...options, headers });

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

    // Handle generic errors
    if (!response.ok) {
        let msg = "A network error occurred.";
        try {
            const data = await response.json();
            msg = data.detail || JSON.stringify(data);
        } catch(e) {}
        throw new Error(msg);
    }

    // Handle 204 No Content for delete
    if (response.status === 204) {
        return null;
    }

    return await response.json();
}

export const api = {
    async captureMemory(content) {
        return await apiFetch(`${API_BASE}/capture/`, {
            method: 'POST',
            body: JSON.stringify({ raw_content: content })
        });
    },

    async getMemories() {
        return await apiFetch(`${API_BASE}/`);
    },

    async deleteMemory(id) {
        return await apiFetch(`${API_BASE}/${id}/`, {
            method: 'DELETE'
        });
    },

    async searchMemories(query) {
        return await apiFetch(`${API_BASE}/search/?q=${encodeURIComponent(query)}`);
    },
    
    async askQuestion(question) {
        return await apiFetch(`${API_BASE}/ask/`, {
            method: 'POST',
            body: JSON.stringify({ question })
        });
    }
};
