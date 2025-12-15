import { environment } from '@/lib/config/environment';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

export class ApiClient {
    private baseUrl: string;
    private apiUrl: string;

    constructor() {
        this.baseUrl = environment.baseUrl;
        this.apiUrl = environment.apiUrl;
    }

    private async makeRequest<T>(
        endpoint: string, 
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        try {
            const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`;
            
            const defaultHeaders = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            };

            const config: RequestInit = {
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...options.headers,
                },
            };

            console.log(`Making API request to: ${url}`, { method: config.method || 'GET' });

            const response = await fetch(url, config);
            const data = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    data,
                    message: data.message,
                };
            } else {
                return {
                    success: false,
                    error: data.message || `HTTP ${response.status}: ${response.statusText}`,
                    message: data.message,
                };
            }
        } catch (error) {
            console.error('API request failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error',
            };
        }
    }

    // OTP related APIs
    async sendOtp(data: {
        referenceId?: string;
        authToken?: string;
        type?: string;
        otherData?: any;
    }): Promise<ApiResponse> {
        return this.makeRequest('/v5/otp', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async verifyOtp(data: {
        otp: string;
        referenceId: string;
    }): Promise<ApiResponse> {
        return this.makeRequest('/v5/otp/verify', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // User authentication APIs
    async login(data: {
        username: string;
        password: string;
        hCaptchaToken?: string;
    }): Promise<ApiResponse> {
        return this.makeRequest('/v5/user/login', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async resetPassword(data: {
        userDetails: string;
        hCaptchaToken?: string;
    }): Promise<ApiResponse> {
        return this.makeRequest('/v5/user/reset-password', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // User profile APIs
    async getUserProfile(authToken: string): Promise<ApiResponse> {
        return this.makeRequest('/v5/user/profile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
        });
    }

    async updateUserProfile(data: {
        authToken: string;
        name: string;
        [key: string]: any;
    }): Promise<ApiResponse> {
        const { authToken, ...updateData } = data;
        return this.makeRequest('/v5/user/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(updateData),
        });
    }

    async leaveCompany(data: {
        companyId: string;
        authToken: string;
    }): Promise<ApiResponse> {
        const { authToken, ...requestData } = data;
        return this.makeRequest('/v5/user/leave-company', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(requestData),
        });
    }

    // Subscription APIs
    async getSubscriptionPlans(data: {
        referenceId?: string;
        authToken?: string;
    }): Promise<ApiResponse> {
        const queryParams = new URLSearchParams();
        if (data.referenceId) queryParams.append('referenceId', data.referenceId);
        if (data.authToken) queryParams.append('authToken', data.authToken);

        const endpoint = `/v5/subscription/plans${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        
        return this.makeRequest(endpoint, {
            method: 'GET',
            headers: data.authToken ? {
                'Authorization': `Bearer ${data.authToken}`,
            } : {},
        });
    }

    async upgradeSubscription(data: {
        planData: any;
        authToken?: string;
        referenceId?: string;
    }): Promise<ApiResponse> {
        const { authToken, ...requestData } = data;
        return this.makeRequest('/v5/subscription/upgrade', {
            method: 'POST',
            headers: authToken ? {
                'Authorization': `Bearer ${authToken}`,
            } : {},
            body: JSON.stringify(requestData),
        });
    }

    // Widget data API
    async getWidgetData(data: {
        referenceId?: string;
        authToken?: string;
        type?: string;
    }): Promise<ApiResponse> {
        const queryParams = new URLSearchParams();
        if (data.referenceId) queryParams.append('referenceId', data.referenceId);
        if (data.authToken) queryParams.append('authToken', data.authToken);
        if (data.type) queryParams.append('type', data.type);

        const endpoint = `/v5/widget/data${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        
        return this.makeRequest(endpoint, {
            method: 'GET',
            headers: data.authToken ? {
                'Authorization': `Bearer ${data.authToken}`,
            } : {},
        });
    }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export environment info for debugging
export const getApiInfo = () => ({
    baseUrl: environment.baseUrl,
    apiUrl: environment.apiUrl,
    environment: environment.env,
    production: environment.production,
});
