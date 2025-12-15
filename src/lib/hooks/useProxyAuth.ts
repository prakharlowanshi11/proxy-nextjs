import { useEffect, useState, useCallback } from 'react';
import { ProxyAuthConfig } from '@/types/proxy-auth';
import { loadProxyAuthScript } from '@/lib/proxy-auth-utils';

interface UseProxyAuthReturn {
    isLoaded: boolean;
    isLoading: boolean;
    error: string | null;
    initVerification: (config: ProxyAuthConfig) => void;
}

/**
 * React hook for managing Proxy Auth functionality
 */
export function useProxyAuth(): UseProxyAuthReturn {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadScript = async () => {
            if (typeof window === 'undefined') return;
            
            // Check if already loaded
            if ((window as any).initVerification) {
                setIsLoaded(true);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                await loadProxyAuthScript();
                setIsLoaded(true);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load proxy auth');
            } finally {
                setIsLoading(false);
            }
        };

        loadScript();
    }, []);

    const initVerification = useCallback((config: ProxyAuthConfig) => {
        if (!isLoaded) {
            throw new Error('Proxy Auth script not loaded yet');
        }

        if (typeof window !== 'undefined' && (window as any).initVerification) {
            (window as any).initVerification(config);
        } else {
            throw new Error('initVerification function not available');
        }
    }, [isLoaded]);

    return {
        isLoaded,
        isLoading,
        error,
        initVerification,
    };
}
