// Feature/Block related constants
export const STEP_LABELS = ["Select Block", "Name Block", "Configure Services", "Authorization", "Design & Code"];

export const NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_\s]+$/;
export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 60;

export const THEME_OPTIONS: { label: string; value: string }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

export const EDIT_TABS = [
  { id: "service", label: "Service" },
  { id: "settings", label: "Settings" },
  { id: "design", label: "Design & Code" },
] as const;

export const FEATURE_SERVICE_IDS = {
  Msg91OtpService: 6,
  GoogleAuthentication: 7,
  PasswordAuthentication: 9,
} as const;

export const DEFAULT_PROXY_SCRIPT_BASE_URL =
  process.env.NEXT_PUBLIC_PROXY_SCRIPT_BASE_URL ?? process.env.NEXT_PUBLIC_PROXY_SERVER ?? "https://test.proxy.msg91.com";

export const PROXY_AUTH_SCRIPT_ATTR = "data-proxy-auth-script";

export const REDIRECT_FIELD_PATTERNS = ["redirect", "callback", "return_url", "returnurl"];

// Proxy Auth Script Utilities
export const getProxyAuthScriptSrc = (timestamp?: number) =>
  `${DEFAULT_PROXY_SCRIPT_BASE_URL.replace(/\/$/, "")}/assets/proxy-auth/proxy-auth.js${timestamp ? `?time=${timestamp}` : ""}`;

export const buildProxyAuthScript = (referenceId?: string | null, type?: string | null) => {
  const sanitizedReference = referenceId?.trim() || "<reference_id>";
  const normalizedType = (type?.trim() || "authorization").replace(/\s+/g, "-").toLowerCase();
  const scriptUrl = getProxyAuthScriptSrc();
  return `<script type="text/javascript">
    var configuration = {
        referenceId: '${sanitizedReference}',
        type: '${normalizedType}',
        success: (data) => {
            console.log('success response', data);
        },
        failure: (error) => {
            console.log('failure reason', error);
        },
    };
</script>
<script
    type="text/javascript"
    onload="initVerification(configuration)"
    src="${scriptUrl}"
></script>`;
};

export const buildDemoDivSnippet = (referenceId?: string | null) => 
  `<div id="${referenceId?.trim() || "proxy-auth-button"}"></div>`;

