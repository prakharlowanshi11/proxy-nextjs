// Environment configuration for Next.js
export interface Environment {
    production: boolean;
    env: string;
    apiUrl: string;
    baseUrl: string;
    msgMidProxy: string;
    uiEncodeKey?: string;
    uiIvKey?: string;
    apiEncodeKey?: string;
    apiIvKey?: string;
    hCaptchaSiteKey?: string;
    sendOtpAuthKey?: string;
}

// Environment variables from process.env
const envVariables = {
    uiEncodeKey: process.env.NEXT_PUBLIC_AUTH_UI_ENCODE_KEY,
    uiIvKey: process.env.NEXT_PUBLIC_AUTH_UI_IV_KEY,
    apiEncodeKey: process.env.NEXT_PUBLIC_AUTH_API_ENCODE_KEY,
    apiIvKey: process.env.NEXT_PUBLIC_AUTH_API_IV_KEY,
    hCaptchaSiteKey: process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY,
    sendOtpAuthKey: process.env.NEXT_PUBLIC_SEND_OTP_AUTH_KEY,
};

// Development environment
const developmentEnvironment: Environment = {
    production: false,
    env: 'local',
    apiUrl: 'https://apitest.msg91.com/api',
    baseUrl: 'https://test.proxy.msg91.com',
    msgMidProxy: '',
    ...envVariables,
};

// Production environment
const productionEnvironment: Environment = {
    production: true,
    env: 'production',
    apiUrl: 'https://api.msg91.com/api',
    baseUrl: 'https://proxy.msg91.com',
    msgMidProxy: '',
    ...envVariables,
};

// Export current environment based on NODE_ENV
export const environment: Environment = 
    process.env.NODE_ENV === 'production' 
        ? productionEnvironment 
        : developmentEnvironment;

// Helper function to check if we're in production
export const isProduction = () => environment.production;

// Helper function to check if we're in development
export const isDevelopment = () => !environment.production;
