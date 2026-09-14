import { getAccessToken } from "@/lib/api/token-store";
import { libraryApi } from "@/lib/api/library";
import { workspaceApi } from "@/lib/api/workspace";
import type { ViewerResource } from "@/lib/stores/viewer-store";
import type { FilePreview, LibraryKind } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";

/** Chat and Library files are served by /library; workspace files by the workspace. */
function libraryKind(r: ViewerResource): LibraryKind | null {
  if (r.kind === "chat_document") return "document";
  if (r.kind === "chat_image") return "image";
  if (r.kind === "artifact" && !r.workspaceId) return "created";
  return null;
}

async function authedFetch(path: string): Promise<Response> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = "";
    try {
      const body = await res.json();
      message = typeof body.detail === "string" ? body.detail : body.detail?.message ?? "";
    } catch {
      /* not JSON */
    }
    throw new Error(message || `Could not load (${res.status})`);
  }
  return res;
}

/** Everything the in-app viewer loads, whichever part of the app the file lives in. */
export const viewerApi = {
  /** The file itself, as a blob URL — for PDFs, images and text. */
  content: async (r: ViewerResource): Promise<{ blobUrl: string; mime: string; text: string | null }> => {
    const kind = libraryKind(r);
    if (!kind) {
      return workspaceApi.fetchViewable(r.kind as "document" | "artifact", r.id, r.workspaceId ?? "");
    }
    const res = await authedFetch(`/library/${kind}/${encodeURIComponent(r.id)}/file`);
    const blob = await res.blob();
    const mime = res.headers.get("content-type")?.split(";")[0] || blob.type || "application/octet-stream";
    const textLike = /^(text\/|application\/(json|xml)|.*markdown|.*html)/i.test(mime);
    return { blobUrl: URL.createObjectURL(blob), mime, text: textLike ? await blob.text() : null };
  },

  /** A spreadsheet as a grid, a Word file as paragraphs — read on the server. */
  preview: async (r: ViewerResource): Promise<FilePreview> => {
    const id = encodeURIComponent(r.id);
    const path = r.kind === "document"
      ? `/documents/${id}/preview`
      : `/library/${libraryKind(r) ?? "created"}/${id}/preview`;
    return (await authedFetch(path)).json();
  },

  /** Somewhere to save the file from. `revoke` says to release the URL afterwards. */
  download: async (r: ViewerResource): Promise<{ url: string; filename: string; revoke: boolean }> => {
    const kind = libraryKind(r);
    if (kind) return libraryApi.downloadById(kind, r.id, r.filename);
    const { url, filename } = r.kind === "artifact"
      ? await workspaceApi.downloadArtifact(r.id)
      : await workspaceApi.documentUrl(r.id);
    return { url, filename: filename || r.filename, revoke: false };
  },
};
