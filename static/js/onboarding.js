import { getDeferredPrompt, hideInstallUI } from './pwa.js';
import { ui } from './ui.js?v=3';
import { analytics } from './analytics.js';

const ONBOARDING_COMPLETED_KEY = 'me.install_onboarding.completed';

export function initOnboarding() {
    // We listen for the dashboard enter event, which fires when the user successfully loads the dashboard.
    window.addEventListener('me:dashboard-enter', () => {
        // Only run this logic if they just logged in
        if (sessionStorage.getItem('me_just_logged_in') === 'true') {
            // Remove the flag so it doesn't trigger on refresh
            sessionStorage.removeItem('me_just_logged_in');
            
            // Wait a short moment for beforeinstallprompt to potentially fire
            setTimeout(checkAndShowOnboarding, 1000);
        }
    });
}

function checkAndShowOnboarding() {
    // 1. Check if already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        return;
    }

    // 2. Check if already completed or dismissed
    if (localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true') {
        return;
    }

    // 3. Check if PWA install prompt is available
    const deferredPrompt = getDeferredPrompt();
    if (!deferredPrompt) {
        // Browser might not support it or criteria not met.
        return;
    }

    showOnboardingModal();
}

function showOnboardingModal() {
    const modal = document.getElementById('install-onboarding-modal');
    const installBtn = document.getElementById('onboarding-install-btn');
    const dismissBtn = document.getElementById('onboarding-dismiss-btn');
    
    if (!modal || !installBtn || !dismissBtn) return;

    modal.classList.remove('hidden');
    // Force reflow for transition
    void modal.offsetWidth;
    modal.classList.add('visible');
    
    analytics.capture('Install Onboarding Shown');

    // Trap Focus
    installBtn.focus();

    // Event Listeners
    const handleInstall = async () => {
        const deferredPrompt = getDeferredPrompt();
        if (!deferredPrompt) return;
        
        analytics.capture('Install Onboarding Action', { action: 'install_clicked' });
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            analytics.capture('Install Onboarding Action', { action: 'install_accepted' });
            markCompleted();
            closeOnboardingModal();
            ui.showToast('ME has been installed successfully.');
            hideInstallUI(); // Clean up other PWA banners if any
        } else {
            analytics.capture('Install Onboarding Action', { action: 'install_cancelled' });
            // Close modal. We don't mark as permanently completed here so they can be asked again on next login if they just cancelled the native prompt.
            closeOnboardingModal();
        }
    };

    const handleDismiss = () => {
        analytics.capture('Install Onboarding Action', { action: 'continue_in_browser' });
        markCompleted();
        closeOnboardingModal();
    };

    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            handleDismiss();
        }
    };

    // Remove old listeners if any exist
    installBtn.replaceWith(installBtn.cloneNode(true));
    dismissBtn.replaceWith(dismissBtn.cloneNode(true));
    
    const newInstallBtn = document.getElementById('onboarding-install-btn');
    const newDismissBtn = document.getElementById('onboarding-dismiss-btn');

    newInstallBtn.addEventListener('click', handleInstall, { once: true });
    newDismissBtn.addEventListener('click', handleDismiss, { once: true });
    window.addEventListener('keydown', handleKeydown);

    // Clean up listener on close
    modal.addEventListener('transitionend', function cleanup(e) {
        if (e.target === modal && !modal.classList.contains('visible')) {
            window.removeEventListener('keydown', handleKeydown);
            modal.removeEventListener('transitionend', cleanup);
        }
    });
}

function markCompleted() {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
}

function closeOnboardingModal() {
    const modal = document.getElementById('install-onboarding-modal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 400); // Wait for transition
    }
}
