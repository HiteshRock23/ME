/**
 * Authentication Module
 * Handles tokens, login, logout, and token refreshing.
 */

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
        const response = await fetch('/api/auth/login/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Login failed. Please check your credentials.');
        }

        const data = await response.json();
        this.setTokens(data.access, data.refresh);
        return data;
    },

    async logout() {
        const refresh = this.getRefreshToken();
        if (refresh) {
            try {
                await fetch('/api/auth/logout/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.getAccessToken()}`
                    },
                    body: JSON.stringify({ refresh })
                });
            } catch (e) {
                console.error("Logout request failed, but clearing local tokens.", e);
            }
        }
        this.clearTokens();
    },

    async register(firstName, lastName, email, password) {
        const response = await fetch('/api/auth/register/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            const msg = data.detail
                || data.email?.[0]
                || data.password?.[0]
                || data.first_name?.[0]
                || data.last_name?.[0]
                || data.non_field_errors?.[0]
                || 'Registration failed.';
            throw new Error(msg);
        }

        const access = data.access || data.tokens?.access;
        const refresh = data.refresh || data.tokens?.refresh;
        this.setTokens(access, refresh);
        
        return data;
    },

    async refreshToken() {
        const refresh = this.getRefreshToken();
        if (!refresh) throw new Error("No refresh token available");

        const response = await fetch('/api/auth/token/refresh/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh })
        });

        if (!response.ok) {
            this.clearTokens();
            throw new Error("Session expired. Please log in again.");
        }

        const data = await response.json();
        this.setTokens(data.access, data.refresh || refresh);
        return data.access;
    }
};
