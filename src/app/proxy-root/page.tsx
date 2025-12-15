'use client';

import React, { useEffect, useState } from 'react';
import { ProxyAuthWrapper } from '@/lib/components/ProxyAuthWrapper';
import { HCaptcha } from '@/lib/components/HCaptcha';
import { environment, isDevelopment } from '@/lib/config/environment';
import { ProxyAuthConfig } from '@/types/proxy-auth';

/**
 * Next.js equivalent of Angular's AppComponent
 * This component initializes the OTP provider and handles the main app logic
 */
export default function ProxyRootPage() {
    const [authResult, setAuthResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAuth, setShowAuth] = useState(false);

    // Initialize OTP provider (equivalent to Angular's initOtpProvider)
    useEffect(() => {
        initOtpProvider();
    }, []);

    const initOtpProvider = () => {
        // Only initialize in development mode (same logic as Angular version)
        if (isDevelopment()) {
            const sendOTPConfig: ProxyAuthConfig = {
                // referenceId: '4512365h176132430068fbad0ce6e37',
                // loginRedirectUrl: 'https://www.google.com',
                // showCompanyDetails: false,
                authToken: 'enJqckorNWNuWDFiK1BXRGgzemRUUjRCNlhGRkwzVkFiSTRqYklmWmtlS1VnZXoxWXpldDF5UlRyVmRKekd2VnRnSlg2TjBWOWU1TEdIR3pjUFJzRnhHWExMRi8vL1dZQTJTSG53U0JaZmxVVzIyRXM3RUZBRHlzbi9VclA1dFNOdUEzajQvc25DSU9rSjU2LzdweVdLQUVuUmpyVElMVmpiYjhRSnc5VHFGa1ZNdjFCbUJHcFhoTllQQ2dmTUUxSzh4ZDVJUW5XMGVYVmVLQVE5bGxxUT09',
                type: 'user-management',
                theme: 'dark',
                // isPreview: true,
                isLogin: true,
                target: '_self',
                success: (data) => {
                    console.log('success response', data);
                    setAuthResult(data);
                    setError(null);
                },
                failure: (error) => {
                    console.log('failure reason', error);
                    setError(error?.message || 'Authentication failed');
                    setAuthResult(null);
                },
            };

            setShowAuth(true);
            
            // Store config for ProxyAuthWrapper
            (window as any)._proxyAuthConfig = sendOTPConfig;
        }
    };

    const handleHCaptchaVerify = (token: string) => {
        console.log('hCaptcha verified:', token);
        // Handle hCaptcha verification
    };

    const handleHCaptchaError = (error: any) => {
        console.error('hCaptcha error:', error);
        setError('hCaptcha verification failed');
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <h1 className="text-2xl font-bold text-gray-900">
                            Proxy Auth - OTP Provider
                        </h1>
                        <div className="text-sm text-gray-500">
                            Environment: {environment.env}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Proxy Auth Section */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">Authentication</h2>
                            
                            {isDevelopment() && showAuth ? (
                                <div className="space-y-4">
                                    {/* Container for the specific ID from Angular template */}
                                    <div id="4512365h176132430068fbad0ce6e37" className="min-h-[200px]">
                                        {/* This div matches the Angular template */}
                                    </div>
                                    
                                    <ProxyAuthWrapper
                                        config={(window as any)._proxyAuthConfig || {
                                            authToken: 'demo-token',
                                            success: (data) => console.log('Success:', data),
                                            failure: (err) => console.error('Error:', err),
                                        }}
                                        containerId="proxyContainer"
                                        className="border rounded-lg p-4"
                                        onLoad={() => console.log('Proxy Auth loaded')}
                                        onError={(err) => setError(err)}
                                    />
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <p>Authentication is only available in development mode</p>
                                    <p className="text-sm mt-2">Current environment: {environment.env}</p>
                                </div>
                            )}
                        </div>

                        {/* hCaptcha Section */}
                        {environment.hCaptchaSiteKey && (
                            <div className="bg-white rounded-lg shadow p-6">
                                <h2 className="text-xl font-semibold mb-4">Security Verification</h2>
                                <HCaptcha
                                    siteKey={environment.hCaptchaSiteKey}
                                    onVerify={handleHCaptchaVerify}
                                    onError={handleHCaptchaError}
                                    theme="light"
                                    className="flex justify-center"
                                />
                            </div>
                        )}
                    </div>

                    {/* Status and Debug Section */}
                    <div className="space-y-6">
                        {/* Environment Info */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">Environment Configuration</h2>
                            <div className="space-y-2 text-sm">
                                <div><strong>Environment:</strong> {environment.env}</div>
                                <div><strong>Production:</strong> {environment.production ? 'Yes' : 'No'}</div>
                                <div><strong>API URL:</strong> {environment.apiUrl}</div>
                                <div><strong>Base URL:</strong> {environment.baseUrl}</div>
                                <div><strong>hCaptcha Configured:</strong> {environment.hCaptchaSiteKey ? 'Yes' : 'No'}</div>
                            </div>
                        </div>

                        {/* Status Messages */}
                        {error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                                <strong className="font-bold">Error:</strong>
                                <span className="block sm:inline"> {error}</span>
                            </div>
                        )}

                        {authResult && (
                            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                                <strong className="font-bold">Authentication Success:</strong>
                                <pre className="mt-2 text-sm overflow-auto">
                                    {JSON.stringify(authResult, null, 2)}
                                </pre>
                            </div>
                        )}

                        {/* Debug Information */}
                        {isDevelopment() && (
                            <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
                                <strong className="font-bold">Development Mode:</strong>
                                <div className="mt-2 text-sm">
                                    <p>• Authentication is enabled</p>
                                    <p>• Debug information is visible</p>
                                    <p>• Using test configuration</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons (equivalent to commented button in Angular template) */}
                {isDevelopment() && (
                    <div className="mt-8 text-center">
                        <button
                            onClick={initOtpProvider}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        >
                            Reinitialize OTP Provider
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
