import { router } from './router.js';
import { analytics } from './analytics.js';

const PENDING_MEMORY_KEY = 'me.pending_memory';

export function initDump() {
    const textarea = document.getElementById('dump-textarea');
    const dumpBtn = document.getElementById('dump-action-btn');
    const inputView = document.getElementById('dump-input-view');
    const confirmView = document.getElementById('dump-confirmation-view');
    const saveMeBtn = document.getElementById('dump-save-me-btn');
    const startOverBtn = document.getElementById('dump-start-over-btn');
    const charCountEl = document.getElementById('dump-char-count');

    if (!textarea || !dumpBtn) return;

    // Handle entering the dump screen
    window.addEventListener('me:dump-enter', () => {
        // Always reset state when entering
        resetDumpState();
        textarea.focus();
    });

    // Handle textarea input
    textarea.addEventListener('input', () => {
        const text = textarea.value;
        const trimmed = text.trim();
        dumpBtn.disabled = trimmed.length === 0;
        if (charCountEl) {
            charCountEl.textContent = `${text.length} characters`;
        }
    });

    // Handle Dump action
    dumpBtn.addEventListener('click', () => {
        const text = textarea.value.trim();
        if (text.length === 0) return;

        // Visual loading state
        dumpBtn.disabled = true;
        dumpBtn.innerHTML = 'Saving...';
        
        analytics.capture('Quick Dump Created');

        // Simulate a slight delay to reassure the user
        setTimeout(() => {
            // Save to localStorage
            localStorage.setItem(PENDING_MEMORY_KEY, text);
            
            // Transition to confirmation view
            inputView.classList.add('hidden-transition');
            
            setTimeout(() => {
                inputView.classList.add('hidden');
                confirmView.classList.remove('hidden');
                
                // Force reflow
                void confirmView.offsetWidth;
                
                confirmView.classList.remove('hidden-transition');
            }, 250); // wait for input view fade out

        }, 350); // 350ms fake save delay
    });

    // Handle "Remember this with ME"
    saveMeBtn.addEventListener('click', () => {
        analytics.capture('Quick Dump Save Attempted');
        // Redirect to authentication flow without losing the memory
        router.navigate('/auth');
    });

    // Handle "Start over"
    startOverBtn.addEventListener('click', () => {
        analytics.capture('Quick Dump Started Over');
        localStorage.removeItem(PENDING_MEMORY_KEY);
        resetDumpState();
        textarea.focus();
    });

    function resetDumpState() {
        textarea.value = '';
        dumpBtn.disabled = true;
        dumpBtn.innerHTML = 'Dump';
        if (charCountEl) {
            charCountEl.textContent = '0 characters';
        }
        
        confirmView.classList.add('hidden-transition');
        confirmView.classList.add('hidden');
        
        inputView.classList.remove('hidden');
        inputView.classList.remove('hidden-transition');
    }
}
