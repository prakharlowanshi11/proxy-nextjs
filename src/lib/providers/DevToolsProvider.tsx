'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { isDevelopment } from '@/lib/config/environment';

interface DevToolsContextType {
    isEnabled: boolean;
    logs: Array<{ timestamp: Date; level: string; message: string; data?: any }>;
    addLog: (level: string, message: string, data?: any) => void;
    clearLogs: () => void;
    maxAge: number;
}

const DevToolsContext = createContext<DevToolsContextType | null>(null);

interface DevToolsProviderProps {
    children: React.ReactNode;
    maxAge?: number;
    serialize?: boolean;
}

/**
 * Next.js equivalent of Angular's StoreDevtoolsModule
 * Provides development tools and logging functionality
 */
export function DevToolsProvider({ 
    children, 
    maxAge = 25, 
    serialize = true 
}: DevToolsProviderProps) {
    const [logs, setLogs] = useState<Array<{ timestamp: Date; level: string; message: string; data?: any }>>([]);
    const isEnabled = isDevelopment();

    const addLog = (level: string, message: string, data?: any) => {
        if (!isEnabled) return;

        const newLog = {
            timestamp: new Date(),
            level,
            message,
            data: serialize ? JSON.parse(JSON.stringify(data)) : data,
        };

        setLogs(prevLogs => {
            const updatedLogs = [...prevLogs, newLog];
            // Keep only the last maxAge entries
            return updatedLogs.slice(-maxAge);
        });

        // Also log to browser console in development
        const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
        console[consoleMethod](`[DevTools] ${message}`, data);
    };

    const clearLogs = () => {
        setLogs([]);
    };

    // Set up global error handling in development
    useEffect(() => {
        if (!isEnabled) return;

        const handleError = (event: ErrorEvent) => {
            addLog('error', 'Global Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error?.toString(),
            });
        };

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            addLog('error', 'Unhandled Promise Rejection', {
                reason: event.reason?.toString(),
            });
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // Initial log
        addLog('info', 'DevTools initialized', { maxAge, serialize });

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, [isEnabled, maxAge, serialize]);

    const contextValue: DevToolsContextType = {
        isEnabled,
        logs,
        addLog,
        clearLogs,
        maxAge,
    };

    return (
        <DevToolsContext.Provider value={contextValue}>
            {children}
            {isEnabled && <DevToolsPanel />}
        </DevToolsContext.Provider>
    );
}

/**
 * Hook to use DevTools context
 */
export function useDevTools() {
    const context = useContext(DevToolsContext);
    if (!context) {
        throw new Error('useDevTools must be used within a DevToolsProvider');
    }
    return context;
}

/**
 * Development tools panel (only visible in development)
 */
function DevToolsPanel() {
    const { logs, clearLogs, isEnabled } = useDevTools();
    const [isOpen, setIsOpen] = useState(false);

    if (!isEnabled) return null;

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg z-50"
                title="Toggle DevTools"
            >
                🛠️
            </button>

            {/* DevTools Panel */}
            {isOpen && (
                <div className="fixed bottom-16 right-4 w-96 max-h-96 bg-white border shadow-xl rounded-lg z-50 overflow-hidden">
                    <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
                        <h3 className="font-semibold">DevTools</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={clearLogs}
                                className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded"
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-xs hover:bg-gray-600 px-2 py-1 rounded"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                    
                    <div className="overflow-auto max-h-80 p-2">
                        {logs.length === 0 ? (
                            <div className="text-gray-500 text-sm text-center py-4">
                                No logs yet
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {logs.map((log, index) => (
                                    <div
                                        key={index}
                                        className={`text-xs p-2 rounded border-l-4 ${
                                            log.level === 'error'
                                                ? 'bg-red-50 border-red-400 text-red-800'
                                                : log.level === 'warn'
                                                ? 'bg-yellow-50 border-yellow-400 text-yellow-800'
                                                : 'bg-blue-50 border-blue-400 text-blue-800'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className="font-semibold">{log.level.toUpperCase()}</span>
                                            <span className="text-gray-500">
                                                {log.timestamp.toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="mt-1">{log.message}</div>
                                        {log.data && (
                                            <pre className="mt-1 text-xs bg-gray-100 p-1 rounded overflow-auto">
                                                {JSON.stringify(log.data, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
