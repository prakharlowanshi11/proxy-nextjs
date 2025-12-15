'use client';

import React, { useState } from 'react';
import { 
    SendOtpComponent, 
    UserProfileComponent, 
    LoginComponent, 
    ConfirmationDialogComponent 
} from '@/lib/components';

export default function TestProxyAuthPage() {
    const [activeComponent, setActiveComponent] = useState<string>('send-otp');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    const handleSuccess = (data: any) => {
        console.log('Success:', data);
        alert('Success! Check console for details.');
    };

    const handleFailure = (error: any) => {
        console.error('Error:', error);
        alert('Error! Check console for details.');
    };

    const renderComponent = () => {
        switch (activeComponent) {
            case 'send-otp':
                return (
                    <SendOtpComponent
                        referenceId="test-ref-123"
                        type="subscription"
                        theme="light"
                        target="_self"
                        successReturn={handleSuccess}
                        failureReturn={handleFailure}
                        otherData={{ testMode: true }}
                    />
                );

            case 'user-profile':
                return (
                    <UserProfileComponent
                        authToken="test-auth-token-456"
                        target="_self"
                        showCard={true}
                        successReturn={handleSuccess}
                        failureReturn={handleFailure}
                        otherData={{ testMode: true }}
                    />
                );

            case 'login':
                return (
                    <LoginComponent
                        prefillDetails="test@example.com"
                        onSuccess={handleSuccess}
                        onFailure={handleFailure}
                        onClosePopUp={() => console.log('Close popup')}
                        onTogglePopUp={(data) => console.log('Toggle popup:', data)}
                    />
                );

            case 'script-test':
                return (
                    <div className="script-test-container">
                        <h3>Script Integration Test</h3>
                        <div id="proxyContainer" style={{ minHeight: '400px', border: '1px dashed #ccc', padding: '20px' }}>
                            <p>Container for script-based components</p>
                        </div>
                        
                        <div className="script-buttons">
                            <button 
                                className="test-btn"
                                onClick={() => testScriptIntegration('send-otp')}
                            >
                                Test Send OTP Script
                            </button>
                            <button 
                                className="test-btn"
                                onClick={() => testScriptIntegration('user-profile')}
                            >
                                Test User Profile Script
                            </button>
                        </div>
                    </div>
                );

            default:
                return <div>Select a component to test</div>;
        }
    };

    const testScriptIntegration = (type: string) => {
        // Clear container
        const container = document.getElementById('proxyContainer');
        if (container) {
            container.innerHTML = '<p>Loading...</p>';
        }

        // Simulate script loading and initialization
        setTimeout(() => {
            if (typeof (window as any).initVerification === 'function') {
                (window as any).initVerification({
                    referenceId: 'script-test-123',
                    type: type,
                    authToken: type === 'user-profile' ? 'test-token' : undefined,
                    theme: 'light',
                    success: handleSuccess,
                    failure: handleFailure,
                });
            } else {
                console.error('initVerification not found. Make sure proxy-auth.js is loaded.');
                if (container) {
                    container.innerHTML = '<p style="color: red;">Error: Script not loaded. Check console.</p>';
                }
            }
        }, 500);
    };

    return (
        <div className="test-proxy-auth-page">
            <style jsx>{`
                .test-proxy-auth-page {
                    padding: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                    font-family: 'Inter', sans-serif;
                }

                .page-header {
                    text-align: center;
                    margin-bottom: 30px;
                }

                .page-title {
                    font-size: 28px;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin: 0 0 10px 0;
                }

                .page-subtitle {
                    color: #666;
                    font-size: 16px;
                    margin: 0;
                }

                .component-selector {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 30px;
                    flex-wrap: wrap;
                    justify-content: center;
                }

                .selector-btn {
                    padding: 10px 20px;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    background: white;
                    color: #374151;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }

                .selector-btn:hover {
                    border-color: #3b82f6;
                    color: #3b82f6;
                }

                .selector-btn.active {
                    border-color: #3b82f6;
                    background: #3b82f6;
                    color: white;
                }

                .component-container {
                    background: #f9fafb;
                    border-radius: 12px;
                    padding: 30px;
                    min-height: 500px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .script-test-container {
                    width: 100%;
                    max-width: 600px;
                }

                .script-test-container h3 {
                    margin: 0 0 20px 0;
                    color: #1a1a1a;
                    text-align: center;
                }

                .script-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 20px;
                    justify-content: center;
                }

                .test-btn {
                    padding: 10px 20px;
                    background: #10b981;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background 0.2s ease;
                }

                .test-btn:hover {
                    background: #059669;
                }

                .info-panel {
                    background: #eff6ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                }

                .info-title {
                    font-weight: 600;
                    color: #1e40af;
                    margin: 0 0 8px 0;
                }

                .info-text {
                    color: #1e40af;
                    margin: 0;
                    font-size: 14px;
                }

                .confirmation-dialog-trigger {
                    text-align: center;
                    padding: 40px;
                }

                .trigger-btn {
                    padding: 12px 24px;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 500;
                }

                .trigger-btn:hover {
                    background: #dc2626;
                }
            `}</style>

            {/* Load the proxy-auth script */}
            <script src="/proxy-auth.js" async></script>

            <div className="page-header">
                <h1 className="page-title">Proxy Auth Components Test</h1>
                <p className="page-subtitle">Test all converted Angular components in Next.js</p>
            </div>

            <div className="info-panel">
                <h3 className="info-title">🚀 How to Test</h3>
                <p className="info-text">
                    Select a component below to test its functionality. All components are converted from Angular to React 
                    and maintain the same API and behavior. Check the browser console for success/error messages.
                </p>
            </div>

            <div className="component-selector">
                <button
                    className={`selector-btn ${activeComponent === 'send-otp' ? 'active' : ''}`}
                    onClick={() => setActiveComponent('send-otp')}
                >
                    Send OTP Component
                </button>
                <button
                    className={`selector-btn ${activeComponent === 'user-profile' ? 'active' : ''}`}
                    onClick={() => setActiveComponent('user-profile')}
                >
                    User Profile Component
                </button>
                <button
                    className={`selector-btn ${activeComponent === 'login' ? 'active' : ''}`}
                    onClick={() => setActiveComponent('login')}
                >
                    Login Component
                </button>
                <button
                    className={`selector-btn ${activeComponent === 'confirmation' ? 'active' : ''}`}
                    onClick={() => setActiveComponent('confirmation')}
                >
                    Confirmation Dialog
                </button>
                <button
                    className={`selector-btn ${activeComponent === 'script-test' ? 'active' : ''}`}
                    onClick={() => setActiveComponent('script-test')}
                >
                    Script Integration
                </button>
            </div>

            <div className="component-container">
                {activeComponent === 'confirmation' ? (
                    <div className="confirmation-dialog-trigger">
                        <h3>Confirmation Dialog Test</h3>
                        <p>Click the button below to test the confirmation dialog:</p>
                        <button 
                            className="trigger-btn"
                            onClick={() => setShowConfirmDialog(true)}
                        >
                            Show Confirmation Dialog
                        </button>
                    </div>
                ) : (
                    renderComponent()
                )}
            </div>

            {/* Confirmation Dialog */}
            <ConfirmationDialogComponent
                isOpen={showConfirmDialog}
                onClose={() => setShowConfirmDialog(false)}
                companyId="test-company-123"
                authToken="test-auth-token"
                companyName="Test Company Inc."
                onConfirm={handleSuccess}
                onError={handleFailure}
            />
        </div>
    );
}
