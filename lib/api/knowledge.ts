import { api, API_BASE } from "@/lib/api/client";
import { getAccessToken } from "@/lib/api/token-store";
import type {
  AskStreamEvent,
  DipDocumentList,
  DipUploadResponse,
  GenerateStreamEvent,
  GenerationArtifact,
  GenerationDownload,
  KnowledgeConversation,
  ProcessingState,
  SemanticManifest,
  TurnHistory,
} from "@/types/knowledge";

// Same direct-URL rationale as chat.ts: the Next proxy buffers SSE.
const STREAM_BASE =
  process.env.NEXT_PUBLIC_STREAM_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "/api/backend";

export const knowledgeApi = {
  // ── Documents ──────────────────────────────────────────────────────────────
  listDocuments: (limit = 50, offset = 0) =>
    api.get<DipDocumentList>(`/documents?limit=${limit}&offset=${offset}`),

  uploadDocument: async (file: File): Promise<DipUploadResponse> => {
    const token = getAccessToken();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail ?? body.message ?? `Upload failed (${res.status})`);
    }
    return res.json();
  },

  processingState: (documentId: string) =>
    api.get<ProcessingState>(`/documents/${documentId}/processing`),

  semanticState: (documentId: string) =>
    api.get<SemanticManifest>(`/documents/${documentId}/semantic`),

  deleteDocument: (documentId: string) =>
    api.delete<{ deleted: boolean }>(`/documents/${documentId}`),

  // ── Knowledge conversations ────────────────────────────────────────────────
  createConversation: (title = "") =>
    api.post<KnowledgeConversation>("/conversations", { title }),

  listConversations: () => api.get<KnowledgeConversation[]>("/conversations"),

  listTurns: (conversationId: string) =>
    api.get<TurnHistory[]>(`/conversations/${conversationId}/turns`),

  // ── Generations ────────────────────────────────────────────────────────────
  listGenerations: () => api.get<GenerationArtifact[]>("/generations"),

  supportedFormats: () => api.get<{ formats: string[] }>("/generations/formats"),

  /** Resolve the artifact to a browser-openable URL (signed S3 URL, or a
   *  blob URL from proxied bytes when the backend can't sign). */
  downloadUrl: async (artifactId: string): Promise<{ url: string; filename: string }> => {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE}/generations/${artifactId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const info = (await res.json()) as GenerationDownload;
      if (info.mode === "signed_url" && info.url) return { url: info.url, filename: info.filename };
      throw new Error("Download unavailable");
    }
    const blob = await res.blob();
    const dispo = res.headers.get("content-disposition") ?? "";
    const filename = /filename="([^"]+)"/.exec(dispo)?.[1] ?? "artifact";
    return { url: URL.createObjectURL(blob), filename };
  },
};

/**
 * Parses a named-event SSE stream ("event: X\ndata: {json}\n\n") — the DIP
 * backends emit named events, unlike the legacy chat stream which is
 * data-only, so this parser tracks the current event name per frame.
 */
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

export function streamAsk(
  conversationId: string,
  question: string,
  documentId: string | null,
  onEvent: (e: AskStreamEvent) => void,
  onError: (err: Error) => void,
  onComplete: () => void,
): AbortController {
  const controller = new AbortController();
  void streamNamedSSE<AskStreamEvent>(
    `/conversations/${conversationId}/ask/stream`,
    { question, document_id: documentId },
    onEvent, onError, onComplete, controller.signal,
  );
  return controller;
}

export function streamGenerate(
  prompt: string,
  format: string,
  documentId: string | null,
  onEvent: (e: GenerateStreamEvent) => void,
  onError: (err: Error) => void,
  onComplete: () => void,
): AbortController {
  const controller = new AbortController();
  void streamNamedSSE<GenerateStreamEvent>(
    "/generations/stream",
    { prompt, format, document_id: documentId },
    onEvent, onError, onComplete, controller.signal,
  );
  return controller;
}
