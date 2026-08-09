/**
 * ME Network Layer (Production-Grade Infrastructure)
 * 
 * Single Responsibility: HTTP Communication, Resilience, Metrics & Network State.
 * Pure Layering: Does NOT import UI or Auth business logic directly.
 * Auth callbacks are registered via dependency injection (setAuthHandlers).
 */

import { PLATFORM, ENVIRONMENT, APP_CONFIG, buildApiUrl } from './environment.js';

export const TIMEOUTS = {
    HEALTH_CHECK: 3000,
    GOOGLE_CONFIG: 5000,
    TIMELINE: 15000,
    CAPTURE: 20000,
    AI_ASK: 60000,
    DEFAULT: 15000
};

// =============================================================================
// Unified Event Bus
// =============================================================================
class EventEmitter {
    constructor() {
        this.listeners = new Map();
    }
    on(event, fn) {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event).add(fn);
        return () => this.off(event, fn);
    }
    off(event, fn) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(fn);
        }
    }
    emit(event, data) {
        if (this.listeners.has(event)) {
            for (const fn of this.listeners.get(event)) {
                try { fn(data); } catch (e) { console.error(`[EventBus] Error in ${event} listener:`, e); }
            }
        }
    }
}

export const NetworkEvents = new EventEmitter();

// =============================================================================
// Performance Metrics Collector
// =============================================================================
export const NetworkMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    timeouts: 0,
    retries: 0,
    slowRequests: 0, // > 1000ms
    durations: [],

    record(durationMs, status, isTimeout = false, isRetry = false) {
        this.totalRequests++;
        if (isRetry) this.retries++;
        if (isTimeout) this.timeouts++;

        if (status >= 200 && status < 400) {
            this.successfulRequests++;
        } else {
            this.failedRequests++;
        }

        if (durationMs > 1000) {
            this.slowRequests++;
        }

        this.durations.push(durationMs);
        if (this.durations.length > 100) this.durations.shift();
    },

    getSummary() {
        const avgDuration = this.durations.length ? Math.round(this.durations.reduce((a, b) => a + b, 0) / this.durations.length) : 0;
        return {
            total: this.totalRequests,
            success: this.successfulRequests,
            failed: this.failedRequests,
            timeouts: this.timeouts,
            retries: this.retries,
            slow: this.slowRequests,
            avgDurationMs: avgDuration
        };
    }
};

// =============================================================================
// Network State Store
// =============================================================================
let currentState = (typeof navigator !== 'undefined' && navigator.onLine === false) ? 'Offline' : 'Online';

export function getNetworkState() {
    return currentState;
}

function setNetworkState(newState) {
    if (currentState !== newState) {
        currentState = newState;
        NetworkEvents.emit('network:state:change', newState);
        if (newState === 'Offline') NetworkEvents.emit('backend:offline');
        if (newState === 'Online') NetworkEvents.emit('backend:online');
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setNetworkState('Online'));
    window.addEventListener('offline', () => setNetworkState('Offline'));
}

// =============================================================================
// Dependency Injection for Auth Handlers (Zero Circular Imports)
// =============================================================================
let authHandlers = {
    getAccessToken: () => null,
    refreshToken: async () => null,
    clearTokens: () => {}
};

export function setAuthHandlers(handlers) {
    authHandlers = { ...authHandlers, ...handlers };
}

let activeRefreshPromise = null;

// =============================================================================
// In-Flight Request Deduplication & Cache
// =============================================================================
const inFlightRequests = new Map();
const memoryCache = new Map();

