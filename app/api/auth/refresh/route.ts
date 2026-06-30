import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.ATLAS_BACKEND_URL || "http://127.0.0.1:8000";
const COOKIE_NAME = "atlas_refresh_token";

/**
 * Called once on app bootstrap (see app/(dashboard)/layout.tsx) to silently
 * re-establish a session after a hard refresh, using the httpOnly cookie
 * the browser sends automatically — no client JS ever reads the refresh
 * token itself.
 * 
 * This also updates the refresh token in the cookie (token rotation) to
 * extend the session for another 7 days, allowing users to stay logged in
 * for weeks as long as they use the app at least once per week.
 */
export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(COOKIE_NAME)?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const backendRes = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!backendRes.ok) {
    const response = NextResponse.json({ error: "Session expired" }, { status: 401 });
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  const data = await backendRes.json();
  
  // Store the new refresh token (backend rotates tokens on each refresh)
  const response = NextResponse.json({ access_token: data.access_token });
  
  if (data.refresh_token) {
    response.cookies.set(COOKIE_NAME, data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }
  
  return response;
}
