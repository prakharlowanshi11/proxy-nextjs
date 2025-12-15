import { ProxyAuthConfig, RESERVED_KEYS } from '@/types/proxy-auth';

/**
 * Utility function to check if document is ready
 */
export function documentReady(fn: () => void): void {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(fn, 1);
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}

/**
 * Omit specified keys from an object (lodash-es replacement)
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    keys: readonly K[]
): Omit<T, K> {
    const result = { ...obj };
    keys.forEach(key => {
        delete result[key];
    });
    return result;
}

/**
 * Initialize proxy authentication with given configuration
 */
export function initProxyAuth(config: ProxyAuthConfig): void {
    documentReady(() => {
        if (config?.referenceId || config?.authToken || config?.showCompanyDetails) {
            // Remove existing proxy-auth element if present
            const findOtpProvider = document.querySelector('proxy-auth');
            if (findOtpProvider) {
                document.body.removeChild(findOtpProvider);
            }

            // Create new proxy-auth element
            const sendOtpElement = document.createElement('proxy-auth') as any;
            
            // Set properties on the element
            sendOtpElement.referenceId = config?.referenceId;
            sendOtpElement.type = config?.type;
            sendOtpElement.authToken = config?.authToken;
            sendOtpElement.showCompanyDetails = config?.showCompanyDetails;
            sendOtpElement.userToken = config?.userToken;
            sendOtpElement.isRolePermission = config?.isRolePermission;
            sendOtpElement.isPreview = config?.isPreview;
            sendOtpElement.isLogin = config?.isLogin;
            sendOtpElement.loginRedirectUrl = config?.loginRedirectUrl;
            sendOtpElement.theme = config?.theme;
            sendOtpElement.target = config?.target ?? '_self';
            sendOtpElement.css = config.style;

            // Validate required callback functions
            if (!config.success || typeof config.success !== 'function') {
                throw new Error('success callback function missing !');
            }

            sendOtpElement.successReturn = config.success;
            sendOtpElement.failureReturn = config.failure;

            // Store other data (omitting reserved keys)
            sendOtpElement.otherData = omit(config, RESERVED_KEYS);

            // Append to appropriate container
            if (document.getElementById('proxyContainer')) {
                document.getElementById('proxyContainer')!.append(sendOtpElement);
            } else if (document.getElementById('userProxyContainer')) {
                document.getElementById('userProxyContainer')!.append(sendOtpElement);
            } else {
                document.getElementsByTagName('body')[0].append(sendOtpElement);
            }

            (window as any).libLoaded = true;
        } else {
            if (!config?.referenceId) {
                throw new Error('Reference Id is missing!');
            } else {
                throw new Error('Something went wrong!');
            }
        }
    });
}

/**
 * Load the proxy auth script dynamically
 */
export function loadProxyAuthScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error('Window is not available'));
            return;
        }

        // Check if script is already loaded
        if ((window as any).initVerification) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = '/proxy-auth.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load proxy-auth script'));
        document.head.appendChild(script);
    });
}
