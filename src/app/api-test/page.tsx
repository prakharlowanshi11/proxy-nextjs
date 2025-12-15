'use client';

import React, { useState } from 'react';
import { apiClient, getApiInfo } from '@/lib/utils/api-client';

export default function ApiTestPage() {
    const [testResults, setTestResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const addResult = (test: string, success: boolean, data: any) => {
        setTestResults(prev => [...prev, {
            test,
            success,
            data,
            timestamp: new Date().toISOString(),
        }]);
    };

    const testApiConnection = async () => {
        setIsLoading(true);
        setTestResults([]);

        const apiInfo = getApiInfo();
        addResult('API Configuration', true, apiInfo);

        // Test widget data API
        try {
            const result = await apiClient.getWidgetData({
                referenceId: 'test-123',
                type: 'subscription'
            });
            addResult('Widget Data API', result.success, result);
        } catch (error) {
            addResult('Widget Data API', false, error);
        }

        // Test subscription plans API
        try {
            const result = await apiClient.getSubscriptionPlans({
                referenceId: 'test-123'
            });
            addResult('Subscription Plans API', result.success, result);
        } catch (error) {
            addResult('Subscription Plans API', false, error);
        }

        // Test login API (with dummy data)
        try {
            const result = await apiClient.login({
                username: 'test@example.com',
                password: 'testpassword123'
            });
            addResult('Login API', result.success, result);
        } catch (error) {
            addResult('Login API', false, error);
        }

        setIsLoading(false);
    };

    return (
        <div className="api-test-page">
            <style jsx>{`
                .api-test-page {
                    padding: 20px;
                    max-width: 1000px;
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

                .test-button {
                    display: block;
                    margin: 0 auto 30px auto;
                    padding: 12px 24px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s ease;
                }

                .test-button:hover:not(:disabled) {
                    background: #2563eb;
                }

                .test-button:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                }

                .results-container {
                    background: #f9fafb;
                    border-radius: 12px;
                    padding: 20px;
                    min-height: 200px;
                }

                .results-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0 0 20px 0;
                    color: #1a1a1a;
                }

                .result-item {
                    background: white;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 12px;
                    border-left: 4px solid #e5e7eb;
                }

                .result-item.success {
                    border-left-color: #10b981;
                }

                .result-item.error {
                    border-left-color: #ef4444;
                }

                .result-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .result-test {
                    font-weight: 600;
                    color: #1a1a1a;
                }

                .result-status {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 500;
                }

                .result-status.success {
                    background: #d1fae5;
                    color: #065f46;
                }

                .result-status.error {
                    background: #fee2e2;
                    color: #991b1b;
                }

                .result-data {
                    background: #f3f4f6;
                    border-radius: 4px;
                    padding: 12px;
                    font-family: 'Monaco', 'Menlo', monospace;
                    font-size: 12px;
                    overflow-x: auto;
                    white-space: pre-wrap;
                    color: #374151;
                }

                .result-timestamp {
                    font-size: 11px;
                    color: #6b7280;
                    margin-top: 8px;
                }

                .loading-spinner {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                }

                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid #e5e7eb;
                    border-top: 3px solid #3b82f6;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .empty-state {
                    text-align: center;
                    padding: 40px;
                    color: #6b7280;
                }
            `}</style>

            <div className="page-header">
                <h1 className="page-title">API Connection Test</h1>
                <p className="page-subtitle">
                    Test the backend API connections for proxy-auth components
                </p>
            </div>

            <button
                className="test-button"
                onClick={testApiConnection}
                disabled={isLoading}
            >
                {isLoading ? 'Testing APIs...' : 'Test API Connections'}
            </button>

            <div className="results-container">
                <h3 className="results-title">Test Results</h3>
                
                {isLoading && (
                    <div className="loading-spinner">
                        <div className="spinner"></div>
                    </div>
                )}

                {!isLoading && testResults.length === 0 && (
                    <div className="empty-state">
                        Click "Test API Connections" to run tests
                    </div>
                )}

                {testResults.map((result, index) => (
                    <div 
                        key={index} 
                        className={`result-item ${result.success ? 'success' : 'error'}`}
                    >
                        <div className="result-header">
                            <span className="result-test">{result.test}</span>
                            <span className={`result-status ${result.success ? 'success' : 'error'}`}>
                                {result.success ? 'SUCCESS' : 'ERROR'}
                            </span>
                        </div>
                        
                        <div className="result-data">
                            {JSON.stringify(result.data, null, 2)}
                        </div>
                        
                        <div className="result-timestamp">
                            {new Date(result.timestamp).toLocaleString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
