'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDevTools } from '@/lib/providers/DevToolsProvider';
import { apiClient, getApiInfo } from '@/lib/utils/api-client';

interface UserProfileComponentProps {
    authToken?: string;
    target?: string;
    showCard?: boolean;
    css?: React.CSSProperties;
    successReturn?: (arg: any) => any;
    failureReturn?: (arg: any) => any;
    otherData?: { [key: string]: any };
}

interface UserDetails {
    name: string;
    mobile: string;
    email: string;
    companies?: CompanyDetails[];
}

interface CompanyDetails {
    id: string;
    companyName: string;
    role?: string;
}

export function UserProfileComponent({
    authToken,
    target = '_self',
    showCard = true,
    css,
    successReturn,
    failureReturn,
    otherData = {},
}: UserProfileComponentProps) {
    const { addLog } = useDevTools();
    
    // State management
    const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previousName, setPreviousName] = useState<string>('');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<CompanyDetails | null>(null);
    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        email: '',
    });
    const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

    // Default CSS styles
    const defaultCss: React.CSSProperties = {
        position: 'absolute',
        marginLeft: '50%',
        top: '10px',
        ...css,
    };

    // Validation regex (equivalent to UPDATE_REGEX from Angular)
    const UPDATE_REGEX = /^[a-zA-Z\s]+$/;

    // Load user details on component mount
    useEffect(() => {
        if (authToken) {
            loadUserDetails();
        }
    }, [authToken]);

    const loadUserDetails = async () => {
        if (!authToken) {
            setError('Authentication token is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            addLog('info', 'Loading user profile details from backend', { 
                authToken: '***',
                apiInfo: getApiInfo()
            });

            const result = await apiClient.getUserProfile(authToken);

            if (result.success && result.data) {
                const userData = result.data;
                setUserDetails(userData);
                setPreviousName(userData.name);
                setFormData({
                    name: userData.name || '',
                    mobile: userData.mobile || '',
                    email: userData.email || '',
                });
                addLog('info', 'User profile loaded successfully from backend', { 
                    name: userData.name,
                    companiesCount: userData.companies?.length || 0 
                });
            } else {
                throw new Error(result.error || 'Failed to load user profile');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load user profile';
            setError(errorMessage);
            addLog('error', 'Failed to load user profile', error);
            failureReturn?.(error);
        } finally {
            setLoading(false);
        }
    };

    const validateForm = (): boolean => {
        const errors: {[key: string]: string} = {};

        if (!formData.name.trim()) {
            errors.name = 'Name is required';
        } else if (!UPDATE_REGEX.test(formData.name)) {
            errors.name = 'Name can only contain letters and spaces';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
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

    const handleUpdateUser = async () => {
        if (!validateForm() || !authToken) {
            return;
        }

        setUpdating(true);
        setError(null);

        try {
            addLog('info', 'Updating user profile', { name: formData.name });

            const result = await apiClient.updateUserProfile({
                authToken,
                name: formData.name,
                ...otherData,
            });

            if (result.success) {
                setUserDetails(prev => prev ? { ...prev, name: formData.name } : null);
                setPreviousName(formData.name);
                successReturn?.(result.data);
                addLog('info', 'User profile updated successfully', result.data);
            } else {
                throw new Error(result.error || 'Failed to update user profile');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update user profile';
            setError(errorMessage);
            addLog('error', 'Failed to update user profile', error);
            failureReturn?.(error);
        } finally {
            setUpdating(false);
        }
    };

    const handleLeaveCompany = (company: CompanyDetails) => {
        setSelectedCompany(company);
        setShowConfirmDialog(true);
    };

    const confirmLeaveCompany = async () => {
        if (!selectedCompany) return;

        try {
            addLog('info', 'Leaving company', { companyId: selectedCompany.id });

            const result = await apiClient.leaveCompany({
                companyId: selectedCompany.id,
                authToken: authToken!,
            });

            if (result.success) {
                
                // Update user details to remove the company
                setUserDetails(prev => prev ? {
                    ...prev,
                    companies: prev.companies?.filter(c => c.id !== selectedCompany.id) || []
                } : null);

                // Send message to parent window
                window.parent.postMessage(
                    { 
                        type: 'proxy', 
                        data: { 
                            event: 'userLeftCompany', 
                            companyId: selectedCompany.id 
                        } 
                    },
                    '*'
                );

                successReturn?.(result);
                addLog('info', 'Successfully left company', result);
            } else {
                throw new Error('Failed to leave company');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to leave company';
            setError(errorMessage);
            addLog('error', 'Failed to leave company', error);
            failureReturn?.(error);
        } finally {
            setShowConfirmDialog(false);
            setSelectedCompany(null);
        }
    };

    const hasChanges = formData.name !== previousName;

    if (loading) {
        return (
            <div style={defaultCss} className="proxy-user-profile loading">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading user profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={defaultCss} className="proxy-user-profile">
            <style jsx>{`
                .proxy-user-profile {
                    font-family: 'Inter', sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }

                .profile-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    padding: 24px;
                    margin-bottom: 20px;
                }

                .profile-header {
                    margin-bottom: 24px;
                }

                .profile-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin: 0 0 8px 0;
                }

                .profile-subtitle {
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

                .form-input:disabled {
                    background-color: #f9fafb;
                    color: #6b7280;
                    cursor: not-allowed;
                }

                .form-error {
                    color: #ef4444;
                    font-size: 12px;
                    margin-top: 4px;
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

                .companies-section {
                    margin-top: 32px;
                }

                .companies-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin: 0 0 16px 0;
                }

                .companies-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }

                .companies-table th,
                .companies-table td {
                    padding: 12px 16px;
                    text-align: left;
                    border-bottom: 1px solid #e5e7eb;
                }

                .companies-table th {
                    background: #f9fafb;
                    font-weight: 600;
                    color: #374151;
                    font-size: 14px;
                }

                .companies-table td {
                    font-size: 14px;
                    color: #1f2937;
                }

                .btn-danger {
                    background: #ef4444;
                    color: white;
                    padding: 6px 12px;
                    font-size: 12px;
                }

                .btn-danger:hover {
                    background: #dc2626;
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

                .loading-spinner {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 40px;
                }

                .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid #e5e7eb;
                    border-top: 3px solid #3b82f6;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 12px;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .modal-overlay {
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
                }

                .modal-content {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                }

                .modal-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin: 0 0 12px 0;
                }

                .modal-message {
                    color: #6b7280;
                    margin: 0 0 24px 0;
                    line-height: 1.5;
                }

                .modal-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                }

                .btn-secondary {
                    background: #f3f4f6;
                    color: #374151;
                }

                .btn-secondary:hover {
                    background: #e5e7eb;
                }
            `}</style>

            {showCard && (
                <div className="profile-card">
                    <div className="profile-header">
                        <h2 className="profile-title">User Profile</h2>
                        <p className="profile-subtitle">Manage your account information</p>
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <form onSubmit={(e) => { e.preventDefault(); handleUpdateUser(); }}>
                        <div className="form-group">
                            <label className="form-label">Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="Enter your name"
                            />
                            {formErrors.name && (
                                <div className="form-error">{formErrors.name}</div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Mobile</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.mobile}
                                disabled
                                placeholder="Mobile number"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                className="form-input"
                                value={formData.email}
                                disabled
                                placeholder="Email address"
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={!hasChanges || updating}
                            >
                                {updating ? 'Updating...' : 'Update Profile'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {userDetails?.companies && userDetails.companies.length > 0 && (
                <div className="companies-section">
                    <h3 className="companies-title">Associated Companies</h3>
                    <table className="companies-table">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Company Name</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {userDetails.companies.map((company, index) => (
                                <tr key={company.id}>
                                    <td>{index + 1}</td>
                                    <td>{company.companyName}</td>
                                    <td>
                                        <button
                                            className="btn btn-danger"
                                            onClick={() => handleLeaveCompany(company)}
                                        >
                                            Leave
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Confirmation Dialog */}
            {showConfirmDialog && selectedCompany && (
                <div className="modal-overlay" onClick={() => setShowConfirmDialog(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Confirm Action</h3>
                        <p className="modal-message">
                            Are you sure you want to leave "{selectedCompany.companyName}"? 
                            This action cannot be undone.
                        </p>
                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowConfirmDialog(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={confirmLeaveCompany}
                            >
                                Leave Company
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserProfileComponent;
