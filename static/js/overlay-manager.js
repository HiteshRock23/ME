/**
 * OverlayManager
 *
 * Decoupled, production-grade overlay manager for drawers, modals, and bottom sheets.
 * Architecture Rules:
 *   - Persistent Overlay: Memory Drawer
 *   - Transient Overlay: Share Modal, Dialogs, Bottom Sheets
 *   - Rules:
 *       1. Only one transient overlay may exist at a time.
 *       2. Persistent overlays remain active underneath transient overlays.
 *       3. Closing a persistent overlay automatically closes any transient overlays.
 *       4. Closing a transient overlay restores focus to the element that opened it.
 */

class OverlayManager {
    constructor() {
        /** @type {Array<{id: string, type: 'persistent'|'transient', closeCallback: Function, triggerElement?: HTMLElement}>} */
        this._stack = [];
        this._initGlobalListeners();
    }

    /**
     * Register and open an overlay.
     * @param {string} id Unique identifier for the overlay
     * @param {Function} closeCallback Function to execute when closing via ESC or backdrop
     * @param {object} [options]
     * @param {'persistent'|'transient'} [options.type='transient']
     * @param {HTMLElement} [options.triggerElement] Element that triggered the overlay (for focus restoration)
     * @param {HTMLElement} [options.initialFocus] Element to receive initial focus
     */
    open(id, closeCallback, options = {}) {
        const type = options.type || 'transient';
        const triggerElement = options.triggerElement || document.activeElement;
        const initialFocus = options.initialFocus || null;

        // Rule: Only one transient overlay may exist at a time.
        if (type === 'transient') {
            const existingTransient = this._stack.find(item => item.type === 'transient');
            if (existingTransient && existingTransient.id !== id) {
                this.close(existingTransient.id, true);
            }
        }

        // Prevent duplicate entries
        this.close(id, false);

        this._stack.push({
            id,
            type,
            closeCallback,
            triggerElement
        });

        this._updateBodyScroll();

        if (initialFocus && typeof initialFocus.focus === 'function') {
            setTimeout(() => initialFocus.focus(), 50);
        }
    }

    /**
     * Unregister and close an overlay by ID.
     * @param {string} id Unique identifier for the overlay
     * @param {boolean} [triggerCallback=false] Whether to execute the close callback
     */
    close(id, triggerCallback = false) {
        const index = this._stack.findIndex(item => item.id === id);
        if (index === -1) return;

        const [removed] = this._stack.splice(index, 1);

        // Rule: Closing a persistent overlay automatically closes any transient overlays attached to it.
        if (removed.type === 'persistent') {
            const transients = [...this._stack].filter(item => item.type === 'transient');
            transients.forEach(t => this.close(t.id, true));
        }

        if (triggerCallback && typeof removed.closeCallback === 'function') {
            removed.closeCallback();
        }

        // Focus Restoration: Return keyboard focus to the triggering element
        if (removed.triggerElement && typeof removed.triggerElement.focus === 'function' && document.body.contains(removed.triggerElement)) {
            setTimeout(() => {
                try {
                    removed.triggerElement.focus();
                } catch (_) {}
            }, 50);
        }

        this._updateBodyScroll();
    }

    /**
     * Close the top-most active overlay on the stack.
     */
    closeTop() {
        if (this._stack.length === 0) return;
        const top = this._stack[this._stack.length - 1];
        if (top) {
            this.close(top.id, true);
        }
    }

    /**
     * Check if a specific overlay is currently active.
     * @param {string} id
     * @returns {boolean}
     */
    isOpen(id) {
        return this._stack.some(item => item.id === id);
    }

    /**
     * Internal: Manage body scroll lock depending on stack depth.
     */
    _updateBodyScroll() {
        if (this._stack.length > 0) {
            document.body.classList.add('overlay-open');
        } else {
            document.body.classList.remove('overlay-open');
        }
    }

    /**
     * Internal: Global event listeners for ESC key and focus trapping.
     */
    _initGlobalListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (this._stack.length > 0) {
                    e.preventDefault();
                    this.closeTop();
                }
            }
        });
    }
}

export const overlayManager = new OverlayManager();
