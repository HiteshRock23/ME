/**
 * ME Application Lifecycle Observer
 * Centralizes visibilitychange, focus, blur, and native Capacitor pause/resume events.
 * Prevents multiple modules from binding duplicate document event listeners.
 */

const resumeListeners = new Set();
const pauseListeners = new Set();
const foregroundListeners = new Set();

let isVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        const currentlyVisible = document.visibilityState === 'visible';
        if (currentlyVisible !== isVisible) {
            isVisible = currentlyVisible;
            if (isVisible) {
                notifyListeners(resumeListeners);
                notifyListeners(foregroundListeners);
            } else {
                notifyListeners(pauseListeners);
            }
        }
    });

    window.addEventListener('focus', () => {
        if (!isVisible) {
            isVisible = true;
            notifyListeners(resumeListeners);
            notifyListeners(foregroundListeners);
        }
    });

    window.addEventListener('blur', () => {
        // window blur event
    });
}

// Bind Capacitor native pause/resume events if available
if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.App) {
    try {
        window.Capacitor.Plugins.App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                notifyListeners(resumeListeners);
                notifyListeners(foregroundListeners);
            } else {
                notifyListeners(pauseListeners);
            }
        });
    } catch (e) {
        // Ignore Capacitor app state binding error
    }
}

function notifyListeners(set) {
    for (const fn of set) {
        try { fn(); } catch (err) { console.error('[Lifecycle] Listener error:', err); }
    }
}

export const Lifecycle = {
    onResume(fn) {
        resumeListeners.add(fn);
        return () => resumeListeners.delete(fn);
    },

    onPause(fn) {
        pauseListeners.add(fn);
        return () => pauseListeners.delete(fn);
    },

    onForeground(fn) {
        foregroundListeners.add(fn);
        return () => foregroundListeners.delete(fn);
    },

    isForeground() {
        return isVisible;
    }
};

if (typeof window !== 'undefined') {
    window.Lifecycle = Lifecycle;
}
