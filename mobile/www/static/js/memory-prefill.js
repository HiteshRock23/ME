import { ui } from './ui.js?v=3';

const PENDING_MEMORY_KEY = 'me.pending_memory';

export function initPrefill() {
    window.addEventListener('me:dashboard-enter', () => {
        const pendingMemory = localStorage.getItem(PENDING_MEMORY_KEY);
        
        if (pendingMemory) {
            const captureInput = document.getElementById('capture-input');
            const captureContainer = captureInput?.closest('.capture-box') || captureInput; // Highlight the box if possible
            
            if (captureInput) {
                // Populate the textarea
                captureInput.value = pendingMemory;
                
                // Update UI state (char count and button enable)
                ui.updateCharCount();
                ui.fixCaptureState(false);
                
                // Focus and highlight
                captureInput.focus();
                
                if (captureContainer) {
                    captureContainer.classList.add('highlight-pulse');
                    
                    // Remove the class after animation completes so it can be re-triggered in the future if needed
                    captureContainer.addEventListener('animationend', () => {
                        captureContainer.classList.remove('highlight-pulse');
                    }, { once: true });
                }
                
                // Clean up
                localStorage.removeItem(PENDING_MEMORY_KEY);
            }
        }
    });
}
