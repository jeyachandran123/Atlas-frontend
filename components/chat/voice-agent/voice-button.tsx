"use client";

import { useQuery } from "@tanstack/react-query";
import { AudioLines } from "lucide-react";
import { useCallback } from "react";
import { voiceApi } from "@/lib/api/voice";
import { useChatStore } from "@/lib/stores/chat-store";
import { startVoiceSession } from "@/lib/voice/session";

/** Voice is hidden when the deployment has no key, never shown broken. */
export function useVoiceConfig() {
  return useQuery({
    queryKey: ["voice", "config"],
    queryFn: voiceApi.config,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** The blue button. It sits where Send sits, while there is nothing to send. */
export function VoiceAgentButton({ disabled }: { disabled?: boolean }) {
  const { data: config } = useVoiceConfig();

  const start = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!config?.enabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    void startVoiceSession(useChatStore.getState().activeConversationId, config, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }, [config]);

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      aria-label="Talk to Atlas"
      title="Talk to Atlas"
      className="voice-agent-btn flex size-8 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-25"
    >
      <AudioLines className="size-4" />
    </button>
  );
}
