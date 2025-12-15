// Type definitions for Proxy Auth configuration
export interface ProxyAuthConfig {
    referenceId?: string;
    type?: string;
    authToken?: string;
    showCompanyDetails?: boolean;
    userToken?: string;
    isRolePermission?: boolean;
    isPreview?: boolean;
    isLogin?: boolean;
    loginRedirectUrl?: string;
    theme?: string;
    target?: '_self' | '_blank' | '_parent' | '_top';
    style?: string;
    success: (data: any) => void;
    failure?: (error: any) => void;
    [key: string]: any; // For additional properties
}

export interface ProxyAuthElement extends HTMLElement {
    _successCallback?: (data: any) => void;
    _failureCallback?: (error: any) => void;
    _otherData?: Record<string, any>;
    triggerSuccess: (data: any) => void;
    triggerFailure: (error: any) => void;
    getOtherData: () => Record<string, any>;
}

// Global window interface extensions
declare global {
    interface Window {
        initVerification: (config: ProxyAuthConfig) => void;
        intlTelInput: any;
        libLoaded?: boolean;
    }
}

export const RESERVED_KEYS = ['referenceId', 'target', 'style', 'success', 'failure'] as const;
