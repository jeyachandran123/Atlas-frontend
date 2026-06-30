import { ApiError, type ErrorResponse } from "@/types/api";
import { getAccessToken } from "@/lib/api/token-store";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip attaching the Authorization header (login/register/refresh) */
  skipAuth?: boolean;
}

/**
 * Core fetch wrapper. All typed API modules (auth.ts, chat.ts, repos.ts,
 * files.ts, git.ts, search.ts) build on this.
 *
 * Responsibilities:
 *  - Attach Bearer token from the in-memory token store
 *  - Serialize JSON bodies
 *  - Parse the backend's ErrorResponse shape into a typed ApiError
 *  - Surface X-Request-Id for support/debugging
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;

  const finalHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      (finalHeaders as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const requestId = response.headers.get("x-request-id") ?? undefined;

  if (!response.ok) {
    let parsed: Partial<ErrorResponse> = {};
    try {
      parsed = (await response.json()) as ErrorResponse;
    } catch {
      // Non-JSON error body (e.g. proxy/network failure) — fall through
    }
    throw new ApiError(
      parsed.message ?? response.statusText ?? "Request failed",
      response.status,
      parsed.request_id ?? requestId,
      parsed.detail,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

export { API_BASE };
