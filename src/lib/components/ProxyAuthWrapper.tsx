'use client';

import React, { useEffect, useRef } from 'react';
import { ProxyAuthConfig } from '@/types/proxy-auth';
import { useProxyAuth } from '@/lib/hooks/useProxyAuth';

interface ProxyAuthWrapperProps {
    config: ProxyAuthConfig;
    containerId?: string;
    className?: string;
    onLoad?: () => void;
    onError?: (error: string) => void;
}

/**
 * React wrapper component for Proxy Auth functionality
 */
export function ProxyAuthWrapper({
    config,
    containerId = 'proxyContainer',
    className,
    onLoad,
    onError,
}: ProxyAuthWrapperProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { isLoaded, isLoading, error, initVerification } = useProxyAuth();

    useEffect(() => {
        if (isLoaded && containerRef.current) {
            try {
                // Set the container ID on the ref element
                if (containerId) {
                    containerRef.current.id = containerId;
                }
                
                initVerification(config);
                onLoad?.();
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to initialize verification';
                onError?.(errorMessage);
            }
        }
    }, [isLoaded, config, containerId, initVerification, onLoad, onError]);

    useEffect(() => {
        if (error) {
            onError?.(error);
        }
    }, [error, onError]);

    if (isLoading) {
        return (
            <div className={className}>
                <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <span className="ml-2">Loading Proxy Auth...</span>
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
        <div 
            ref={containerRef}
            className={className}
            id={containerId}
        />
    );
}

export default ProxyAuthWrapper;
