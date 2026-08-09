/**
 * ME Toast Notification Service
 * Centralized, non-blocking toast notifications for success, error, and informational messages.
 */

function getContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    return container;
}

function show(message, type = 'info', durationMs = 3500) {
    if (typeof document === 'undefined') return;

    const container = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-message">${escapeHtml(message)}</span>`;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });

    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }, durationMs);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export const Toast = {
    success(message, durationMs = 3500) {
        show(message, 'success', durationMs);
    },
    error(message, durationMs = 4500) {
        show(message, 'error', durationMs);
    },
    info(message, durationMs = 3500) {
        show(message, 'info', durationMs);
    }
};

if (typeof window !== 'undefined') {
    window.Toast = Toast;
}
