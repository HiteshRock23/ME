/**
 * Authentication Module
 * Handles tokens, login, logout, registration, and token refreshing via the central network layer.
 * Registers token getters & refresh handlers with network module via Dependency Injection.
 */

import { network, setAuthHandlers } from './network.js';
import { analytics } from './analytics.js';

const AUTH_KEYS = {
    ACCESS: 'me_access',
    REFRESH: 'me_refresh'
};

export const auth = {
    setTokens(access, refresh) {
        if (access) {
            localStorage.setItem(AUTH_KEYS.ACCESS, access);
            sessionStorage.setItem(AUTH_KEYS.ACCESS, access);
        }
        if (refresh) {
            localStorage.setItem(AUTH_KEYS.REFRESH, refresh);
            sessionStorage.setItem(AUTH_KEYS.REFRESH, refresh);
        }
    },

    getAccessToken() {
        return localStorage.getItem(AUTH_KEYS.ACCESS) || sessionStorage.getItem(AUTH_KEYS.ACCESS);
    },

    getRefreshToken() {
        return localStorage.getItem(AUTH_KEYS.REFRESH) || sessionStorage.getItem(AUTH_KEYS.REFRESH);
    },

    clearTokens() {
        localStorage.removeItem(AUTH_KEYS.ACCESS);
        localStorage.removeItem(AUTH_KEYS.REFRESH);
        sessionStorage.removeItem(AUTH_KEYS.ACCESS);
        sessionStorage.removeItem(AUTH_KEYS.REFRESH);
    },

    isAuthenticated() {
        return !!this.getAccessToken();
    },

    async login(email, password) {
        const data = await network.post('/api/auth/login/', { email, password }, { skipAuth: true, category: 'DEFAULT' });
        if (data && data.access) {
            this.setTokens(data.access, data.refresh);
        }
        return data;
    },

    async logout() {
        const refresh = this.getRefreshToken();
        if (refresh) {
            try {
                await network.post('/api/auth/logout/', { refresh }, { skipAuth: false });
            } catch (e) {
                console.error("Logout request failed, but clearing local tokens.", e);
            }
        }
        this.clearTokens();
        if (typeof analytics !== 'undefined' && analytics.resetUser) {
            analytics.resetUser();
        }
    },

    async register(firstName, lastName, email, password) {
        const data = await network.post('/api/auth/register/', {
            first_name: firstName,
            last_name: lastName,
            email,
            password
        }, { skipAuth: true });

        const access = data.access || data.tokens?.access;
        const refresh = data.refresh || data.tokens?.refresh;
        if (access) {
            this.setTokens(access, refresh);
        }

        const userObj = data.user || data.tokens?.user;
        if (userObj && typeof analytics !== 'undefined' && analytics.identifyUser) {
            analytics.identifyUser(userObj);
        }

        return data;
    },

    async refreshToken() {
        const refresh = this.getRefreshToken();
        if (!refresh) throw new Error("No refresh token available");

        const data = await network.post('/api/auth/token/refresh/', { refresh }, { skipAuth: true });
        if (data && data.access) {
            this.setTokens(data.access, data.refresh || refresh);
            return data.access;
        }
        throw new Error("Invalid token refresh response");
    }
};

// Dependency Injection: Register Auth handlers with Network Layer (Zero Circular Dependencies)
setAuthHandlers({
    getAccessToken: () => auth.getAccessToken(),
    refreshToken: () => auth.refreshToken(),
    clearTokens: () => auth.clearTokens()
});

if (typeof window !== 'undefined') {
    window.auth = auth;
}
