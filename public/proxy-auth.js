// Global configuration and constants
const RESERVED_KEYS = ['referenceId', 'target', 'style', 'success', 'failure'];

// Utility function to check if document is ready
function documentReady(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(fn, 1);
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}

// Global initialization function for proxy authentication
window.initVerification = (config) => {
    documentReady(() => {
        if (config?.referenceId || config?.authToken || config?.showCompanyDetails) {
            // Remove existing proxy-auth element if present
            const findOtpProvider = document.querySelector('proxy-auth');
            if (findOtpProvider) {
                document.body.removeChild(findOtpProvider);
            }

            // Create new proxy-auth element
            const sendOtpElement = document.createElement('proxy-auth');
            
            // Set properties on the element
            sendOtpElement.setAttribute('reference-id', config?.referenceId || '');
            sendOtpElement.setAttribute('type', config?.type || '');
            sendOtpElement.setAttribute('auth-token', config?.authToken || '');
            sendOtpElement.setAttribute('show-company-details', config?.showCompanyDetails || false);
            sendOtpElement.setAttribute('user-token', config?.userToken || '');
            sendOtpElement.setAttribute('is-role-permission', config?.isRolePermission || false);
            sendOtpElement.setAttribute('is-preview', config?.isPreview || false);
            sendOtpElement.setAttribute('is-login', config?.isLogin || false);
            sendOtpElement.setAttribute('login-redirect-url', config?.loginRedirectUrl || '');
            sendOtpElement.setAttribute('theme', config?.theme || '');
            sendOtpElement.setAttribute('target', config?.target || '_self');

            // Apply custom styles if provided
            if (config.style) {
                sendOtpElement.setAttribute('style', config.style);
            }

            // Validate required callback functions
            if (!config.success || typeof config.success !== 'function') {
                throw new Error('success callback function missing !');
            }

            // Store callback functions on the element
            sendOtpElement._successCallback = config.success;
            sendOtpElement._failureCallback = config.failure;

            // Store other data (omitting reserved keys)
            const otherData = {};
            Object.keys(config).forEach(key => {
                if (!RESERVED_KEYS.includes(key)) {
                    otherData[key] = config[key];
                }
            });
            sendOtpElement._otherData = otherData;

            // Append to appropriate container
            if (document.getElementById('proxyContainer')) {
                document.getElementById('proxyContainer').appendChild(sendOtpElement);
            } else if (document.getElementById('userProxyContainer')) {
                document.getElementById('userProxyContainer').appendChild(sendOtpElement);
            } else {
                document.body.appendChild(sendOtpElement);
            }

            window.libLoaded = true;
        } else {
            if (!config?.referenceId) {
                throw new Error('Reference Id is missing!');
            } else {
                throw new Error('Something went wrong!');
            }
        }
    });
};

// Define the custom element class
class ProxyAuthElement extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    static get observedAttributes() {
        return [
            'reference-id', 'type', 'auth-token', 'show-company-details',
            'user-token', 'is-role-permission', 'is-preview', 'is-login',
            'login-redirect-url', 'theme', 'target'
        ];
    }

    attributeChangedCallback() {
        this.render();
    }

    render() {
        // This is where you would integrate with your Next.js React component
        // For now, we'll create a placeholder that can be replaced with actual React rendering
        this.shadowRoot.innerHTML = `
            <div id="proxy-auth-container">
                <div>Loading Proxy Auth Component...</div>
                <div>Reference ID: ${this.getAttribute('reference-id') || 'Not provided'}</div>
            </div>
        `;
    }

    // Method to trigger success callback
    triggerSuccess(data) {
        if (this._successCallback) {
            this._successCallback(data);
        }
    }

    // Method to trigger failure callback
    triggerFailure(error) {
        if (this._failureCallback) {
            this._failureCallback(error);
        }
    }

    // Get other configuration data
    getOtherData() {
        return this._otherData || {};
    }
}

// Register the custom element
if (!customElements.get('proxy-auth')) {
    customElements.define('proxy-auth', ProxyAuthElement);
}
