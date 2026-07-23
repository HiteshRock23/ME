/**
 * MemoryController
 *
 * The single coordinator between the Router, API, and Memory Viewer.
 *
 * Responsibilities:
 *   - Manage the Memory Viewer state machine
 *   - In-memory LRU cache for loaded memories
 *   - Progressive loading (open immediately, hydrate later)
 *   - Error handling that keeps the viewer open (never auto-dismisses)
 *   - Browser history (back/forward)
 *
 * Architecture:
 *   Router → MemoryController.open(id) → API → MemoryViewer (ui.js)
 *
 * The MemoryController is the ONLY place that calls:
 *   - api.getMemory()
 *   - ui.openMemoryViewer() / ui.closeMemoryViewer()
 *
 * No other module should call these directly.
 */

import { api } from './api.js';
import { ui } from './ui.js';
import { analytics } from './analytics.js';

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

/** @type {'closed' | 'loading' | 'ready' | 'error'} */
let _state = 'closed';

/** @type {string | null} Currently displayed memory ID */
let _currentId = null;

/** Simple LRU cache: id → Memory object */
const _cache = new Map();
const CACHE_MAX = 50;

// ---------------------------------------------------------------------------
// Private Helpers
// ---------------------------------------------------------------------------

function _setState(next) {
    _state = next;
}

function _addToCache(id, memory) {
    if (_cache.size >= CACHE_MAX) {
        // Remove the oldest entry (first key)
        const oldest = _cache.keys().next().value;
        _cache.delete(oldest);
    }
    _cache.set(String(id), memory);
}

function _fromCache(id) {
    return _cache.get(String(id)) || null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const memoryController = {

    /**
     * Open the Memory Viewer for a given id.
     * Called exclusively by the Router on route /memory/:id.
     *
     * Flow:
     *   1. Open viewer immediately with a skeleton / cached data
     *   2. Fetch full memory from API (or serve from cache)
     *   3. Hydrate viewer with full data
     *   4. Fetch related memories asynchronously
     *
     * @param {string} id
     */
    async open(id) {
        const sid = String(id);
        console.log('[MC] open() called with id:', sid, '| state:', _state, '| currentId:', _currentId);

        _currentId = sid;

        // Step 1: Open the viewer immediately
        const cached = _fromCache(sid);
        if (cached) {
            console.log('[MC] cache hit for', sid);
            _setState('ready');
            ui.openMemoryViewer(cached);
            this._fetchRelated(cached);
            analytics.track('Memory Detail Viewed (Cache Hit)', { id: sid });
            return;
        }

        // No cache — open viewer with skeleton loading state
        console.log('[MC] no cache, opening loading skeleton');
        _setState('loading');
        ui.openMemoryViewerLoading();
        analytics.track('Memory Detail Viewed', { id: sid });

        // Step 2: Fetch full memory
        try {
            console.log('[MC] fetching memory from API:', sid);
            const memory = await api.getMemory(sid);
            console.log('[MC] API returned memory:', memory);
            _addToCache(sid, memory);

            if (_currentId !== sid) {
                console.log('[MC] currentId changed during fetch, aborting hydration');
                return;
            }

            _setState('ready');
            console.log('[MC] hydrating viewer...');
            ui.hydrateMemoryViewer(memory);
            this._fetchRelated(memory);

        } catch (err) {
            console.error('[MC] API error:', err);
            if (_currentId !== sid) return;
            _setState('error');
            ui.showMemoryViewerError(err.message, () => {
                _setState('closed');
                this.open(sid);
            });
        }
    },

    /**
     * Close the Memory Viewer.
     * Called by the Router on any non-memory route.
     * Called by UI close button → Router.navigate('/dashboard').
     */
    close() {
        console.log('[MC] close() called | state:', _state);
        if (_state === 'closed') return;
        _currentId = null;
        _setState('closed');
        ui.closeMemoryViewer();
    },


    /**
     * Pre-warm the cache for a memory the user is likely to open.
     * Called on hover over memory cards for near-instant opens.
     *
     * @param {string} id
     */
    async prefetch(id) {
        const sid = String(id);
        if (_fromCache(sid)) return; // Already cached
        try {
            const memory = await api.getMemory(sid);
            _addToCache(sid, memory);
        } catch (_) {
            // Silently discard prefetch errors
        }
    },

    /**
     * Invalidate a specific memory in the cache.
     * Called after edit or delete.
     *
     * @param {string} id
     */
    invalidate(id) {
        _cache.delete(String(id));
    },

    /**
     * Fetch related memories and push them into the viewer.
     * Private. Called only internally after a successful load.
     *
     * @param {object} memory
     */
    async _fetchRelated(memory) {
        if (!memory || !memory.id) return;
        try {
            const res = await api.getRelatedMemories(memory.id);
            const related = res.results || [];
            ui.renderRelatedMemories(related);
        } catch (_) {
            // Silently discard related errors — they are non-critical
        }
    },

    /** Current state (for debugging) */
    get state() { return _state; },

    /** Current memory id (for debugging) */
    get currentId() { return _currentId; },
};
