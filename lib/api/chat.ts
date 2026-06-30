import { api, API_BASE } from "@/lib/api/client";
import { getAccessToken } from "@/lib/api/token-store";
import type { ChatRequest, ChatResponse, ChatStreamEvent, ConversationOut, ConversationsResponse, MessageOut } from "@/types/api";

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
};

/**
 * Streams a chat response via SSE.
 *
 * The backend emits raw `text/event-stream` lines:
 *   data: {"type": "token", "content": "..."}
 *   data: {"type": "done", "conversation_id": "...", "tokens_used": 42}
 *   data: {"type": "error", "message": "..."}
 *
 * We use a raw fetch + ReadableStream reader rather than the native
 * EventSource API because EventSource:
 *   1. Cannot send a POST body (we need to send the ChatRequest payload)
 *   2. Cannot attach custom Authorization headers
 *   3. Has no built-in AbortController-based cancellation
 *
 * `onEvent` is called for every parsed SSE event. Returns an AbortController
 * so the caller can cancel mid-stream (stop button, navigation away, unmount).
 */
export function streamChatMessage(
  payload: ChatRequest,
  onEvent: (event: ChatStreamEvent) => void,
  onError: (error: Error) => void,
  onComplete: () => void,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const token = getAccessToken();
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line; each frame may contain
        // multiple "data: ..." lines, but our backend emits one per frame.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? ""; // last (possibly incomplete) frame stays buffered

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;

          const jsonStr = line.slice("data:".length).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr) as ChatStreamEvent;
            onEvent(parsed);
          } catch {
            // Malformed frame — skip rather than crash the whole stream
            continue;
          }
        }
      }

      onComplete();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Intentional cancellation — not an error condition
        onComplete();
        return;
      }
      onError(err instanceof Error ? err : new Error("Unknown streaming error"));
    }
  })();

  return controller;
}
