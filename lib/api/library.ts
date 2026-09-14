import { api } from "@/lib/api/client";
import { getAccessToken } from "@/lib/api/token-store";
import type { LibraryItem, LibraryKind, LibraryPage } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** The bytes through the API — for storage that cannot hand out signed links. */
async function fileBlobUrl(item: Pick<LibraryItem, "kind" | "id">): Promise<string> {
  const res = await fetch(`${API_BASE}/library/${item.kind}/${encodeURIComponent(item.id)}/file`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Could not load the file (${res.status})`);
  return URL.createObjectURL(await res.blob());
}

export const libraryApi = {
  list: (params: { kind?: LibraryKind; q?: string; limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params.kind) search.set("kind", params.kind);
    if (params.q) search.set("q", params.q);
    search.set("limit", String(params.limit ?? 48));
    search.set("offset", String(params.offset ?? 0));
    return api.get<LibraryPage>(`/library?${search.toString()}`);
  },

  /**
   * Somewhere the browser can save the file from: a signed S3 link straight
   * from the bucket, or — when storage cannot sign — an object URL of the
   * bytes (`revoke` says to release it afterwards).
   */
  download: async (item: LibraryItem): Promise<{ url: string; filename: string; revoke: boolean }> => {
    const res = await fetch(`${API_BASE}/library/${item.kind}/${encodeURIComponent(item.id)}/download`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const info = (await res.json()) as { mode: string; url?: string | null; filename: string };
    if (info.mode === "signed_url" && info.url) return { url: info.url, filename: info.filename, revoke: false };
    return { url: await fileBlobUrl(item), filename: info.filename || item.filename, revoke: true };
  },

  /** An image preview when there is no signed link to use. */
  imageBlobUrl: (imageId: string) => fileBlobUrl({ kind: "image", id: imageId }),
};
