import { auth } from '../../js/auth.js';
import { NativeApp } from '../../js/native/app.js';
import { NativeTheme } from '../../js/native/theme.js';
import { NativeNetwork } from '../../js/native/network.js';
import { renderAppShell } from './components/app-shell.js';
import { renderHomeScreen } from './screens/home.js';
import { renderSearchScreen } from './screens/search.js';
import { renderCaptureScreen } from './screens/capture.js';
import { renderAskScreen } from './screens/ask.js';
import { renderProfileScreen } from './screens/profile.js';
import { renderDetailScreen } from './screens/detail.js';
import { renderAuthScreen } from './screens/auth.js';
import { renderPublicShareScreen } from './screens/public-share.js';

/**
 * Dedicated Mobile Client Router & Native Shell Coordinator
 * Manages screen switches, native navigation stack, hardware back button, and native lifecycle events.
 */
export const MobileRouter = {
    _activeScreen: 'home',
    _navStack: [],
    _currentScreenElement: null,
    _shellInstance: null,
    _mountEl: null,
    _initialized: false,

    async init() {
        if (this._initialized) return;
        this._initialized = true;

        // Apply native system UI theme (Status Bar & System Nav Bar)
        await NativeTheme.applyDarkTheme();

        // Listen for Google OAuth success
        window.addEventListener('me:auth-success', () => {
            this.navigate('home');
        });

        // App Resume Lifecycle Event Listener (Application-level decoupling)
        NativeApp.addListener('appStateChange', async ({ isActive }) => {
            if (isActive) {
                console.log('[MobileRouter] App resumed from background.');
                if (auth.isAuthenticated()) {
                    try {
                        await auth.refreshToken();
                    } catch (e) {
                        console.warn('[MobileRouter] Refresh token check on resume:', e);
                    }
                }
            }
        });

        // Native Hardware Back Button Handler using explicit navigation stack
        NativeApp.addListener('backButton', () => {
            if (this._navStack.length > 1) {
                this._navStack.pop(); // Pop current screen
                const previous = this._navStack[this._navStack.length - 1];
                this.navigate(previous.screenId, previous.params, true); // Push back flag
            } else {
                // At root screen (Home or Auth) -> Exit Application
                NativeApp.exitApp();
            }
        });

        // Native Network Status Listener
        NativeNetwork.addListener(({ connected }) => {
            if (!connected) {
                console.log('[MobileRouter] Network offline indicator');
            }
        });
    },

    async mount(mountElement) {
        if (!mountElement) return;
        this._mountEl = mountElement;
        this._mountEl.innerHTML = '';

        await this.init();

        const path = window.location.pathname;
        let initialScreen = 'home';
        let initialToken = null;

        if (path.startsWith('/s/') || path.startsWith('/m/')) {
            initialScreen = 'public-share';
            initialToken = path.split('/')[2];
        } else {
            const isLoggedIn = auth.isAuthenticated();
            initialScreen = isLoggedIn ? 'home' : 'auth';
        }

        this._activeScreen = initialScreen;
        this._navStack = [{ screenId: initialScreen, params: initialToken }];

        this._shellInstance = renderAppShell({
            activeTab: this._activeScreen,
            onTabSelect: (tabId) => this.navigate(tabId),
            onFabClick: () => this.navigate('capture'),
            onMenuClick: () => this.navigate('profile')
        });

        this._mountEl.appendChild(this._shellInstance.element);
        this._renderActiveScreen(initialToken);

        // Hide Native Splash Screen only after frontend is ready and mounted
        await NativeApp.hideSplashScreen();
    },

    navigate(screenId, params = null, isBackNav = false) {
        if (!auth.isAuthenticated() && screenId !== 'auth' && screenId !== 'public-share') {
            screenId = 'auth';
        }

        if (this._currentScreenElement && typeof this._currentScreenElement.onLeave === 'function') {
            try { this._currentScreenElement.onLeave(); } catch(e) {}
        }

        this._activeScreen = screenId;

        if (!isBackNav) {
            // Push to explicit navigation stack
            if (screenId === 'home' || screenId === 'auth') {
                this._navStack = [{ screenId, params }]; // Reset stack at root
            } else {
                this._navStack.push({ screenId, params });
            }
        }

        if (this._shellInstance) {
            this._shellInstance.updateTab(screenId);
        }
        this._renderActiveScreen(params);
    },

    _renderActiveScreen(params) {
        if (!this._shellInstance || !this._shellInstance.container) return;
        const container = this._shellInstance.container;
        container.innerHTML = '';

        const onNavigate = (screenId, p) => this.navigate(screenId, p);

        let screenContent;
        switch (this._activeScreen) {
            case 'home':
                screenContent = renderHomeScreen({ onNavigate, params });
                break;
            case 'search':
                screenContent = renderSearchScreen({ onNavigate, params });
                break;
            case 'capture':
                screenContent = renderCaptureScreen({ onNavigate, params });
                break;
            case 'ask':
                screenContent = renderAskScreen({ onNavigate, params });
                break;
            case 'profile':
                screenContent = renderProfileScreen({ onNavigate, params });
                break;
            case 'detail':
                screenContent = renderDetailScreen({ onNavigate, params });
                break;
            case 'public-share':
                screenContent = renderPublicShareScreen({ token: typeof params === 'string' ? params : params?.token, onNavigate });
                break;
            case 'auth':
                screenContent = renderAuthScreen({ onNavigate, params });
                break;
            default:
                screenContent = renderHomeScreen({ onNavigate, params });
        }

        this._currentScreenElement = screenContent;
        container.appendChild(screenContent);

        if (screenContent && typeof screenContent.onEnter === 'function') {
            try { screenContent.onEnter(); } catch(e) {}
        }

        window.scrollTo(0, 0);
    },

    unmount() {
        if (this._currentScreenElement && typeof this._currentScreenElement.onLeave === 'function') {
            try { this._currentScreenElement.onLeave(); } catch(e) {}
        }
        if (this._mountEl) {
            this._mountEl.innerHTML = '';
        }
        this._shellInstance = null;
        this._currentScreenElement = null;
        this._navStack = [];
    }
};

if (typeof window !== 'undefined') {
    window.MobileRouter = MobileRouter;
}
