import { api, API_BASE } from "@/lib/api/client";
import { getAccessToken } from "@/lib/api/token-store";
import type { ChatRequest, ChatResponse, ChatStreamEvent, ConversationOut, ConversationsResponse, MessageOut } from "@/types/api";

// Direct backend URL for SSE streaming — bypasses the Next.js proxy which buffers responses.
// Falls back to the proxy path if the direct URL is not set.
const STREAM_BASE =
  process.env.NEXT_PUBLIC_STREAM_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "/api/backend";

export const chatApi = {
  send: (data: ChatRequest) => api.post<ChatResponse>("/chat/message", data),

  listConversations: (limit = 15, offset = 0) => 
    api.get<ConversationsResponse>(`/chat/conversations?limit=${limit}&offset=${offset}`),

  createConversation: (repoId?: string) =>
    api.post<ConversationOut>("/chat/conversations", { repo_id: repoId }),

  getMessages: (conversationId: string) =>
    api.get<MessageOut[]>(`/chat/conversations/${conversationId}/messages`),
  
  updateConversationTitle: (conversationId: string, title: string) =>
    api.patch<{ id: string; title: string }>(`/chat/conversations/${conversationId}`, { title }),
  
  deleteConversation: (conversationId: string) =>
    api.delete<{ id: string; deleted: boolean }>(`/chat/conversations/${conversationId}`),
  
  pinConversation: (conversationId: string) =>
    api.post<{ id: string; is_pinned: boolean }>(`/chat/conversations/${conversationId}/pin`, {}),
  
  unpinConversation: (conversationId: string) =>
    api.delete<{ id: string; is_pinned: boolean }>(`/chat/conversations/${conversationId}/pin`),

  truncateMessagesFrom: (conversationId: string, messageId: string) =>
    api.delete<{ deleted_from: string }>(`/chat/conversations/${conversationId}/messages/from/${messageId}`),

  deleteMessage: (conversationId: string, messageId: string) =>
    api.delete<{ deleted: string }>(`/chat/conversations/${conversationId}/messages/${messageId}`),
};

/**
 * Streams a chat response via SSE.
 *
 * Uses a raw fetch + ReadableStream reader rather than EventSource because:
 *   1. EventSource cannot send a POST body
 *   2. EventSource cannot attach Authorization headers
 *   3. No AbortController support in EventSource
 *
 * Hits STREAM_BASE directly (bypassing the Next.js proxy) to avoid
 * response buffering — the proxy collects the full response before
 * forwarding, which defeats streaming entirely.
 */
export function streamChatMessage(
  payload: ChatRequest,
  onEvent: (event: ChatStreamEvent) => void,
  onError: (error: Error) => void,
  onComplete: () => void,
  files?: File[],
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const token = getAccessToken();
      let response: Response;

      if (files && files.length > 0) {
        // File-augmented request (images and/or documents) — multipart/form-data
        const images = files.filter((f) => f.type.startsWith("image/"));
        const documents = files.filter((f) => !f.type.startsWith("image/"));

        const formData = new FormData();
        formData.append("message", payload.message);
        if (payload.conversation_id) formData.append("conversation_id", payload.conversation_id);
        if (payload.repo_id) formData.append("repo_id", payload.repo_id);
        formData.append("agent_mode", payload.agent_mode || "auto");
        images.forEach((img) => formData.append("images", img));
        documents.forEach((doc) => formData.append("documents", doc));

        response = await fetch(`${STREAM_BASE}/chat/stream/vision`, {
          method: "POST",
          headers: {
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
          signal: controller.signal,
        });
      } else {
        // Standard text request — JSON
        response = await fetch(`${STREAM_BASE}/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      }

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`Stream request failed: ${response.status} — ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by double newline.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;

          const jsonStr = line.slice("data:".length).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr) as ChatStreamEvent;
            onEvent(parsed);
          } catch {
            continue;
          }
        }
      }

      onComplete();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        onComplete();
        return;
      }
      onError(err instanceof Error ? err : new Error("Unknown streaming error"));
    }
  })();

  return controller;
}
