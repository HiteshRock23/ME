/**
 * ME Centralized Analytics Service
 * Provider-agnostic wrapper for tracking application events.
 */

// Generate a unique session ID for the application session lifetime
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const sessionId = generateUUID();

// Detect environment, browser, OS, and device type
const isDev = typeof window !== 'undefined' && 
              (window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' || 
               window.location.hostname.startsWith('192.168.'));

const environment = isDev ? 'development' : 'production';

function getBrowserName() {
    if (typeof navigator === 'undefined') return "Other";
    const ua = navigator.userAgent;
    if (ua.includes("Chrome") && !ua.includes("Chromium") && !ua.includes("Edg")) return "Chrome";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Edg")) return "Edge";
    return "Other";
}

function getOSName() {
    if (typeof navigator === 'undefined') return "Other";
    const ua = navigator.userAgent;
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Macintosh") || ua.includes("Mac OS X")) return "macOS";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
    if (ua.includes("Linux")) return "Linux";
    return "Other";
}

function getDeviceType() {
    if (typeof navigator === 'undefined') return "desktop";
    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|webos/i.test(ua)) return "mobile";
    return "desktop";
}

// In-memory super properties
const superProperties = {
    app: "ME",
    platform: "web",
    environment: environment,
    app_version: "1.0.0",
    authenticated: false,
    browser: getBrowserName(),
    operating_system: getOSName(),
    device_type: getDeviceType()
};

// Safe getter for Mixpanel instance
function getMixpanel() {
    return (typeof window !== 'undefined' && window.mixpanel) || null;
}

// Duplicate event prevention helper
const recentEvents = new Map();
function isDuplicate(eventName, properties) {
    const now = performance.now();
    const key = eventName + JSON.stringify(properties || {});
    if (recentEvents.has(key)) {
        const lastTime = recentEvents.get(key);
        if (now - lastTime < 100) { // 100ms debounce
            return true;
        }
    }
    recentEvents.set(key, now);
    
    // Cleanup Map
    if (recentEvents.size > 50) {
        for (const [k, t] of recentEvents.entries()) {
            if (now - t > 1000) recentEvents.delete(k);
        }
    }
    return false;
}

// Privacy sanitization filter
const SENSITIVE_KEYS = [
    'content', 'raw_content', 'notes', 'prompt', 'question', 'query', 'q',
    'password', 'token', 'jwt', 'api_key', 'secret', 'email', 'name', 
    'first_name', 'last_name', 'link_title', 'title', 'url'
];

function sanitizeProperties(properties) {
    if (!properties) return {};
    const sanitized = {};
    for (const [key, value] of Object.entries(properties)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
            // Keep safe metadata properties
            if (key === 'result_count' || key === 'search_length' || key === 'response_time_ms') {
                sanitized[key] = value;
            }
            continue; 
        }
        sanitized[key] = value;
    }
    return sanitized;
}

// First-time event helper
function trackFirstTimeEvent(eventName, userId, properties = {}) {
    if (!userId) return;
    const key = `me_first_${eventName.toLowerCase().replace(/ /g, '_')}_${userId}`;
    if (!localStorage.getItem(key)) {
        localStorage.setItem(key, 'true');
        analytics.capture(`First ${eventName}`, properties);
    }
}

let currentUserId = null;
let lastPageViewName = null;
let lastPageViewPath = null;

