/**
 * ME Loading Controller
 * Centralized loading state manager for asynchronous operations.
 */

let activeLoadersCount = 0;
const listeners = new Set();

export const Loading = {
    start() {
        activeLoadersCount++;
        this.notify();
    },

    stop() {
        if (activeLoadersCount > 0) {
            activeLoadersCount--;
            this.notify();
        }
    },

    isLoading() {
        return activeLoadersCount > 0;
    },

    reset() {
        activeLoadersCount = 0;
        this.notify();
    },

    onChange(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },

    notify() {
        const loading = this.isLoading();
        for (const fn of listeners) {
            try { fn(loading, activeLoadersCount); } catch (e) { console.error('[Loading] Listener error:', e); }
        }
    }
};

if (typeof window !== 'undefined') {
    window.Loading = Loading;
}
