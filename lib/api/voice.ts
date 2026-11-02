import { API_BASE, api } from "@/lib/api/client";
import { getAccessToken } from "@/lib/api/token-store";
import type { VoiceConfig, VoiceSessionOut, VoiceTurn } from "@/types/api";

export const voiceApi = {
  config: () => api.get<VoiceConfig>("/chat/voice/config"),

  session: (conversationId: string | null, resumeHandle?: string) =>
    api.post<VoiceSessionOut>("/chat/voice/session", {
      conversation_id: conversationId,
      resume_handle: resumeHandle ?? null,
    }),

  saveTurns: (conversationId: string, turns: VoiceTurn[]) =>
    api.post<{ conversation_id: string; saved: number }>("/chat/voice/turns", {
      conversation_id: conversationId,
      turns,
    }),

  /** For a closing tab: `keepalive` lets the request outlive the page. */
  saveTurnsOnExit(conversationId: string, turns: VoiceTurn[]): void {
    const token = getAccessToken();
    void fetch(`${API_BASE}/chat/voice/turns`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ conversation_id: conversationId, turns }),
    }).catch(() => undefined);
  },
};
