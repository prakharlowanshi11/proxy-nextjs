import { getAuthToken } from "@/lib/auth/token";
import { ApiResponse, ProxyApiError, resolveApiErrors } from "./types";

const DEFAULT_BASE_URL = "https://apitest.msg91.com/api";

export type QueryValue = string | number | boolean | undefined | null | Array<string | number | boolean>;

export type ProxyRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  params?: Record<string, QueryValue>;
  body?: unknown;
  headers?: HeadersInit;
  json?: boolean;
  signal?: AbortSignal;
};

const sanitizeBaseUrl = (url: string) => url.replace(/\/$/, "");
const stripLeadingSlash = (path: string) => path.replace(/^\//, "");

const buildUrl = (path: string, params?: Record<string, QueryValue>) => {
  const base = sanitizeBaseUrl(process.env.NEXT_PUBLIC_PROXY_API_BASE_URL ?? DEFAULT_BASE_URL);
  const url = new URL(stripLeadingSlash(path), `${base}/`);

  if (params) {
    const search = url.searchParams;
    Object.entries(params).forEach(([key, rawValue]) => {
      if (rawValue === undefined || rawValue === null) {
        return;
      }
      const value = rawValue as QueryValue;
      if (Array.isArray(value)) {
        value.forEach((entry) => search.append(key, String(entry)));
      } else {
        search.set(key, String(value));
      }
    });
  }

  return url;
};

const shouldSerializeBody = (body: unknown) =>
  body !== undefined && body !== null && !(body instanceof FormData) && !(body instanceof Blob);

export async function proxyRequest<T, TRequest = unknown>(
  path: string,
  options: ProxyRequestOptions = {}
): Promise<ApiResponse<T, TRequest>> {
  const { method = "GET", params, body, headers, json = true, signal } = options;
  const url = buildUrl(path, params);

  const finalHeaders = new Headers({
    Accept: "application/json",
    ...headers,
  });

  if (json && shouldSerializeBody(body)) {
    finalHeaders.set("Content-Type", "application/json");
  }

  const staticToken = process.env.NEXT_PUBLIC_PROXY_API_TOKEN;
  const storedToken = getAuthToken();
  const resolvedToken = storedToken ?? staticToken ?? null;
  if (resolvedToken && !finalHeaders.has("Authorization")) {
    finalHeaders.set("Authorization", resolvedToken);
  }

  const fetchInit: RequestInit = {
    method,
    headers: finalHeaders,
    credentials: "include",
    cache: "no-store",
    signal,
  };

  if (method !== "GET" && body !== undefined) {
    fetchInit.body = json && shouldSerializeBody(body) ? JSON.stringify(body) : (body as BodyInit);
  }

  const response = await fetch(url, fetchInit);
  const rawText = await response.text();
  let payload: ApiResponse<T, TRequest> | null = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText) as ApiResponse<T, TRequest>;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message = payload?.errors ? resolveApiErrors(payload.errors).join("\n") : `${response.status} ${response.statusText}`;
    throw new ProxyApiError(message || "Request failed", payload ?? undefined, response.status);
  }

  if (!payload) {
    throw new ProxyApiError("Empty response received from server", undefined, response.status);
  }

  if (payload.hasError) {
    const message = resolveApiErrors(payload.errors).join("\n");
    throw new ProxyApiError(message || "Request failed", payload, response.status);
  }

  return payload;
}
