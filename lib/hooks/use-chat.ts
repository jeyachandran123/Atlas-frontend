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
  const { startStream, applyStreamEvent, endStream, activeConversationId, setActiveConversation, addMessageImages } =
    useChatStore();
  const controllerRef = useRef<AbortController | null>(null);

  const send = useCallback(
    (message: string, repoId?: string, agentMode: string = "auto", images?: File[]) => {
      const conversationId = activeConversationId ?? undefined;

      const optimisticUserMessage: MessageOut = {
        id: `optimistic-user-${Date.now()}`,
        conversation_id: conversationId ?? "",
        role: "user",
        content: message,
        agent_used: null,
        tokens_used: 0,
        created_at: new Date().toISOString(),
      };

      // Store image previews as data URLs BEFORE adding optimistic message
      // so they're available when the component renders
      if (images && images.length > 0) {
        const previews: Array<{ id: string; url: string; name: string; conversationId?: string; timestamp?: number }> = [];
        let loaded = 0;
        const totalImages = images.length;
        images.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            previews.push({
              id: `${file.name}-${Date.now()}-${Math.random()}`,
              url: ev.target?.result as string,
              name: file.name,
              conversationId: conversationId,
              timestamp: Date.now(),
            });
            loaded++;
            if (loaded === totalImages) {
              addMessageImages(optimisticUserMessage.id, previews);
            }
          };
          reader.readAsDataURL(file);
        });
        // Also store immediately with object URLs as instant fallback
        const instantPreviews = images.map((file) => ({
          id: `instant-${file.name}-${Date.now()}-${Math.random()}`,
          url: URL.createObjectURL(file),
          name: file.name,
          conversationId: conversationId,
          timestamp: Date.now(),
        }));
        addMessageImages(optimisticUserMessage.id, instantPreviews);
      }

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
            if (!activeConversationId && event.conversation_id) {
              setActiveConversation(event.conversation_id);
            }
            const finalConvId = event.conversation_id || activeConversationId;
            if (finalConvId) {
              queryClient.invalidateQueries({ queryKey: chatKeys.messages(finalConvId) });
            }
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          }
        },
        (error) => {
          applyStreamEvent({ type: "error", message: error.message });
          endStream();
        },
        () => endStream(),
        images,
      );

      controllerRef.current = controller;
      startStream(controller, optimisticUserMessage, conversationId ?? null);
    },
    [activeConversationId, applyStreamEvent, endStream, queryClient, setActiveConversation, startStream, addMessageImages],
  );

  /**
   * Edit: truncate the conversation from the given message onwards,
   * then re-send with the new text. The old message disappears.
   */
  const editAndResend = useCallback(
    async (messageId: string, newText: string, repoId?: string) => {
      const conversationId = activeConversationId;
      if (!conversationId) return;

      const isOptimistic = messageId.startsWith("optimistic-");

      if (!isOptimistic) {
        // Real DB message — truncate from this point
        await chatApi.truncateMessagesFrom(conversationId, messageId);
      }

      // Remove from local cache from this message onwards
      queryClient.setQueryData<MessageOut[]>(chatKeys.messages(conversationId), (old = []) => {
        const idx = old.findIndex((m) => m.id === messageId);
        return idx === -1 ? old : old.slice(0, idx);
      });

      send(newText, repoId, "auto");
    },
    [activeConversationId, queryClient, send],
  );

  const retry = useCallback(
    async (messageId: string, content: string, repoId?: string) => {
      const conversationId = activeConversationId;
      if (!conversationId) return;

      const isOptimistic = messageId.startsWith("optimistic-");

      if (!isOptimistic) {
        await chatApi.truncateMessagesFrom(conversationId, messageId);
      }

      queryClient.setQueryData<MessageOut[]>(chatKeys.messages(conversationId), (old = []) => {
        const idx = old.findIndex((m) => m.id === messageId);
        return idx === -1 ? old : old.slice(0, idx);
      });

      send(content, repoId, "auto");
    },
    [activeConversationId, queryClient, send],
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const deleteMessage = useCallback(
    async (messageId: string) => {
      const conversationId = activeConversationId;
      if (!conversationId) return;
      // Use truncateMessagesFrom so the user message + its assistant reply are both deleted
      await chatApi.truncateMessagesFrom(conversationId, messageId);
      queryClient.setQueryData<MessageOut[]>(chatKeys.messages(conversationId), (old = []) => {
        const idx = old.findIndex((m) => m.id === messageId);
        return idx === -1 ? old : old.slice(0, idx);
      });
    },
    [activeConversationId, queryClient],
  );

  return { send, editAndResend, retry, deleteMessage, stop };
}
