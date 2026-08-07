import { network } from './network.js';

/**
 * API Module
 * High-level API service for ME application domain methods.
 * Delegates all HTTP requests to the centralized network layer.
 */

const ENDPOINTS = {
    memories: '/api/memories/',
    capture: '/api/memories/capture/',
    search: '/api/memories/search/',
    ask: '/api/memories/ask/',
    analyzeLink: '/api/memories/analyze-link/',
};

export const api = {
    async captureMemory(content, linkTitle = "", previewId = null, isPinned = false) {
        let payload;
        if (content && typeof content === 'object') {
            payload = content;
        } else {
            payload = { raw_content: content };
            if (linkTitle) payload.link_title = linkTitle;
            if (previewId) payload.preview_id = previewId;
            if (isPinned) payload.is_pinned = true;
        }

        return await network.post(ENDPOINTS.capture, payload);
    },

    async pinMemory(id) {
        return await network.post(`${ENDPOINTS.memories}${id}/pin/`);
    },

    async unpinMemory(id) {
        return await network.post(`${ENDPOINTS.memories}${id}/unpin/`);
    },

    async analyzeLink(url) {
        return await network.post(ENDPOINTS.analyzeLink, { url }, { skipAuth: true });
    },

    async getMemories() {
        return await network.get(ENDPOINTS.memories);
    },

    async getMemory(id) {
        return await network.get(`${ENDPOINTS.memories}${id}/`);
    },

    async getRelatedMemories(id) {
        return await network.get(`${ENDPOINTS.memories}${id}/related/`);
    },

    async deleteMemory(id) {
        return await network.delete(`${ENDPOINTS.memories}${id}/`);
    },

    async updateMemoryTitle(id, linkTitle) {
        return await network.patch(`${ENDPOINTS.memories}${id}/`, { link_title: linkTitle });
    },

    async updateMemoryContent(id, rawContent) {
        return await network.patch(`${ENDPOINTS.memories}${id}/`, { raw_content: rawContent });
    },

    async searchMemories(query) {
        return await network.get(`${ENDPOINTS.search}?q=${encodeURIComponent(query)}`);
    },
    
    async askQuestion(question) {
        return await network.post(ENDPOINTS.ask, { question });
    },

    async shareMemory(id) {
        return await network.post(`${ENDPOINTS.memories}${id}/share/`);
    },

    async regenerateShareMemory(id) {
        return await network.post(`${ENDPOINTS.memories}${id}/share/regenerate/`);
    },

    async revokeShareMemory(id) {
        return await network.delete(`${ENDPOINTS.memories}${id}/share/`);
    },

    async getPublicMemory(token) {
        return await network.get(`/api/shared/${encodeURIComponent(token)}/`, { skipAuth: true });
    }
};

if (typeof window !== 'undefined') {
    window.api = api;
}