export const NetworkCache = {
    get(key) {
        const item = memoryCache.get(key);
        if (!item) return null;
        if (item.expiresAt && Date.now() > item.expiresAt) {
            memoryCache.delete(key);
            return null;
        }
        return item.value;
    },
    set(key, value, ttlMs = 60000) {
        memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    clear() {
        memoryCache.clear();
    }
};

// =============================================================================
// Request ID Generator & Redacted Logging
// =============================================================================
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function redactHeaders(headers) {
    const redacted = { ...headers };
    if (redacted['Authorization']) {
        redacted['Authorization'] = 'Bearer [REDACTED]';
    }
    return redacted;
}

// =============================================================================
// Main Network Request Function
// =============================================================================
export async function request(endpoint, options = {}) {
    const {
        method = 'GET',
        body = null,
        headers = {},
        skipAuth = false,
        timeoutMs = TIMEOUTS.DEFAULT,
        category = 'DEFAULT',
        retryCount = 0,
        maxRetries = (method === 'GET' ? 2 : 0),
        rawResponse = false
    } = options;

    // Determine timeout based on category if specified
    const effectiveTimeoutMs = options.timeoutMs || TIMEOUTS[category] || TIMEOUTS.DEFAULT;

    // 1. Offline Check
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setNetworkState('Offline');
        const err = new Error("No internet connection.");
        err.code = 'ERR_OFFLINE';
        err.retryable = false;
        throw err;
    }

    const fullUrl = buildApiUrl(endpoint);
    const requestId = generateRequestId();

    // Deduplicate in-flight GET requests
    if (method === 'GET' && !options._isRetry) {
        const cacheKey = `GET:${fullUrl}`;
        if (inFlightRequests.has(cacheKey)) {
            if (APP_CONFIG.debug) console.log(`[Network Dedup] Reusing in-flight request for ${fullUrl}`);
            return await inFlightRequests.get(cacheKey);
        }
    }

    const requestPromise = (async () => {
        const reqHeaders = {
            'Accept': 'application/json',
            'X-Request-ID': requestId,
            'X-Platform': PLATFORM,
            'X-App-Version': APP_CONFIG.version,
            'X-Environment': ENVIRONMENT,
            ...headers
        };

        if (body && !reqHeaders['Content-Type'] && !(body instanceof FormData)) {
            reqHeaders['Content-Type'] = 'application/json';
        }

        if (!skipAuth) {
            const token = authHandlers.getAccessToken ? authHandlers.getAccessToken() : null;
            if (token) {
                reqHeaders['Authorization'] = `Bearer ${token}`;
            }
        }

        let reqBody = body;
        if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof ArrayBuffer) && typeof body !== 'string') {
            reqBody = JSON.stringify(body);
        }

        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), effectiveTimeoutMs);

        const startTime = performance.now();
        let response = null;
        let statusCode = null;
        let errorOccurred = false;
        let errorMessage = null;

        NetworkEvents.emit('request:start', { requestId, method, url: fullUrl, category });

        try {
            if (APP_CONFIG.debug) {
                console.log(`[Network Req] [${requestId}] ${method} ${fullUrl}`, redactHeaders(reqHeaders));
            }

            response = await fetch(fullUrl, {
                method,
                headers: reqHeaders,
                body: reqBody,
                signal: controller.signal
            });

            clearTimeout(timerId);
            statusCode = response.status;

            // 401 Session Refresh with Single Concurrent Refresh Promise Protection
            if (response.status === 401 && !skipAuth && !options._isRetry) {
                if (!activeRefreshPromise) {
                    activeRefreshPromise = authHandlers.refreshToken()
                        .finally(() => { activeRefreshPromise = null; });
                }

                try {
                    const newToken = await activeRefreshPromise;
                    if (newToken) {
                        NetworkEvents.emit('token:refreshed');
                        return await request(endpoint, {
                            ...options,
                            _isRetry: true,
                            headers: { ...headers, 'Authorization': `Bearer ${newToken}` }
                        });
                    }
                } catch (refreshErr) {
                    authHandlers.clearTokens();
                    setNetworkState('AuthExpired');
                    NetworkEvents.emit('auth:expired');
                    const authErr = new Error("Your session has expired.");
                    authErr.code = 'ERR_AUTH_EXPIRED';
                    throw authErr;
                }
            }

            if (rawResponse) return response;

            const contentType = response.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');

            if (response.status === 204) return null;

            if (!response.ok) {
                errorOccurred = true;
                let msg = "Server temporarily unavailable.";
                let existingMemory = null;

                if (isJson) {
                    try {
                        const data = await response.json();
                        msg = data.detail || data.error || data.message || msg;
                        if (data.existing_memory) existingMemory = data.existing_memory;
                    } catch (e) {}
                } else {
                    const text = await response.text().catch(() => '');
                    if (text.trim().startsWith('<')) {
                        msg = "Backend returned HTML instead of JSON. Check API configuration.";
                    }
                }

                errorMessage = msg;
                const err = new Error(msg);
                err.status = statusCode;
                err.code = `HTTP_${statusCode}`;
                err.requestId = requestId;
                if (existingMemory) err.existingMemory = existingMemory;
                throw err;
            }

            if (!isJson) {
                const text = await response.text().catch(() => '');
                if (text.trim().startsWith('<')) {
                    throw new Error("Backend returned HTML instead of JSON. Check API configuration.");
                }
                return text;
            }

            const data = await response.json();
            NetworkEvents.emit('request:success', { requestId, method, url: fullUrl, status: statusCode });
            return data;

        } catch (err) {
            clearTimeout(timerId);
            errorOccurred = true;

            const durationMs = Math.round(performance.now() - startTime);

            if (err.name === 'AbortError') {
                errorMessage = "Request timed out.";
                NetworkEvents.emit('request:timeout', { requestId, method, url: fullUrl, durationMs });
                NetworkMetrics.record(durationMs, 408, true, retryCount > 0);

                if (method === 'GET' && retryCount < maxRetries) {
                    const backoffMs = Math.pow(2, retryCount) * 300;
                    if (APP_CONFIG.debug) console.warn(`[Network Retry] Retrying timeout GET ${fullUrl} (Attempt ${retryCount + 1}) in ${backoffMs}ms`);
                    await new Promise(r => setTimeout(r, backoffMs));
                    return await request(endpoint, { ...options, retryCount: retryCount + 1 });
                }

                const timeoutErr = new Error(errorMessage);
                timeoutErr.code = 'ERR_TIMEOUT';
                throw timeoutErr;
            }

            if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
                errorMessage = "Unable to reach ME.";
                setNetworkState('BackendUnavailable');

                if (method === 'GET' && retryCount < maxRetries) {
                    const backoffMs = Math.pow(2, retryCount) * 300;
                    if (APP_CONFIG.debug) console.warn(`[Network Retry] Retrying failed GET ${fullUrl} (Attempt ${retryCount + 1})`);
                    await new Promise(r => setTimeout(r, backoffMs));
                    return await request(endpoint, { ...options, retryCount: retryCount + 1 });
                }

                const connErr = new Error(errorMessage);
                connErr.code = 'ERR_CONNECTION';
                throw connErr;
            }

            errorMessage = err.message || "Network error";
            NetworkEvents.emit('request:error', { requestId, method, url: fullUrl, status: statusCode, error: errorMessage });
            throw err;

        } finally {
            const durationMs = Math.round(performance.now() - startTime);
            NetworkMetrics.record(durationMs, statusCode || 500, false, retryCount > 0);

            if (APP_CONFIG.debug) {
                console.log(`[Network Res] [${requestId}] ${method} ${fullUrl} [${statusCode || 'FAILED'}] (${durationMs}ms) RetryCount: ${retryCount}`);
            }
        }
    })();

    if (method === 'GET') {
        const cacheKey = `GET:${fullUrl}`;
        inFlightRequests.set(cacheKey, requestPromise);
        requestPromise.finally(() => inFlightRequests.delete(cacheKey));
    }

    return requestPromise;
}

