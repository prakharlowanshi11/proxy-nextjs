const STORAGE_KEY = "proxy_auth_token";
const COOKIE_NAME = "authToken";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const isBrowser = () => typeof window !== "undefined";

const readCookie = (name: string): string | null => {
  if (!isBrowser()) {
    return null;
  }
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    const [key, value] = cookie.split("=");
    if (key === name) {
      return decodeURIComponent(value ?? "");
    }
  }
  return null;
};

const setCookie = (name: string, value: string) => {
  if (!isBrowser()) {
    return;
  }
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${COOKIE_MAX_AGE}`;
};

const clearCookie = (name: string) => {
  if (!isBrowser()) {
    return;
  }
  document.cookie = `${name}=;path=/;max-age=0`;
};

export function getAuthToken(): string | null {
  if (!isBrowser()) {
    return null;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? readCookie(COOKIE_NAME);
  } catch {
    return readCookie(COOKIE_NAME);
  }
}

export function setAuthToken(token: string): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch (error) {
    console.error("Failed to persist auth token", error);
  }
  setCookie(COOKIE_NAME, token);
}

export function clearAuthToken(): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear auth token", error);
  }
  clearCookie(COOKIE_NAME);
}
