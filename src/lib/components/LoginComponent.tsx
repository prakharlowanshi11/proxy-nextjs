'use client';

import React, { useState, useEffect } from 'react';
import { useDevTools } from '@/lib/providers/DevToolsProvider';
import { apiClient, getApiInfo } from '@/lib/utils/api-client';
import { HCaptcha } from './HCaptcha';

interface LoginComponentProps {
    loginServiceData?: any;
    onTogglePopUp?: (data: any) => void;
    onClosePopUp?: () => void;
    onOpenPopUp?: (data: any) => void;
    onFailure?: (error: any) => void;
    onSuccess?: (data: any) => void;
    prefillDetails?: string;
}

interface LoginFormData {
    username: string;
    password: string;
}

interface ResetFormData {
    userDetails: string;
}

export function LoginComponent({
    loginServiceData,
    onTogglePopUp,
    onClosePopUp,
    onOpenPopUp,
    onFailure,
    onSuccess,
    prefillDetails,
}: LoginComponentProps) {
    const { addLog } = useDevTools();
    
    // State management
    const [step, setStep] = useState(1); // 1: Login, 2: Reset Password, 3: OTP Verification
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hCaptchaToken, setHCaptchaToken] = useState('');
    const [hCaptchaVerified, setHCaptchaVerified] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [apiError, setApiError] = useState<string | null>(null);
    
    // Form data
    const [loginForm, setLoginForm] = useState<LoginFormData>({
        username: prefillDetails || '',
        password: '',
    });
    
    const [resetForm, setResetForm] = useState<ResetFormData>({
        userDetails: '',
    });
    
    const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

    // Validation patterns
    const EMAIL_OR_MOBILE_REGEX = /^(?:(?:\+|0{0,2})91(\s*[\-]\s*)?|[0]?)?[6789]\d{9}$|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    // Timer for OTP resend
    useEffect(() => {
        let interval: NodeJS.Timeout;
        
        if (remainingSeconds > 0) {
            interval = setInterval(() => {
                setRemainingSeconds(prev => {
                    if (prev <= 1) {
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        
        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [remainingSeconds]);

    const validateLoginForm = (): boolean => {
        const errors: {[key: string]: string} = {};

        if (!loginForm.username.trim()) {
            errors.username = 'Username is required';
        }

        if (!loginForm.password.trim()) {
            errors.password = 'Password is required';
        } else if (loginForm.password.includes(' ')) {
            errors.password = 'Password cannot contain spaces';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateResetForm = (): boolean => {
        const errors: {[key: string]: string} = {};

        if (!resetForm.userDetails.trim()) {
            errors.userDetails = 'Email or mobile number is required';
        } else if (!EMAIL_OR_MOBILE_REGEX.test(resetForm.userDetails)) {
            errors.userDetails = 'Please enter a valid email or mobile number';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleLoginFormChange = (field: keyof LoginFormData, value: string) => {
        setLoginForm(prev => ({
            ...prev,
            [field]: value,
        }));
        
        // Clear error for this field
        if (formErrors[field]) {
            setFormErrors(prev => ({
                ...prev,
                [field]: '',
            }));
        }
    };

    const handleResetFormChange = (field: keyof ResetFormData, value: string) => {
        setResetForm(prev => ({
            ...prev,
            [field]: value,
        }));
        
        // Clear error for this field
        if (formErrors[field]) {
            setFormErrors(prev => ({
                ...prev,
                [field]: '',
            }));
        }
    };

    const handleLogin = async () => {
        if (!validateLoginForm()) {
            return;
        }

        setIsLoading(true);
        setApiError(null);

        try {
            addLog('info', 'Attempting login', { 
                username: loginForm.username,
                apiInfo: getApiInfo()
            });

            const result = await apiClient.login({
                username: loginForm.username,
                password: loginForm.password,
                hCaptchaToken,
            });

            if (result.success) {
                addLog('info', 'Login successful', { username: loginForm.username });
                onSuccess?.(result.data);
                onClosePopUp?.();
            } else {
                throw new Error(result.error || 'Login failed');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            setApiError(errorMessage);
            addLog('error', 'Login failed', error);
            onFailure?.(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!validateResetForm()) {
            return;
        }

        setIsLoading(true);
        setApiError(null);

        try {
            addLog('info', 'Requesting password reset', { userDetails: resetForm.userDetails });

            const result = await apiClient.resetPassword({
                userDetails: resetForm.userDetails,
                hCaptchaToken,
            });

            if (result.success) {
                addLog('info', 'Password reset OTP sent', { userDetails: resetForm.userDetails });
                setStep(3); // Move to OTP verification step
                setRemainingSeconds(60); // Start 60-second timer
            } else {
                throw new Error(result.error || 'Failed to send reset OTP');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send reset OTP';
            setApiError(errorMessage);
            addLog('error', 'Password reset failed', error);
            onFailure?.(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleHCaptchaVerify = (token: string) => {
        setHCaptchaToken(token);
        setHCaptchaVerified(true);
        addLog('info', 'hCaptcha verified successfully');
    };

    const handleHCaptchaError = (error: any) => {
        setHCaptchaToken('');
        setHCaptchaVerified(false);
        addLog('error', 'hCaptcha verification failed', error);
    };

    const renderLoginStep = () => (
        <div className="login-step">
            <div className="form-header">
                <h2 className="form-title">Sign In</h2>
                <p className="form-subtitle">Enter your credentials to continue</p>
            </div>

            {apiError && (
                <div className="error-message">
                    {apiError}
                </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                <div className="form-group">
                    <label className="form-label">Username / Email / Mobile</label>
                    <input
                        type="text"
                        className="form-input"
                        value={loginForm.username}
                        onChange={(e) => handleLoginFormChange('username', e.target.value)}
                        placeholder="Enter username, email or mobile"
                    />
                    {formErrors.username && (
                        <div className="form-error">{formErrors.username}</div>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label">Password</label>
                    <div className="password-input-wrapper">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="form-input"
                            value={loginForm.password}
                            onChange={(e) => handleLoginFormChange('password', e.target.value)}
                            placeholder="Enter your password"
                        />
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? '👁️' : '👁️‍🗨️'}
                        </button>
                    </div>
                    {formErrors.password && (
                        <div className="form-error">{formErrors.password}</div>
                    )}
                </div>

                <div className="form-group">
                    <HCaptcha
                        onVerify={handleHCaptchaVerify}
                        onError={handleHCaptchaError}
                        theme="light"
                    />
                </div>

                <div className="form-actions">
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isLoading || !hCaptchaVerified}
                    >
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </button>
                </div>

                <div className="form-links">
                    <button
                        type="button"
                        className="link-button"
                        onClick={() => setStep(2)}
                    >
                        Forgot Password?
                    </button>
                </div>
            </form>
        </div>
    );

    const renderResetStep = () => (
        <div className="reset-step">
            <div className="form-header">
                <h2 className="form-title">Reset Password</h2>
                <p className="form-subtitle">Enter your email or mobile to receive reset instructions</p>
            </div>

            {apiError && (
                <div className="error-message">
                    {apiError}
                </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }}>
                <div className="form-group">
                    <label className="form-label">Email / Mobile</label>
                    <input
                        type="text"
                        className="form-input"
                        value={resetForm.userDetails}
                        onChange={(e) => handleResetFormChange('userDetails', e.target.value)}
                        placeholder="Enter email or mobile number"
                    />
                    {formErrors.userDetails && (
                        <div className="form-error">{formErrors.userDetails}</div>
                    )}
                </div>

                <div className="form-group">
                    <HCaptcha
                        onVerify={handleHCaptchaVerify}
                        onError={handleHCaptchaError}
                        theme="light"
                    />
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setStep(1)}
                    >
                        Back to Login
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isLoading || !hCaptchaVerified}
                    >
                        {isLoading ? 'Sending...' : 'Send Reset OTP'}
                    </button>
                </div>
            </form>
        </div>
    );

    const renderOtpStep = () => (
        <div className="otp-step">
            <div className="form-header">
                <h2 className="form-title">Verify OTP</h2>
                <p className="form-subtitle">
                    We've sent a verification code to {resetForm.userDetails}
                </p>
            </div>

            <div className="otp-timer">
                {remainingSeconds > 0 ? (
                    <p>Resend OTP in {remainingSeconds} seconds</p>
                ) : (
                    <button
                        className="link-button"
                        onClick={handleResetPassword}
                    >
                        Resend OTP
                    </button>
                )}
            </div>

            <div className="form-actions">
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setStep(2)}
                >
                    Back
                </button>
            </div>
        </div>
    );

    return (
        <div className="proxy-login-component">
            <style jsx>{`
                .proxy-login-component {
                    font-family: 'Inter', sans-serif;
                    max-width: 400px;
                    margin: 0 auto;
                    padding: 24px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }

                .form-header {
                    text-align: center;
                    margin-bottom: 24px;
                }

                .form-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin: 0 0 8px 0;
                }

                .form-subtitle {
                    color: #666;
                    font-size: 14px;
                    margin: 0;
                }

                .form-group {
                    margin-bottom: 20px;
                }

                .form-label {
                    display: block;
                    font-weight: 500;
                    color: #374151;
                    margin-bottom: 6px;
                    font-size: 14px;
                }

                .form-input {
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 16px;
                    transition: border-color 0.2s ease;
                    box-sizing: border-box;
                }

                .form-input:focus {
                    outline: none;
                    border-color: #3b82f6;
                }

                .password-input-wrapper {
                    position: relative;
                }

                .password-toggle {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 16px;
                }

                .form-error {
                    color: #ef4444;
                    font-size: 12px;
                    margin-top: 4px;
                }

                .error-message {
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    color: #dc2626;
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    font-size: 14px;
                }

                .form-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 24px;
                }

                .btn {
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 500;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: none;
                    flex: 1;
                }

                .btn-primary {
                    background: #3b82f6;
                    color: white;
                }

                .btn-primary:hover:not(:disabled) {
                    background: #2563eb;
                }

                .btn-primary:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                }

                .btn-secondary {
                    background: #f3f4f6;
                    color: #374151;
                    border: 1px solid #d1d5db;
                }

                .btn-secondary:hover {
                    background: #e5e7eb;
                }

                .form-links {
                    text-align: center;
                    margin-top: 16px;
                }

                .link-button {
                    background: none;
                    border: none;
                    color: #3b82f6;
                    cursor: pointer;
                    font-size: 14px;
                    text-decoration: underline;
                }

                .link-button:hover {
                    color: #2563eb;
                }

                .otp-timer {
                    text-align: center;
                    margin: 20px 0;
                    color: #666;
                    font-size: 14px;
                }
            `}</style>

            {step === 1 && renderLoginStep()}
            {step === 2 && renderResetStep()}
            {step === 3 && renderOtpStep()}
        </div>
    );
}

export default LoginComponent;
