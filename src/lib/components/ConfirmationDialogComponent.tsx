'use client';

import React, { useState } from 'react';
import { useDevTools } from '@/lib/providers/DevToolsProvider';

interface ConfirmationDialogComponentProps {
    isOpen: boolean;
    onClose: (action?: string) => void;
    companyId: string;
    authToken: string;
    companyName?: string;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: (result: any) => void;
    onError?: (error: any) => void;
}

export function ConfirmationDialogComponent({
    isOpen,
    onClose,
    companyId,
    authToken,
    companyName = 'this company',
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onError,
}: ConfirmationDialogComponentProps) {
    const { addLog } = useDevTools();
    const [isProcessing, setIsProcessing] = useState(false);

    const defaultMessage = message || `Are you sure you want to leave "${companyName}"? This action cannot be undone.`;

    const handleConfirmLeave = async () => {
        if (!companyId || !authToken) {
            const error = 'Missing required parameters';
            addLog('error', error);
            onError?.(error);
            return;
        }

        setIsProcessing(true);

        try {
            addLog('info', 'Confirming leave company action', { 
                companyId, 
                authToken: '***' 
            });

            const response = await fetch('/api/leave-company', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    companyId,
                    authToken,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                
                // Send message to parent window (equivalent to Angular's postMessage)
                window.parent.postMessage(
                    { 
                        type: 'proxy', 
                        data: { 
                            event: 'userLeftCompany', 
                            companyId 
                        } 
                    },
                    '*'
                );

                addLog('info', 'Successfully left company', result);
                onConfirm?.(result);
                onClose('confirmed');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to leave company');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to leave company';
            addLog('error', 'Failed to leave company', error);
            onError?.(error);
            onClose('error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancel = () => {
        addLog('info', 'User cancelled confirmation dialog');
        onClose('cancelled');
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleCancel();
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="confirmation-dialog-overlay" onClick={handleOverlayClick}>
            <style jsx>{`
                .confirmation-dialog-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    font-family: 'Inter', sans-serif;
                }

                .confirmation-dialog-content {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                    animation: slideIn 0.2s ease-out;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                .dialog-header {
                    margin-bottom: 16px;
                }

                .dialog-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin: 0 0 8px 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .warning-icon {
                    width: 20px;
                    height: 20px;
                    color: #f59e0b;
                }

                .dialog-message {
                    color: #6b7280;
                    margin: 0;
                    line-height: 1.5;
                    font-size: 14px;
                }

                .dialog-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 24px;
                }

                .dialog-btn {
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 500;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: none;
                    min-width: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }

                .dialog-btn:disabled {
                    cursor: not-allowed;
                    opacity: 0.6;
                }

                .btn-cancel {
                    background: #f3f4f6;
                    color: #374151;
                    border: 1px solid #d1d5db;
                }

                .btn-cancel:hover:not(:disabled) {
                    background: #e5e7eb;
                }

                .btn-confirm {
                    background: #ef4444;
                    color: white;
                }

                .btn-confirm:hover:not(:disabled) {
                    background: #dc2626;
                }

                .btn-confirm:focus {
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3);
                }

                .processing-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid transparent;
                    border-top: 2px solid currentColor;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .company-name {
                    font-weight: 600;
                    color: #1f2937;
                }

                .dialog-content-wrapper {
                    position: relative;
                }

                .close-button {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background: #f3f4f6;
                    border: none;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #6b7280;
                    transition: all 0.2s ease;
                }

                .close-button:hover {
                    background: #e5e7eb;
                    color: #374151;
                }

                .close-icon {
                    width: 16px;
                    height: 16px;
                }
            `}</style>

            <div className="confirmation-dialog-content" onClick={(e) => e.stopPropagation()}>
                <div className="dialog-content-wrapper">
                    <button 
                        className="close-button" 
                        onClick={handleCancel}
                        disabled={isProcessing}
                        title="Close dialog"
                    >
                        <svg className="close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="dialog-header">
                        <h3 className="dialog-title">
                            <svg className="warning-icon" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {title}
                        </h3>
                    </div>

                    <p className="dialog-message">
                        {defaultMessage.includes(companyName) ? (
                            <>
                                Are you sure you want to leave{' '}
                                <span className="company-name">"{companyName}"</span>?{' '}
                                This action cannot be undone.
                            </>
                        ) : (
                            defaultMessage
                        )}
                    </p>

                    <div className="dialog-actions">
                        <button
                            className="dialog-btn btn-cancel"
                            onClick={handleCancel}
                            disabled={isProcessing}
                        >
                            {cancelText}
                        </button>
                        <button
                            className="dialog-btn btn-confirm"
                            onClick={handleConfirmLeave}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <div className="processing-spinner"></div>
                                    Processing...
                                </>
                            ) : (
                                confirmText
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ConfirmationDialogComponent;
