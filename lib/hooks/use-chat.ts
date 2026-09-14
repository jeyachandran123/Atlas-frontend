import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { chatApi, streamChatMessage } from "@/lib/api/chat";
import { useChatStore } from "@/lib/stores/chat-store";
import type { ChatRequest, MessageOut, AgentMode } from "@/types/api";

export const chatKeys = {
  conversations: (limit?: number, offset?: number) =>
    ["conversations", { limit, offset }] as const,
  conversationsInfinite: (limit: number) => ["conversations", "infinite", { limit }] as const,
  messages: (conversationId: string) => ["conversations", conversationId, "messages"] as const,
};

/** One page of conversations — for callers that only need the most recent. */
export function useConversations(limit = 15, offset = 0) {
  return useQuery({
    queryKey: chatKeys.conversations(limit, offset),
    queryFn: () => chatApi.listConversations(limit, offset),
  });
}

/**
 * Every conversation, loaded a page at a time and kept.
 *
 * The sidebar used to pass a growing offset to ``useConversations``, which is a
 * different query per offset — so scrolling to the end swapped the whole list
 * for the next page. Today and the previous week vanished and there was nothing
 * above to scroll back to. Here pages accumulate, and an invalidation (a new
 * chat, a rename, a pin) refetches every page already loaded, in order.
 */
