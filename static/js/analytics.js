export const analytics = {
    track(eventName, properties = {}) {
        // Mock analytics tracking for V1
        console.log(`[Analytics Track] ${eventName}`, properties);
        
        // In a real application, this would call Mixpanel, Amplitude, PostHog, etc.
    },
    
    initScrollTracking() {
        let tracked50 = false;
        let tracked90 = false;
        
        window.addEventListener('scroll', () => {
            if (tracked50 && tracked90) return;
            
            // Only track on landing page
            if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') return;
            
            const scrollPosition = window.scrollY + window.innerHeight;
            const documentHeight = document.body.scrollHeight;
            const scrollPercentage = (scrollPosition / documentHeight) * 100;
            
            if (scrollPercentage >= 50 && !tracked50) {
                this.track('Scrolled 50%');
                tracked50 = true;
            }
            
            if (scrollPercentage >= 90 && !tracked90) {
                this.track('Scrolled 90%');
                tracked90 = true;
            }
        });
    }
};
