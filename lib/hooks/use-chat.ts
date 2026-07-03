import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { chatApi, streamChatMessage } from "@/lib/api/chat";
import { useChatStore } from "@/lib/stores/chat-store";
import type { ChatRequest, MessageOut } from "@/types/api";

export const chatKeys = {
  conversations: (limit?: number, offset?: number) => 
    ["conversations", { limit, offset }] as const,
  messages: (conversationId: string) => ["conversations", conversationId, "messages"] as const,
};

export function useConversations(limit = 15, offset = 0) {
  return useQuery({
    queryKey: chatKeys.conversations(limit, offset),
    queryFn: () => chatApi.listConversations(limit, offset),
  });
}

export function useUpdateConversationTitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, title }: { conversationId: string; title: string }) =>
      chatApi.updateConversationTitle(conversationId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const { activeConversationId, setActiveConversation } = useChatStore();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.deleteConversation(conversationId),
    onSuccess: (_, conversationId) => {
      // Clear active conversation if it was deleted
      if (activeConversationId === conversationId) {
        setActiveConversation(null);
      }
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function usePinConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.pinConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useUnpinConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.unpinConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: chatKeys.messages(conversationId ?? ""),
    queryFn: () => chatApi.getMessages(conversationId as string),
    enabled: !!conversationId,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repoId?: string) => chatApi.createConversation(repoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

/**
 * Drives a streaming chat turn end-to-end:
 *  1. Optimistically appends the user message to the TanStack Query cache AND Zustand store
 *  2. Opens the SSE stream, routing every event into the Zustand chat store
 *     (so token-by-token UI updates skip TanStack Query's revalidation cost)
 *  3. On completion, invalidates the messages query so the persisted
 *     assistant message (with its real id/tokens/latency) replaces the
 *     locally-streamed text
 */
export function useStreamChat() {
  const queryClient = useQueryClient();
  const { startStream, applyStreamEvent, endStream, activeConversationId, setActiveConversation } =
    useChatStore();
  const controllerRef = useRef<AbortController | null>(null);

  const send = useCallback(
    (message: string, repoId?: string, agentMode: string = "auto") => {
      const conversationId = activeConversationId ?? undefined;

      // Always create optimistic user message immediately
      const optimisticUserMessage: MessageOut = {
        id: `optimistic-user-${Date.now()}`,
        conversation_id: conversationId ?? "",
        role: "user",
        content: message,
        agent_used: null,
        tokens_used: 0,
        created_at: new Date().toISOString(),
      };

      // Add to cache if conversation exists
      if (conversationId) {
        queryClient.setQueryData<MessageOut[]>(chatKeys.messages(conversationId), (old = []) => [
          ...old,
          optimisticUserMessage,
        ]);
      }

      const payload: ChatRequest = {
        message,
        conversation_id: conversationId,
        repo_id: repoId,
        agent_mode: agentMode as "auto" | "code" | "business",
      };

      const controller = streamChatMessage(
        payload,
        (event) => {
          applyStreamEvent(event);
          if (event.type === "done") {
            // Set active conversation if this was the first message
            if (!activeConversationId && event.conversation_id) {
              setActiveConversation(event.conversation_id);
            }
            // Invalidate queries to fetch the persisted messages
            const finalConvId = event.conversation_id || activeConversationId;
            if (finalConvId) {
              queryClient.invalidateQueries({
                queryKey: chatKeys.messages(finalConvId),
              });
            }
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          }
        },
        (error) => {
          applyStreamEvent({ type: "error", message: error.message });
          endStream();
        },
        () => endStream(),
      );

      controllerRef.current = controller;
      // Pass the optimistic user message to startStream
      startStream(controller, optimisticUserMessage);
    },
    [activeConversationId, applyStreamEvent, endStream, queryClient, setActiveConversation, startStream],
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { send, stop };
}
