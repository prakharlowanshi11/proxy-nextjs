// React-based Proxy Auth Script
// This script integrates React components with the global initVerification function

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

// React component renderer using Next.js API
class ProxyAuthReactRenderer {
    constructor() {
        this.components = new Map();
        this.loadReact();
    }

    async loadReact() {
        // Load React and ReactDOM from CDN if not already loaded
        if (typeof React === 'undefined') {
            await this.loadScript('https://unpkg.com/react@18/umd/react.production.min.js');
        }
        if (typeof ReactDOM === 'undefined') {
            await this.loadScript('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js');
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async renderComponent(elementId, componentType, props) {
        try {
            // Make API call to Next.js to get the rendered component
            const response = await fetch('/api/render-component', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    componentType,
                    props,
                }),
            });

            if (response.ok) {
                const { html, css } = await response.json();
                
                // Inject CSS if provided
                if (css && !document.getElementById(`${componentType}-styles`)) {
                    const style = document.createElement('style');
                    style.id = `${componentType}-styles`;
                    style.textContent = css;
                    document.head.appendChild(style);
                }

                // Render HTML
                const element = document.getElementById(elementId);
                if (element) {
                    element.innerHTML = html;
                    
                    // Set up event listeners for interactive elements
                    this.setupEventListeners(element, componentType, props);
                }
            }
        } catch (error) {
            console.error('Failed to render React component:', error);
            // Fallback to basic HTML
            this.renderFallback(elementId, componentType, props);
        }
    }

    setupEventListeners(element, componentType, props) {
        // Set up event listeners based on component type
        switch (componentType) {
            case 'SendOtpComponent':
                this.setupSendOtpListeners(element, props);
                break;
            case 'LoginComponent':
                this.setupLoginListeners(element, props);
                break;
            case 'UserProfileComponent':
                this.setupUserProfileListeners(element, props);
                break;
        }
    }

    setupSendOtpListeners(element, props) {
        // Send OTP button
        const sendOtpBtn = element.querySelector('.send-otp-btn');
        if (sendOtpBtn) {
            sendOtpBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch('/api/send-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(props),
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        props.successReturn?.(result);
                    } else {
                        throw new Error('Failed to send OTP');
                    }
                } catch (error) {
                    props.failureReturn?.(error);
                }
            });
        }

        // Subscription plan buttons
        const planButtons = element.querySelectorAll('.plan-button');
        planButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                
                const planData = button.getAttribute('data-plan-data');
                if (planData) {
                    try {
                        const response = await fetch('/api/upgrade-subscription', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                planData: JSON.parse(planData),
                                authToken: props.authToken,
                                referenceId: props.referenceId,
                            }),
                        });
                        
                        if (response.ok) {
                            const result = await response.json();
                            props.successReturn?.(result);
                        }
                    } catch (error) {
                        props.failureReturn?.(error);
                    }
                }
            });
        });
    }

    setupLoginListeners(element, props) {
        const loginForm = element.querySelector('.login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(loginForm);
                const loginData = Object.fromEntries(formData.entries());
                
                try {
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(loginData),
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        props.onSuccess?.(result);
                    } else {
                        throw new Error('Login failed');
                    }
                } catch (error) {
                    props.onFailure?.(error);
                }
            });
        }
    }

    setupUserProfileListeners(element, props) {
        const updateForm = element.querySelector('.user-profile-form');
        if (updateForm) {
            updateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(updateForm);
                const userData = Object.fromEntries(formData.entries());
                
                try {
                    const response = await fetch('/api/update-user', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...userData,
                            authToken: props.authToken,
                        }),
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        props.successReturn?.(result);
                    }
                } catch (error) {
                    props.failureReturn?.(error);
                }
            });
        }
    }

    renderFallback(elementId, componentType, props) {
        const element = document.getElementById(elementId);
        if (!element) return;

        // Basic fallback HTML based on component type
        switch (componentType) {
            case 'SendOtpComponent':
                element.innerHTML = `
                    <div class="proxy-fallback">
                        <h3>OTP Verification</h3>
                        <button class="send-otp-btn">Send OTP</button>
                    </div>
                `;
                break;
            case 'LoginComponent':
                element.innerHTML = `
                    <div class="proxy-fallback">
                        <h3>Login</h3>
                        <form class="login-form">
                            <input name="username" placeholder="Username" required>
                            <input name="password" type="password" placeholder="Password" required>
                            <button type="submit">Login</button>
                        </form>
                    </div>
                `;
                break;
            case 'UserProfileComponent':
                element.innerHTML = `
                    <div class="proxy-fallback">
                        <h3>User Profile</h3>
                        <form class="user-profile-form">
                            <input name="name" placeholder="Name" required>
                            <button type="submit">Update</button>
                        </form>
                    </div>
                `;
                break;
        }

        // Add basic styles
        if (!document.getElementById('proxy-fallback-styles')) {
            const style = document.createElement('style');
            style.id = 'proxy-fallback-styles';
            style.textContent = `
                .proxy-fallback {
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    font-family: Arial, sans-serif;
                }
                .proxy-fallback input {
                    display: block;
                    width: 100%;
                    padding: 8px;
                    margin: 8px 0;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                .proxy-fallback button {
                    padding: 10px 20px;
                    background: #007cba;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
            `;
            document.head.appendChild(style);
        }

        this.setupEventListeners(element, componentType, props);
    }
}

