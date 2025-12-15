'use client';

import React, { useEffect, useRef, useState } from 'react';
import { environment } from '@/lib/config/environment';

interface HCaptchaProps {
    siteKey?: string;
    onVerify?: (token: string) => void;
    onError?: (error: any) => void;
    onExpire?: () => void;
    onLoad?: () => void;
    theme?: 'light' | 'dark';
    size?: 'normal' | 'compact';
    className?: string;
}

declare global {
    interface Window {
        hcaptcha: any;
    }
}

export function HCaptcha({
    siteKey = environment.hCaptchaSiteKey,
    onVerify,
    onError,
    onExpire,
    onLoad,
    theme = 'light',
    size = 'normal',
    className,
}: HCaptchaProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [widgetId, setWidgetId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Load hCaptcha script
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Check if hCaptcha is already loaded
        if (window.hcaptcha) {
            setIsLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://js.hcaptcha.com/1/api.js';
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
            setIsLoaded(true);
            onLoad?.();
        };
        
        script.onerror = () => {
            const errorMsg = 'Failed to load hCaptcha script';
            setError(errorMsg);
            onError?.(errorMsg);
        };

        document.head.appendChild(script);

        return () => {
            // Cleanup script if component unmounts
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };
    }, [onLoad, onError]);

    // Render hCaptcha widget
    useEffect(() => {
        if (!isLoaded || !containerRef.current || !siteKey || widgetId) return;

        try {
            const id = window.hcaptcha.render(containerRef.current, {
                sitekey: siteKey,
                theme,
                size,
                callback: (token: string) => {
                    onVerify?.(token);
                },
                'error-callback': (error: any) => {
                    setError(error);
                    onError?.(error);
                },
                'expired-callback': () => {
                    onExpire?.();
                },
            });
            
            setWidgetId(id);
        } catch (err) {
            const errorMsg = 'Failed to render hCaptcha widget';
            setError(errorMsg);
            onError?.(err);
        }
    }, [isLoaded, siteKey, theme, size, onVerify, onError, onExpire, widgetId]);

    // Cleanup widget on unmount
    useEffect(() => {
        return () => {
            if (widgetId && window.hcaptcha) {
                try {
                    window.hcaptcha.remove(widgetId);
                } catch (err) {
                    console.warn('Failed to remove hCaptcha widget:', err);
                }
            }
        };
    }, [widgetId]);

    // Public methods
    const reset = () => {
        if (widgetId && window.hcaptcha) {
            window.hcaptcha.reset(widgetId);
        }
    };

    const execute = () => {
        if (widgetId && window.hcaptcha) {
            window.hcaptcha.execute(widgetId);
        }
    };

    const getResponse = () => {
        if (widgetId && window.hcaptcha) {
            return window.hcaptcha.getResponse(widgetId);
        }
        return null;
    };

    if (!siteKey) {
        return (
            <div className={className}>
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                    <strong className="font-bold">Warning:</strong>
                    <span className="block sm:inline"> hCaptcha site key not configured</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={className}>
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    <strong className="font-bold">Error:</strong>
                    <span className="block sm:inline"> {error}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            <div ref={containerRef} />
        </div>
    );
}

// Export methods for external use
HCaptcha.displayName = 'HCaptcha';

export default HCaptcha;
