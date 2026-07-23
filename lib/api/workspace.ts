import { api, API_BASE } from "@/lib/api/client";
import { getAccessToken } from "@/lib/api/token-store";
import { knowledgeApi } from "@/lib/api/knowledge";
import type {
  Bookmark,
  ConversationRestore,
  RelatedResults,
  TimelineEvent,
  Workspace,
  WorkspaceArtifact,
  WorkspaceAskEvent,
  WorkspaceConversation,
  WorkspaceDashboard,
  WorkspaceDocument,
  WorkspaceGenerateEvent,
  WorkspaceSearchResults,
} from "@/types/workspace";

const STREAM_BASE =
  process.env.NEXT_PUBLIC_STREAM_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "/api/backend";

export const workspaceApi = {
  // ── Workspaces ─────────────────────────────────────────────────────────────
  list: () => api.get<Workspace[]>("/workspaces"),
  create: (name: string, description = "", icon = "folder") =>
    api.post<Workspace>("/workspaces", { name, description, icon }),
  get: (id: string) => api.get<Workspace>(`/workspaces/${id}`),
  rename: (id: string, name: string) => api.patch<Workspace>(`/workspaces/${id}`, { name }),
  archive: (id: string) => api.delete<{ archived: boolean }>(`/workspaces/${id}`),

  dashboard: (id: string) => api.get<WorkspaceDashboard>(`/workspaces/${id}/dashboard`),
  refreshSummary: (id: string) =>
    api.post<{ summary: string; suggestions: string[] }>(`/workspaces/${id}/summary/refresh`),

  // ── Documents ──────────────────────────────────────────────────────────────
  documents: (id: string) => api.get<WorkspaceDocument[]>(`/workspaces/${id}/documents`),

  /**
   * Atomic workspace upload: one request uploads + links + optionally attaches
   * to a conversation. Replaces the old two-step (upload then link), which
   * caused the duplicate-context race. Throws an Error with a friendly message
   * on a per-workspace duplicate (409).
   */
  uploadDocument: async (
    workspaceId: string, file: File, conversationId?: string,
  ): Promise<{ document: WorkspaceDocument; attached: boolean }> => {
    const token = getAccessToken();
    const form = new FormData();
    form.append("file", file);
    const qs = conversationId ? `?conversation_id=${conversationId}` : "";
    const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/upload${qs}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body?.detail;
      const message =
        (typeof detail === "object" ? detail?.message : detail) ??
        `Upload failed (${res.status})`;
      throw new Error(message);
    }
    const data = await res.json();
    return { document: data.document, attached: data.attached_to_conversation };
  },

  /** Signed URL (or proxied blob URL) for the ORIGINAL uploaded document. */
  documentUrl: async (documentId: string): Promise<{ url: string; filename: string }> => {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE}/documents/${documentId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const info = await res.json();
      if (info.url) return { url: info.url, filename: info.filename ?? "document" };
      throw new Error("Download unavailable");
    }
    const blob = await res.blob();
    const dispo = res.headers.get("content-disposition") ?? "";
    const filename = /filename="([^"]+)"/.exec(dispo)?.[1] ?? "document";
    return { url: URL.createObjectURL(blob), filename };
  },

  /** Complete workspace-layer document deletion (purges vectors, embeddings,
   *  knowledge, links, bookmarks — no orphans). Replaces the frozen soft-delete. */
  deleteDocument: (workspaceId: string, documentId: string) =>
    api.delete<{ vectors_removed: number; bookmarks_removed: number }>(
      `/workspaces/${workspaceId}/documents/${documentId}`),

  /**
   * Fetch a document/artifact as an inline blob URL for the in-app viewer.
   * Served by the workspace *content* endpoints, which stream bytes inline
   * through the API (same origin). This deliberately avoids the download
   * endpoints' S3 signed URLs — the browser cannot fetch() those without
   * bucket CORS, which is exactly why the viewer failed to load. Same-origin
   * bytes have no CORS constraint. Returns text for text/markdown/html.
   */
  fetchViewable: async (
    kind: "document" | "artifact", id: string, workspaceId: string,
  ): Promise<{ blobUrl: string; mime: string; text: string | null }> => {
    const token = getAccessToken();
    const path = kind === "artifact"
      ? `/workspaces/${workspaceId}/artifacts/${id}/content`
      : `/workspaces/${workspaceId}/documents/${id}/content`;
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Could not load (${res.status})`);
    const blob = await res.blob();
    // The header content-type is authoritative here (blob.type mirrors it).
    const mime = res.headers.get("content-type")?.split(";")[0] || blob.type || "application/octet-stream";
    const textLike = /^(text\/|application\/(json|xml)|.*markdown|.*html)/i.test(mime);
    const text = textLike ? await blob.text() : null;
    return { blobUrl: URL.createObjectURL(blob), mime, text };
  },

  // ── Conversations ──────────────────────────────────────────────────────────
  conversations: (id: string) =>
    api.get<WorkspaceConversation[]>(`/workspaces/${id}/conversations`),
  startConversation: (id: string, title = "") =>
    api.post<{ conversation_id: string; title: string; correlation_id: string }>(
      `/workspaces/${id}/conversations`, { title }),
  restore: (id: string, conversationId: string) =>
    api.get<ConversationRestore>(`/workspaces/${id}/conversations/${conversationId}`),
  renameConversation: (id: string, conversationId: string, title: string) =>
    api.patch<{ title: string }>(`/workspaces/${id}/conversations/${conversationId}`, { title }),
  deleteConversation: (id: string, conversationId: string) =>
    api.delete<{ deleted: boolean }>(`/workspaces/${id}/conversations/${conversationId}`),
  detachDocument: (id: string, conversationId: string, documentId: string) =>
    api.delete<{ removed: boolean }>(
      `/workspaces/${id}/conversations/${conversationId}/documents/${documentId}`),
  saveAsKnowledge: (id: string, conversationId: string) =>
    api.post<{ document_id: string; duplicate_of: string | null }>(
      `/workspaces/${id}/conversations/${conversationId}/save-as-knowledge`),

  /**
   * Export a conversation. A plain <a href> can't carry the in-memory Bearer
   * token (browser navigation, no headers) — which is why exports 401'd.
   * Fetch with auth, then save the returned blob.
   */
  exportConversation: async (
    id: string, conversationId: string, format: string,
  ): Promise<void> => {
    const token = getAccessToken();
    const res = await fetch(
      `${API_BASE}/workspaces/${id}/conversations/${conversationId}/export?format=${format}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const dispo = res.headers.get("content-disposition") ?? "";
    const filename = /filename="([^"]+)"/.exec(dispo)?.[1] ?? `conversation.${format === "word" ? "docx" : format === "pdf" ? "pdf" : "md"}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // ── Artifacts / timeline / bookmarks ───────────────────────────────────────
  artifacts: (id: string) => api.get<WorkspaceArtifact[]>(`/workspaces/${id}/artifacts`),
  timeline: (id: string, limit = 100) =>
    api.get<TimelineEvent[]>(`/workspaces/${id}/timeline?limit=${limit}`),
  bookmarks: (id: string) => api.get<Bookmark[]>(`/workspaces/${id}/bookmarks`),
  addBookmark: (id: string, target_type: string, target_id: string, note?: string) =>
    api.post<Bookmark>(`/workspaces/${id}/bookmarks`, { target_type, target_id, note }),
  deleteBookmark: (id: string, bookmarkId: string) =>
    api.delete(`/workspaces/${id}/bookmarks/${bookmarkId}`),

  search: (id: string, q: string) =>
    api.get<{ query: string; results: WorkspaceSearchResults }>(
      `/workspaces/${id}/search?q=${encodeURIComponent(q)}`),
  related: (id: string, q: string, conversationId?: string) =>
    api.get<RelatedResults>(
      `/workspaces/${id}/related?q=${encodeURIComponent(q)}` +
      (conversationId ? `&conversation_id=${conversationId}` : "")),

  /** Download an artifact via the frozen generation download endpoint. */
  downloadArtifact: (artifactId: string) => knowledgeApi.downloadUrl(artifactId),
};