// Initialize the renderer
const proxyAuthRenderer = new ProxyAuthReactRenderer();

// Global initialization function for proxy authentication
window.initVerification = (config) => {
    documentReady(async () => {
        if (config?.referenceId || config?.authToken || config?.showCompanyDetails) {
            // Remove existing proxy-auth element if present
            const findOtpProvider = document.querySelector('proxy-auth');
            if (findOtpProvider) {
                document.body.removeChild(findOtpProvider);
            }

            // Determine component type based on configuration
            let componentType = 'SendOtpComponent';
            if (config.type === 'user-profile') {
                componentType = 'UserProfileComponent';
            } else if (config.type === 'login') {
                componentType = 'LoginComponent';
            }

            // Prepare props for React component
            const componentProps = {
                referenceId: config?.referenceId,
                type: config?.type,
                authToken: config?.authToken,
                showCompanyDetails: config?.showCompanyDetails,
                userToken: config?.userToken,
                isRolePermission: config?.isRolePermission,
                isPreview: config?.isPreview,
                isLogin: config?.isLogin,
                loginRedirectUrl: config?.loginRedirectUrl,
                theme: config?.theme,
                target: config?.target || '_self',
                css: config.style,
                successReturn: config.success,
                failureReturn: config.failure,
                otherData: (() => {
                    const otherData = {};
                    Object.keys(config).forEach(key => {
                        if (!RESERVED_KEYS.includes(key)) {
                            otherData[key] = config[key];
                        }
                    });
                    return otherData;
                })(),
            };

            // Validate required callback functions
            if (!config.success || typeof config.success !== 'function') {
                throw new Error('success callback function missing !');
            }

            // Create container element
            const containerElement = document.createElement('div');
            containerElement.id = `proxy-auth-${Date.now()}`;
            containerElement.className = 'proxy-auth-container';

            // Append to appropriate container
            if (document.getElementById('proxyContainer')) {
                document.getElementById('proxyContainer').appendChild(containerElement);
            } else if (document.getElementById('userProxyContainer')) {
                document.getElementById('userProxyContainer').appendChild(containerElement);
            } else {
                document.body.appendChild(containerElement);
            }

            // Render the React component
            await proxyAuthRenderer.renderComponent(
                containerElement.id,
                componentType,
                componentProps
            );

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

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initVerification: window.initVerification };
}