export function useInfiniteConversations(limit = 20) {
  return useInfiniteQuery({
    queryKey: chatKeys.conversationsInfinite(limit),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => chatApi.listConversations(limit, pageParam),
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      const next = lastPageParam + limit;
      return next < lastPage.total ? next : undefined;
    },
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
  const {
    startStream, applyStreamEvent, endStream, activeConversationId, setActiveConversation,
    addMessageImages, adoptStreamConversation, transferMessageImages,
  } = useChatStore();
  const controllerRef = useRef<AbortController | null>(null);
  /** Temporary message id → the id the server saved it under. */
  const realIdsRef = useRef(new Map<string, string>());

  const send = useCallback(
    (message: string, repoId?: string, agentMode: string = "auto", files?: File[]) => {
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

      const imageFiles = (files ?? []).filter((f) => f.type.startsWith("image/"));
      const docFiles = (files ?? []).filter((f) => !f.type.startsWith("image/"));

      // Documents render as file chips — no preview URL needed
      const docChips = docFiles.map((file) => ({
        id: `doc-${file.name}-${Date.now()}-${Math.random()}`,
        url: "",
        name: file.name,
        conversationId: conversationId,
        timestamp: Date.now(),
        isDocument: true,
      }));

      // Store image previews as data URLs BEFORE adding optimistic message
      // so they're available when the component renders
      if (imageFiles.length > 0 || docChips.length > 0) {
        if (imageFiles.length > 0) {
          const previews: Array<{ id: string; url: string; name: string; conversationId?: string; timestamp?: number; isDocument?: boolean }> = [...docChips];
          let loaded = 0;
          const totalImages = imageFiles.length;
          imageFiles.forEach((file) => {
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
        }
        // Also store immediately (object URLs for images, chips for documents)
        const instantPreviews = [
          ...imageFiles.map((file) => ({
            id: `instant-${file.name}-${Date.now()}-${Math.random()}`,
            url: URL.createObjectURL(file),
            name: file.name,
            conversationId: conversationId,
            timestamp: Date.now(),
          })),
          ...docChips,
        ];
        addMessageImages(optimisticUserMessage.id, instantPreviews);
      }

      if (conversationId) {
        queryClient.setQueryData<MessageOut[]>(chatKeys.messages(conversationId), (old = []) => [
          ...old,
          optimisticUserMessage,
        ]);
      }

      // Read at send time, not captured at render: the toggle may have
      // changed since this callback was created.
      const thinking = useChatStore.getState().thinking;

      const payload: ChatRequest = {
        message,
        conversation_id: conversationId,
        repo_id: repoId,
        agent_mode: agentMode as AgentMode,
        ...(thinking === null ? {} : { thinking }),
      };

      const controller = streamChatMessage(
        payload,
        (event) => {
          if (event.type === "meta") {
            // The server has saved the prompt. Swap the temporary id for the
            // real one now, so edit / retry / delete act on the saved message
            // even when this reply is stopped before it finishes.
            const realId = event.user_message_id;
            const convId = event.conversation_id;
            realIdsRef.current.set(optimisticUserMessage.id, realId);
            if (!conversationId && convId) {
              adoptStreamConversation(convId);
              if (typeof window !== "undefined" && window.location.pathname === "/chat") {
                window.history.replaceState(null, "", `/chat/${convId}`);
              }
            }
            queryClient.setQueryData<MessageOut[]>(chatKeys.messages(convId), (old) =>
              old?.map((m) =>
                m.id === optimisticUserMessage.id ? { ...m, id: realId, conversation_id: convId } : m,
              ),
            );
            transferMessageImages(optimisticUserMessage.id, realId);
            return;
          }
          if (event.type === "done" || event.type === "error") {
            // Adopt the conversation even on error — the backend has already
            // created it and saved the user message. Without this, every
            // failed send would spawn a brand-new conversation.
            // (Runs BEFORE applyStreamEvent: setActiveConversation resets
            // streamError, which would otherwise hide the error banner.)
            // Already adopted when the turn's meta event arrived — adopting
            // again would clear the reply that was just streamed.
            if (
              !activeConversationId && event.conversation_id
              && useChatStore.getState().activeConversationId !== event.conversation_id
            ) {
              setActiveConversation(event.conversation_id);
              // ChatGPT-style URL adoption: swap /chat → /chat/{id} in place.
              // history.replaceState avoids a route remount, so the streamed
              // content and scroll position are untouched; a refresh or a
              // shared link then lands on the canonical conversation route.
              if (typeof window !== "undefined" && window.location.pathname === "/chat") {
                window.history.replaceState(null, "", `/chat/${event.conversation_id}`);
              }
            }
            const finalConvId = event.conversation_id || activeConversationId;
            if (finalConvId) {
              queryClient.invalidateQueries({ queryKey: chatKeys.messages(finalConvId) });
            }
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            // Uploads and created files belong in the Library as soon as they exist.
            queryClient.invalidateQueries({ queryKey: ["library"] });
          }
          applyStreamEvent(event);
        },
        (error) => {
          applyStreamEvent({ type: "error", message: error.message });
          endStream();
        },
        () => endStream(),
        files,
      );

      controllerRef.current = controller;
      startStream(controller, optimisticUserMessage, conversationId ?? null);
    },
    [
      activeConversationId, applyStreamEvent, endStream, queryClient, setActiveConversation,
      startStream, addMessageImages, adoptStreamConversation, transferMessageImages,
    ],
  );

  /**
   * The saved id of a message the list may still hold under its temporary one.
   *
   * A stopped reply never reaches "done", so its prompt can stay in the list as
   * `optimistic-…` although the server saved it. Acting on that temporary id
   * used to skip the server entirely: the saved prompt survived an edit and
   * showed up twice. The meta event normally supplies the real id; when the
   * stop came even before that, the saved prompt is found by its text.
   * null means nothing was saved.
   */
  const savedId = useCallback(
    async (conversationId: string, messageId: string, content?: string): Promise<string | null> => {
      if (!messageId.startsWith("optimistic-")) return messageId;
      const known = realIdsRef.current.get(messageId);
      if (known) return known;
      const text = content
        ?? queryClient.getQueryData<MessageOut[]>(chatKeys.messages(conversationId))
          ?.find((m) => m.id === messageId)?.content
        ?? useChatStore.getState().optimisticUserMessage?.content;
      if (!text) return null;
      try {
        const saved = await chatApi.getMessages(conversationId);
        return [...saved].reverse().find((m) => m.role === "user" && m.content === text)?.id ?? null;
      } catch {
        return null;
      }
    },
    [queryClient],
  );

  /** Remove a message and everything after it — on the server and in the list. */
  const truncateFrom = useCallback(
    async (conversationId: string, messageId: string, content?: string) => {
      const id = await savedId(conversationId, messageId, content);
      if (id) await chatApi.truncateMessagesFrom(conversationId, id);
      queryClient.setQueryData<MessageOut[]>(chatKeys.messages(conversationId), (old = []) => {
        const idx = old.findIndex((m) => m.id === messageId || m.id === id);
        return idx === -1 ? old : old.slice(0, idx);
      });
    },
    [queryClient, savedId],
  );

  /**
   * Edit: truncate the conversation from the given message onwards,
   * then re-send with the new text. The old message disappears.
   */
  const editAndResend = useCallback(
    async (messageId: string, newText: string, repoId?: string) => {
      const conversationId = activeConversationId;
      if (!conversationId) return;
      await truncateFrom(conversationId, messageId);
      send(newText, repoId, "auto");
    },
    [activeConversationId, send, truncateFrom],
  );

  const retry = useCallback(
    async (messageId: string, content: string, repoId?: string) => {
      const conversationId = activeConversationId;
      if (!conversationId) return;
      await truncateFrom(conversationId, messageId, content);
      send(content, repoId, "auto");
    },
    [activeConversationId, send, truncateFrom],
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    // The prompt was saved before the reply began: bring the list in line with
    // the server, so the stopped prompt carries its real id from here on.
    const convId = useChatStore.getState().activeConversationId;
    if (convId) void queryClient.invalidateQueries({ queryKey: chatKeys.messages(convId) });
  }, [queryClient]);

  const deleteMessage = useCallback(
    async (messageId: string) => {
      const conversationId = activeConversationId;
      if (!conversationId) return;
      // Truncating removes the user message and its reply together
      await truncateFrom(conversationId, messageId);
    },
    [activeConversationId, truncateFrom],
  );

  return { send, editAndResend, retry, deleteMessage, stop };
}
