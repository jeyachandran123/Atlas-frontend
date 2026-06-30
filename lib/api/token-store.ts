/**
 * Token storage strategy:
 *
 * - Access token: kept in memory only (this module's closure). Lost on hard
 *   refresh by design — refreshed on app bootstrap via the refresh cookie.
 * - Refresh token: httpOnly, Secure, SameSite=Lax cookie set by the Next.js
 *   route handler at /app/api/auth/route.ts. Never touched by client JS.
 *
 * Why not localStorage: an XSS in any dependency (markdown renderer, syntax
 * highlighter, a future plugin system) would otherwise be able to exfiltrate
 * the JWT directly. Given Atlas has per-repo ACLs and RBAC, that's not an
 * acceptable trade for the convenience of localStorage persistence.
 */

let accessToken: string | null = null;
let currentUserId: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setCurrentUserId(id: string | null) {
  currentUserId = id;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function clearSession() {
  accessToken = null;
  currentUserId = null;
}
