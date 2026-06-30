import { NextRequest, NextResponse } from "next/server";

/**
 * BFF route handler for refresh-token persistence.
 *
 * The refresh token NEVER touches client-side JS. The login flow
 * (lib/hooks/use-auth.ts) POSTs the token here right after a successful
 * /auth/login call, and this handler sets it as an httpOnly, Secure,
 * SameSite=Lax cookie. The access token stays in memory only
 * (lib/api/token-store.ts) and is re-derived from this cookie via
 * /api/auth/refresh on app bootstrap / hard refresh.
 */

const COOKIE_NAME = "atlas_refresh_token";

export async function POST(req: NextRequest) {
  const { refreshToken } = (await req.json()) as { refreshToken: string };

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days — matches backend refresh token TTL
  });
  return response;
}

/**
 * Get the current refresh token from the cookie.
 * Used by the refresh endpoint to read the existing token.
 */
export async function GET(req: NextRequest) {
  const refreshToken = req.cookies.get(COOKIE_NAME)?.value;
  
  if (!refreshToken) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  
  return NextResponse.json({ refreshToken });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}

export { COOKIE_NAME };
