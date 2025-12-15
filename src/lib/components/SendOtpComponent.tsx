'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDevTools } from '@/lib/providers/DevToolsProvider';
import { apiClient, getApiInfo } from '@/lib/utils/api-client';

export enum Theme {
    LIGHT = 'light',
    DARK = 'dark',
    SYSTEM = 'system',
}

interface SendOtpComponentProps {
    referenceId?: string;
    type?: string;
    target?: string;
    authToken?: string;
    showCompanyDetails?: boolean;
    userToken?: string;
    isRolePermission?: string;
    isPreview?: boolean;
    isLogin?: boolean;
    loginRedirectUrl?: string;
    theme?: string;
    css?: React.CSSProperties;
    successReturn?: (arg: any) => any;
    failureReturn?: (arg: any) => any;
    otherData?: { [key: string]: any };
}

export function SendOtpComponent({
    referenceId,
    type,
    target,
    authToken,
    showCompanyDetails,
    userToken,
    isRolePermission,
    isPreview,
    isLogin,
    loginRedirectUrl,
    theme: initialTheme,
    css,
    successReturn,
    failureReturn,
    otherData = {},
}: SendOtpComponentProps) {
    const { addLog } = useDevTools();
    const [theme, setTheme] = useState<string>(initialTheme || Theme.LIGHT);
    const [show, setShow] = useState(false);
    const [animate, setAnimate] = useState(false);
    const [isCreateAccountTextAppended, setIsCreateAccountTextAppended] = useState(false);
    const [showRegistration, setShowRegistration] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showCard, setShowCard] = useState(false);
    const [showSkeleton, setShowSkeleton] = useState(false);
    const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
    const [otpWidgetData, setOtpWidgetData] = useState<any>(null);
    const [loginWidgetData, setLoginWidgetData] = useState<any>(null);
    const [upgradeSubscriptionData, setUpgradeSubscriptionData] = useState<any>(null);
    
    // Loading states
    const [getOtpInProcess, setGetOtpInProcess] = useState(false);
    const [resendOtpInProcess, setResendOtpInProcess] = useState(false);
    const [verifyOtpInProcess, setVerifyOtpInProcess] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);

    // Default CSS styles
    const defaultCss: React.CSSProperties = {
        position: 'absolute',
        marginLeft: '50%',
        top: '10px',
        ...css,
    };

    // Theme detection and setup
    useEffect(() => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        
        const handleThemeChange = (event: MediaQueryListEvent) => {
            if (!initialTheme) {
                setTheme(event.matches ? Theme.DARK : Theme.LIGHT);
            }
        };

        prefersDark.addEventListener('change', handleThemeChange);
        
        if (!initialTheme) {
            setTheme(prefersDark.matches ? Theme.DARK : Theme.LIGHT);
        }

        return () => {
            prefersDark.removeEventListener('change', handleThemeChange);
        };
    }, [initialTheme]);

    // Initialize component
    useEffect(() => {
        addLog('info', 'SendOtpComponent initialized', {
            referenceId,
            type,
            authToken: authToken ? '***' : undefined,
        });

        if (type === 'subscription') {
            loadSubscriptionPlans();
        } else {
            toggleSendOtp(true);
        }

        loadExternalFonts();
        loadWidgetData();
    }, [referenceId, type, authToken, otherData]);

    const loadExternalFonts = () => {
        // Load Google Fonts
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@100;300;400;500;600&display=swap';
        document.head.appendChild(link);

        // Add viewport meta tag if not exists
        if (!document.getElementById('proxy-viewport-meta')) {
            const metaTag = document.createElement('meta');
            metaTag.name = 'viewport';
            metaTag.content = 'width=device-width, initial-scale=1';
            metaTag.id = 'proxy-viewport-meta';
            document.head.appendChild(metaTag);
        }
    };

    const loadSubscriptionPlans = async () => {
        try {
            addLog('info', 'Loading subscription plans', { referenceId, authToken: authToken ? '***' : undefined });
            
            // Simulate API call - replace with actual API
            const response = await fetch('/api/subscription-plans', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    referenceId,
                    authToken,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setSubscriptionPlans(data.data || []);
                addLog('info', 'Subscription plans loaded', { count: data.data?.length || 0 });
            }

            if (isPreview) {
                setShow(true);
            } else {
                toggleSendOtp(true);
            }
        } catch (error) {
            addLog('error', 'Failed to load subscription plans', error);
            
            // Fallback timeout
            setTimeout(() => {
                if (isPreview) {
                    setShow(true);
                } else if (!subscriptionPlans || subscriptionPlans.length === 0) {
                    toggleSendOtp(true);
                }
            }, 3000);
        }
    };

    const loadWidgetData = async () => {
        try {
            addLog('info', 'Loading widget data', { referenceId });
            
            // Simulate API call - replace with actual API
            const response = await fetch('/api/widget-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    referenceId,
                    payload: otherData,
                }),
            });

            if (response.ok) {
                const widgetData = await response.json();
                
                // Find OTP widget data
                const otpWidget = widgetData?.find((widget: any) => 
                    widget?.service_id === 'msg91-otp-service'
                );
                
                if (otpWidget) {
                    setOtpWidgetData(otpWidget);
                    addLog('info', 'OTP widget data loaded', { widgetId: otpWidget.widget_id });
                }

                // Find login widget data
                const loginWidget = widgetData?.find((widget: any) => 
                    widget?.service_id === 'password-authentication'
                ) || widgetData?.[0];
                
                if (loginWidget) {
                    setLoginWidgetData(loginWidget);
                    addLog('info', 'Login widget data loaded', { widgetId: loginWidget.widget_id });
                }
            }
        } catch (error) {
            addLog('error', 'Failed to load widget data', error);
        }
    };

    const toggleSendOtp = (initial: boolean = false) => {
        const referenceElement = document.getElementById(referenceId || '');
        
        if (!referenceElement) {
            if (show) {
                setAnimate(true);
                setShowLogin(false);
                setTimeout(() => {
                    setShow(false);
                    setAnimate(false);
                }, 300);
            } else {
                setShow(true);
            }
        } else {
            setShowLogin(false);
            setShow(false);
            setAnimate(false);

            if (initial) {
                if (type === 'subscription') {
                    if (!isPreview && referenceElement) {
                        appendSubscriptionButton(referenceElement);
                    }
                } else {
                    setShowSkeleton(true);
                    appendSkeletonLoader(referenceElement);
                    addButtonsToReferenceElement(referenceElement);
                }
            }
        }
    };

    const appendSubscriptionButton = (element: HTMLElement) => {
        try {
            addLog('info', 'Appending subscription button', { elementId: element.id });
            
            // Clear existing content
            const existingContainers = element.querySelectorAll('.subscription-plans-container');
            existingContainers.forEach((container) => {
                element.removeChild(container);
            });

            // Add styles
            addSubscriptionStyles();

            // Create subscription HTML
            const subscriptionHTML = createSubscriptionCenterHTML();
            const subscriptionContainer = document.createElement('div');
            subscriptionContainer.innerHTML = subscriptionHTML;

            // Add event listeners
            addButtonEventListeners(subscriptionContainer);

            // Append to element
            element.appendChild(subscriptionContainer);
            
        } catch (error) {
            addLog('error', 'Error appending subscription button', error);
        }
    };

    const appendSkeletonLoader = (element: HTMLElement) => {
        const skeletonHTML = `
            <div class="proxy-skeleton-loader">
                <div class="skeleton-line"></div>
                <div class="skeleton-line short"></div>
                <div class="skeleton-button"></div>
            </div>
        `;
        
        element.innerHTML = skeletonHTML;
        
        // Add skeleton styles
        const style = document.createElement('style');
        style.textContent = `
            .proxy-skeleton-loader {
                padding: 20px;
                animation: pulse 1.5s ease-in-out infinite;
            }
            .skeleton-line {
                height: 16px;
                background: #e2e8f0;
                border-radius: 4px;
                margin-bottom: 12px;
            }
            .skeleton-line.short {
                width: 60%;
            }
            .skeleton-button {
                height: 40px;
                background: #e2e8f0;
                border-radius: 6px;
                margin-top: 16px;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    };

    const addButtonsToReferenceElement = (element: HTMLElement) => {
        setTimeout(() => {
            setShowSkeleton(false);
            
            const buttonHTML = `
                <div class="proxy-otp-buttons">
                    <button class="proxy-otp-btn primary" onclick="window.proxyOtpHandler?.showOtp()">
                        Send OTP
                    </button>
                    ${isLogin ? `
                        <button class="proxy-otp-btn secondary" onclick="window.proxyOtpHandler?.showLogin()">
                            Login
                        </button>
                    ` : ''}
                </div>
            `;
            
            element.innerHTML = buttonHTML;
            
            // Set up global handlers
            (window as any).proxyOtpHandler = {
                showOtp: () => setShow(true),
                showLogin: () => setShowLogin(true),
            };
            
        }, 1500); // Simulate loading time
    };

    const createSubscriptionCenterHTML = (): string => {
        const plans = subscriptionPlans || [];

        if (plans.length === 0) {
            return `
                <div class="proxy-container">
                    <div class="subscription-plans-container">
                        <div style="padding: 20px; text-align: center; color: #666; font-size: 16px;">
                            No subscription plans available
                        </div>
                    </div>
                </div>
            `;
        }

        const plansHTML = plans.map((plan) => createPlanCardHTML(plan)).join('');

        return `
            <div class="proxy-container">
                <div class="subscription-plans-container">
                    <div class="plans-grid">
                        ${plansHTML}
                    </div>
                </div>
            </div>
        `;
    };

    const createPlanCardHTML = (plan: any): string => {
        const isPopular = plan.plan_meta?.highlight_plan || false;
        const popularClass = isPopular ? 'popular' : '';
        const selectedClass = plan.isSelected ? 'selected' : '';
        const highlightedClass = isPopular ? 'highlighted' : '';

        const popularBadge = plan.plan_meta?.tag ? 
            `<div class="popular-badge">${plan.plan_meta.tag}</div>` : '';

        const priceMatch = plan.plan_price?.match(/(\d+)\s+(.+)/);
        const priceValue = priceMatch ? priceMatch[1] : '0';
        const currency = priceMatch ? priceMatch[2] : 'USD';

        const isDisabled = !!plan.isSubscribed;
        
        return `
            <div class="plan-card ${popularClass} ${selectedClass} ${highlightedClass}">
                ${popularBadge}
                <div>
                    <h1 class="plan-title">${plan.plan_name}</h1>
                    <div class="plan-price">
                        <div class="price-container">
                            <span class="price-number">${priceValue}</span>
                            <span class="price-currency">${currency}</span>
                        </div>
                    </div>
                    <button 
                        class="plan-button primary upgrade-btn ${isDisabled ? 'plan-button-disabled' : ''}"
                        data-plan-id="${plan.id}"
                        data-plan-data='${JSON.stringify(plan)}'
                        ${isDisabled ? 'disabled' : ''}
                    >
                        ${isLogin ? (plan.isSubscribed ? 'Your current plan' : 'Get ' + plan.plan_name) : 'Get Started'}
                    </button>
                    <div class="divider"></div>
                </div>
            </div>
        `;
    };

    const addSubscriptionStyles = () => {
        if (document.getElementById('subscription-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'subscription-styles';
        style.textContent = `
            .proxy-container {
                font-family: 'Inter', sans-serif;
                color: ${theme === Theme.DARK ? '#ffffff' : '#333333'};
            }
            
            .subscription-plans-container {
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            
            .plans-grid {
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .plan-card {
                background: ${theme === Theme.DARK ? 'transparent' : '#ffffff'};
                border: ${theme === Theme.DARK ? '1px solid #e6e6e6' : '2px solid #e6e6e6'};
                border-radius: 8px;
                padding: 24px;
                min-width: 290px;
                max-width: 350px;
                position: relative;
                transition: all 0.3s ease;
            }
            
            .plan-card.highlighted {
                border: ${theme === Theme.DARK ? '2px solid #ffffff' : '2px solid #000000'};
            }
            
            .popular-badge {
                position: absolute;
                top: -12px;
                right: 20px;
                background: #4d4d4d;
                color: #ffffff;
                padding: 6px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
            }
            
            .plan-title {
                font-size: 28px;
                font-weight: 700;
                margin: 0 0 16px 0;
                color: ${theme === Theme.DARK ? '#ffffff' : '#333333'};
            }
            
            .plan-price .price-number {
                font-size: 39px;
                font-weight: 700;
                color: ${theme === Theme.DARK ? '#ffffff' : '#4d4d4d'};
            }
            
            .plan-price .price-currency {
                font-size: 16px;
                font-weight: 400;
                color: ${theme === Theme.DARK ? '#cccccc' : '#666666'};
                margin-left: 4px;
            }
            
            .plan-button {
                width: 100%;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                border: none;
                margin: 16px 0;
            }
            
            .plan-button.primary {
                background: #4d4d4d;
                color: #ffffff;
            }
            
            .plan-button.primary:hover:not(:disabled) {
                background: #333333;
            }
            
            .plan-button.plan-button-disabled,
            .plan-button:disabled {
                opacity: 0.7;
                cursor: not-allowed;
            }
            
            .divider {
                height: 1px;
                background: #e0e0e0;
                margin: 16px 0;
            }
            
            .proxy-otp-buttons {
                display: flex;
                gap: 12px;
                padding: 20px;
            }
            
            .proxy-otp-btn {
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                border: none;
            }
            
            .proxy-otp-btn.primary {
                background: #4d4d4d;
                color: #ffffff;
            }
            
            .proxy-otp-btn.secondary {
                background: transparent;
                color: #4d4d4d;
                border: 2px solid #4d4d4d;
            }
            
            .proxy-otp-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
        `;
        
        document.head.appendChild(style);
    };

    const addButtonEventListeners = (container: HTMLElement) => {
        const buttons = container.querySelectorAll('.plan-button');
        buttons.forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.preventDefault();
                
                if ((button as HTMLButtonElement).disabled) {
                    return;
                }

                const planId = button.getAttribute('data-plan-id');
                const planDataStr = button.getAttribute('data-plan-data');

                if (planId && planDataStr) {
                    try {
                        const planData = JSON.parse(planDataStr);
                        addLog('info', 'Upgrading subscription', { planId, planData });
                        
                        const result = await apiClient.upgradeSubscription({
                            planData,
                            authToken,
                            referenceId,
                        });

                        if (result.success) {
                            successReturn?.(result.data);
                            addLog('info', 'Subscription upgrade successful', result.data);
                        } else {
                            throw new Error(result.error || 'Subscription upgrade failed');
                        }
                    } catch (error) {
                        addLog('error', 'Subscription upgrade failed', error);
                        failureReturn?.(error);
                    }
                }
            });
        });
    };

    if (!referenceId && !authToken) {
        return null;
    }

    return (
        <div 
            ref={containerRef}
            style={defaultCss}
            className={`proxy-send-otp-component ${animate ? 'animate' : ''} theme-${theme}`}
        >
            <div className="proxy-otp-container">
                {showSkeleton ? (
                    <div className="proxy-skeleton-loader">
                        <div className="skeleton-line"></div>
                        <div className="skeleton-line short"></div>
                        <div className="skeleton-button"></div>
                    </div>
                ) : (
                    <div className="proxy-otp-content">
                        <h2>OTP Verification</h2>
                        <p>Please verify your identity to continue</p>
                        
                        {type === 'subscription' && subscriptionPlans.length > 0 && (
                            <div className="subscription-plans">
                                {/* Subscription plans will be rendered here */}
                            </div>
                        )}
                        
                        <div className="proxy-otp-actions">
                            <button 
                                className="proxy-otp-btn primary"
                                onClick={() => addLog('info', 'Send OTP clicked')}
                                disabled={getOtpInProcess}
                            >
                                {getOtpInProcess ? 'Sending...' : 'Send OTP'}
                            </button>
                            
                            {isLogin && (
                                <button 
                                    className="proxy-otp-btn secondary"
                                    onClick={() => setShowLogin(true)}
                                >
                                    Login
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SendOtpComponent;
