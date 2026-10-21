import { ApiError, type ErrorResponse } from "@/types/api";
import { clearSession, getAccessToken, setAccessToken } from "@/lib/api/token-store";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuth?: boolean;
}

async function doFetch(path: string, options: RequestOptions): Promise<Response> {
  const { body, skipAuth, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = { "Content-Type": "application/json", ...(headers as Record<string, string>) };
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// Single in-flight refresh promise — all concurrent 401s share one refresh call
let _refreshing: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (_refreshing) return _refreshing;
  _refreshing = fetch("/api/auth/refresh", { method: "POST" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const t = d?.access_token ?? null;
      if (t) setAccessToken(t);
      return t;
    })
    .finally(() => { _refreshing = null; });
  return _refreshing;
}

// Proactive refresh: re-acquire a new access token 2 minutes before the
// 15-minute expiry so in-flight requests never hit a 401 mid-session.
let _proactiveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleProactiveRefresh(expiresInMs: number = 15 * 60 * 1000) {
  if (_proactiveTimer) clearTimeout(_proactiveTimer);
  const refreshAt = Math.max(expiresInMs - 2 * 60 * 1000, 30_000);
  _proactiveTimer = setTimeout(async () => {
    const token = await refreshAccessToken();
    if (token) scheduleProactiveRefresh(); // reschedule for next cycle
  }, refreshAt);
}

let _signingOut = false;

/**
 * The session is gone for good (the refresh token was refused): go to sign-in.
 *
 * Done here, once, rather than left to each caller - most callers (Retry,
 * Edit, the sidebar's queries) have no handling for it, so the error reached
 * the page as a crash instead of as "please sign in". The promise it returns
 * never settles: the page is being replaced, and resolving or rejecting would
 * only let the caller act on, or report, a request that no longer matters.
 */
export function sessionExpired(): Promise<never> {
  if (typeof window === "undefined") {
    return Promise.reject(new ApiError("Session expired. Please sign in again.", 401));
  }
  if (!_signingOut) {
    _signingOut = true;
    clearSession();
    window.location.assign("/login");
  }
  return new Promise<never>(() => {});
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await doFetch(path, options);

  // Auto-refresh on 401 and retry once
  if (response.status === 401 && !options.skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await doFetch(path, options);
    } else {
      return sessionExpired();
    }
  }

  const requestId = response.headers.get("x-request-id") ?? undefined;

  if (!response.ok) {
    let parsed: Partial<ErrorResponse> = {};
    try {
      parsed = (await response.json()) as ErrorResponse;
    } catch {
      // Non-JSON error body
    }
    throw new ApiError(
      parsed.message ?? parsed.detail ?? response.statusText ?? "Request failed",
      response.status,
      parsed.request_id ?? requestId,
      parsed.detail,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

export { API_BASE };
