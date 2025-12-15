'use client';

import React, { useState } from 'react';
import { ProxyAuthWrapper } from '@/lib/components/ProxyAuthWrapper';
import { ProxyAuthConfig } from '@/types/proxy-auth';

export default function ProxyAuthExamplePage() {
    const [authResult, setAuthResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Example configuration
    const proxyAuthConfig: ProxyAuthConfig = {
        referenceId: 'example-ref-123',
        type: 'otp',
        authToken: 'your-auth-token-here',
        showCompanyDetails: true,
        userToken: 'user-token-123',
        isRolePermission: false,
        isPreview: false,
        isLogin: true,
        loginRedirectUrl: '/dashboard',
        theme: 'default',
        target: '_self',
        style: 'border: 1px solid #ccc; padding: 20px; border-radius: 8px;',
        success: (data) => {
            console.log('Authentication successful:', data);
            setAuthResult(data);
            setError(null);
        },
        failure: (err) => {
            console.error('Authentication failed:', err);
            setError(err?.message || 'Authentication failed');
            setAuthResult(null);
        },
        // Additional custom data
        customField1: 'custom-value-1',
        customField2: 'custom-value-2',
    };

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">Proxy Auth Example</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Proxy Auth Component */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Proxy Authentication</h2>
                    <ProxyAuthWrapper
                        config={proxyAuthConfig}
                        containerId="proxyContainer"
                        className="border rounded-lg p-4 bg-gray-50"
                        onLoad={() => console.log('Proxy Auth loaded successfully')}
                        onError={(err) => setError(err)}
                    />
                </div>

                {/* Status Display */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Status</h2>
                    
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            <strong className="font-bold">Error:</strong>
                            <span className="block sm:inline"> {error}</span>
                        </div>
                    )}

                    {authResult && (
                        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                            <strong className="font-bold">Success:</strong>
                            <pre className="mt-2 text-sm overflow-auto">
                                {JSON.stringify(authResult, null, 2)}
                            </pre>
                        </div>
                    )}

                    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
                        <strong className="font-bold">Configuration:</strong>
                        <pre className="mt-2 text-sm overflow-auto">
                            {JSON.stringify(proxyAuthConfig, (key, value) => {
                                // Don't stringify functions
                                if (typeof value === 'function') {
                                    return '[Function]';
                                }
                                return value;
                            }, 2)}
                        </pre>
                    </div>
                </div>
            </div>

            {/* Usage Instructions */}
            <div className="mt-8 space-y-4">
                <h2 className="text-xl font-semibold">Usage Instructions</h2>
                <div className="bg-gray-100 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">1. Using the React Component:</h3>
                    <pre className="text-sm bg-white p-2 rounded border overflow-auto">
{`import { ProxyAuthWrapper } from '@/lib/components/ProxyAuthWrapper';

<ProxyAuthWrapper
    config={{
        referenceId: 'your-ref-id',
        success: (data) => console.log('Success:', data),
        failure: (err) => console.error('Error:', err),
        // ... other config options
    }}
    containerId="proxyContainer"
    className="your-custom-class"
/>`}
                    </pre>

                    <h3 className="font-semibold mb-2 mt-4">2. Using the Hook:</h3>
                    <pre className="text-sm bg-white p-2 rounded border overflow-auto">
{`import { useProxyAuth } from '@/lib/hooks/useProxyAuth';

const { isLoaded, initVerification } = useProxyAuth();

// When ready to initialize
initVerification({
    referenceId: 'your-ref-id',
    success: (data) => console.log('Success:', data),
    // ... other config
});`}
                    </pre>

                    <h3 className="font-semibold mb-2 mt-4">3. Direct Script Usage:</h3>
                    <pre className="text-sm bg-white p-2 rounded border overflow-auto">
{`// Load the script first
<script src="/proxy-auth.js"></script>

// Then use the global function
window.initVerification({
    referenceId: 'your-ref-id',
    success: (data) => console.log('Success:', data),
    // ... other config
});`}
                    </pre>
                </div>
            </div>
        </div>
    );
}
