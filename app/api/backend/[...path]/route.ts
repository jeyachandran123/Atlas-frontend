/**
 * Catch-all proxy: /api/backend/[...path] → FastAPI /api/v1/[...path]
 * Handles ALL HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD).
 */

import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.ATLAS_BACKEND_URL ?? "http://127.0.0.1:8000";

const NO_BODY_METHODS = new Set(["GET", "HEAD", "DELETE", "OPTIONS"]);

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const search = req.nextUrl.search ?? "";
  const url = `${BACKEND}/api/v1/${path.join("/")}${search}`;

  // Forward headers, strip hop-by-hop
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "host" || k === "connection" || k === "transfer-encoding") return;
    headers.set(key, value);
  });

  const hasBody = !NO_BODY_METHODS.has(req.method);
  let body: BodyInit | null = null;
  if (hasBody) {
    // Raw bytes, never text — decoding multipart bodies as UTF-8 corrupts
    // binary uploads (JPEG/PDF/DOCX), which then fail magic-byte validation.
    const buf = await req.arrayBuffer();
    body = buf.byteLength > 0 ? buf : null;
  }

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body: body ?? undefined,
  });

  const resHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "transfer-encoding") return;
    resHeaders.set(key, value);
  });

  // 204 No Content — no body
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204, headers: resHeaders });
  }

  const resBody = await upstream.arrayBuffer();
  return new NextResponse(resBody, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export const GET     = proxy;
export const POST    = proxy;
export const PUT     = proxy;
export const PATCH   = proxy;
export const DELETE  = proxy;
export const OPTIONS = proxy;
export const HEAD    = proxy;