export const analytics = {
    identifyUser(user) {
        if (!user || !user.id) return;
        currentUserId = String(user.id);
        
        const mp = getMixpanel();
        if (mp) {
            try {
                mp.identify(currentUserId);
                if (mp.people && typeof mp.people.set === 'function') {
                    mp.people.set({
                        "$email": user.email,
                        "$name": `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                        "user_id": currentUserId,
                        "signup_date": user.date_joined || new Date().toISOString(),
                        "account_created_at": user.date_joined || new Date().toISOString()
                    });
                }
            } catch (err) {
                console.error("[Analytics] Mixpanel identify failed:", err);
            }
        }
        
        superProperties.authenticated = true;
        this.registerSuperProperties({ authenticated: true });
        
        if (isDev) {
            console.log(`%c[Analytics Identify] User ID: ${currentUserId}`, 'color: #4CAF50; font-weight: bold;', user);
        }
    },

    resetUser() {
        const mp = getMixpanel();
        if (mp) {
            try {
                mp.reset();
            } catch (err) {
                console.error("[Analytics] Mixpanel reset failed:", err);
            }
        }
        
        currentUserId = null;
        superProperties.authenticated = false;
        this.registerSuperProperties({ authenticated: false });
        
        if (isDev) {
            console.log('%c[Analytics Reset] User identity reset.', 'color: #FF5722; font-weight: bold;');
        }
    },

    aliasUser(userId) {
        if (!userId) return;
        const mp = getMixpanel();
        if (mp && typeof mp.alias === 'function') {
            try {
                mp.alias(String(userId));
            } catch (err) {
                console.error("[Analytics] Mixpanel alias failed:", err);
            }
        }
        
        if (isDev) {
            console.log(`[Analytics Alias] Alias created for User ID: ${userId}`);
        }
    },

    registerSuperProperties(properties) {
        if (!properties) return;
        Object.assign(superProperties, properties);
        
        const mp = getMixpanel();
        if (mp && typeof mp.register === 'function') {
            try {
                mp.register(properties);
            } catch (err) {
                console.error("[Analytics] Mixpanel register super properties failed:", err);
            }
        }
        
        if (isDev) {
            console.log('[Analytics Super Properties Registered]', properties);
        }
    },

    capture(eventName, properties = {}) {
        // Enforce duplicate event protection
        if (isDuplicate(eventName, properties)) {
            if (isDev) {
                console.warn(`[Analytics Blocked Duplicate] ${eventName}`, properties);
            }
            return;
        }

        // Apply privacy filtering rules
        const cleanProps = sanitizeProperties(properties);

        // Auto-enrich event properties
        const enrichedProperties = {
            ...superProperties,
            session_id: sessionId,
            timestamp: new Date().toISOString(),
            page_name: lastPageViewName || 'Landing',
            pathname: typeof window !== 'undefined' ? window.location.pathname : '',
            ...cleanProps
        };

        // Send to Mixpanel safely
        const mp = getMixpanel();
        if (mp) {
            try {
                mp.track(eventName, enrichedProperties);
            } catch (err) {
                console.error(`[Analytics] Failed to track event: ${eventName}`, err);
            }
        }

        if (isDev) {
            console.log(`%c[Analytics Event] ${eventName}`, 'color: #2196F3; font-weight: bold;', enrichedProperties);
        }

        // Trigger First-Time User Event activation checks
        if (currentUserId) {
            if (eventName === 'Memory Created') {
                trackFirstTimeEvent('Memory Created', currentUserId, properties);
            } else if (eventName === 'Link Saved') {
                trackFirstTimeEvent('Link Saved', currentUserId, properties);
            } else if (eventName === 'Search Completed') {
                trackFirstTimeEvent('Search', currentUserId, properties);
            } else if (eventName === 'AI Ask Completed') {
                trackFirstTimeEvent('AI Ask', currentUserId, properties);
            }
        }
    },

    // Alias for track
    track(eventName, properties = {}) {
        this.capture(eventName, properties);
    },

    pageView(pageName) {
        const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
        
        // Prevent duplicate page view events on rapid transitions
        if (lastPageViewName === pageName && lastPageViewPath === pathname) {
            return;
        }
        
        const previousPage = lastPageViewName;
        lastPageViewName = pageName;
        lastPageViewPath = pathname;

        this.capture('Page Viewed', {
            page_name: pageName,
            pathname: pathname,
            previous_page: previousPage || 'None'
        });
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
                this.capture('Scrolled 50%');
                tracked50 = true;
            }
            
            if (scrollPercentage >= 90 && !tracked90) {
                this.capture('Scrolled 90%');
                tracked90 = true;
            }
        });
    }
};

// Register default super properties on load
analytics.registerSuperProperties(superProperties);