/**
 * Fast, non-blocking health check to verify backend reachability.
 * Maximum wait: 3 seconds.
 */
export async function checkBackendHealth() {
    try {
        const data = await request('/api/auth/google/config/', {
            method: 'GET',
            skipAuth: true,
            timeoutMs: TIMEOUTS.HEALTH_CHECK,
            category: 'HEALTH_CHECK',
            maxRetries: 0
        });
        setNetworkState('Online');
        return true;
    } catch (e) {
        console.warn("[Backend Health] Health check failed or timed out:", e.message);
        setNetworkState('BackendUnavailable');
        return false;
    }
}

export const network = {
    get(endpoint, options = {}) {
        return request(endpoint, { ...options, method: 'GET' });
    },
    post(endpoint, body = null, options = {}) {
        return request(endpoint, { ...options, method: 'POST', body, maxRetries: 0 });
    },
    patch(endpoint, body = null, options = {}) {
        return request(endpoint, { ...options, method: 'PATCH', body, maxRetries: 0 });
    },
    delete(endpoint, options = {}) {
        return request(endpoint, { ...options, method: 'DELETE', maxRetries: 0 });
    },
    request,
    checkBackendHealth,
    setAuthHandlers,
    getState: getNetworkState,
    Metrics: NetworkMetrics,
    Events: NetworkEvents,
    Cache: NetworkCache
};

if (typeof window !== 'undefined') {
    window.network = network;
}