// ── Named-event SSE (shared parser, same as knowledge.ts) ──────────────────────
async function streamNamedSSE<E extends { event: string; data: unknown }>(
  path: string,
  body: unknown,
  onEvent: (e: E) => void,
  onError: (err: Error) => void,
  onComplete: () => void,
  signal: AbortSignal,
): Promise<void> {
  try {
    const token = getAccessToken();
    const res = await fetch(`${STREAM_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Stream failed: ${res.status} — ${text}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        let eventName = "";
        let dataStr = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataStr += line.slice(6);
        }
        if (!eventName || !dataStr) continue;
        try {
          onEvent({ event: eventName, data: JSON.parse(dataStr) } as E);
        } catch {
          /* skip malformed frame */
        }
      }
    }
    onComplete();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      onComplete();
      return;
    }
    onError(err instanceof Error ? err : new Error("Streaming error"));
  }
}

export function streamWorkspaceAsk(
  workspaceId: string,
  conversationId: string,
  question: string,
  documentIds: string[] | null,
  onEvent: (e: WorkspaceAskEvent) => void,
  onError: (err: Error) => void,
  onComplete: () => void,
): AbortController {
  const controller = new AbortController();
  void streamNamedSSE<WorkspaceAskEvent>(
    `/workspaces/${workspaceId}/conversations/${conversationId}/ask/stream`,
    { question, document_ids: documentIds },
    onEvent, onError, onComplete, controller.signal,
  );
  return controller;
}

export function streamWorkspaceGenerate(
  workspaceId: string,
  prompt: string,
  format: string,
  conversationId: string | null,
  onEvent: (e: WorkspaceGenerateEvent) => void,
  onError: (err: Error) => void,
  onComplete: () => void,
): AbortController {
  const controller = new AbortController();
  void streamNamedSSE<WorkspaceGenerateEvent>(
    `/workspaces/${workspaceId}/generate/stream`,
    { prompt, format, conversation_id: conversationId },
    onEvent, onError, onComplete, controller.signal,
  );
  return controller;
}
