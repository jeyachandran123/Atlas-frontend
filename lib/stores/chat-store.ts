import { create } from "zustand";
import type { ChatStreamEvent, MessageOut } from "@/types/api";

export interface ActiveToolCall {
  toolName: string;
  rationale?: string;
  startedAt: number;
}

/** Image preview stored alongside a user message */
export interface MessageImage {
  id: string;
  url: string; // data URL (persists across renders, unlike object URLs)
  name: string;
  conversationId?: string;
  timestamp?: number;
}

interface ChatState {
  activeConversationId: string | null;
  streamingConversationId: string | null;
  streamingContent: string;
  isStreaming: boolean;
  activeToolCall: ActiveToolCall | null;
  selectedRepoId: string | null;
  streamError: string | null;
  abortController: AbortController | null;
  optimisticUserMessage: MessageOut | null;
  agentMode: "auto" | "code" | "business";
  /** Maps message ID → image previews for display */
  messageImages: Record<string, MessageImage[]>;
  /** All images uploaded across all conversations (gallery) */
  galleryImages: MessageImage[];

  setActiveConversation: (id: string | null) => void;
  setSelectedRepo: (repoId: string | null) => void;
  setAgentMode: (mode: "auto" | "code" | "business") => void;
  startStream: (controller: AbortController, userMessage: MessageOut, conversationId: string | null) => void;
  applyStreamEvent: (event: ChatStreamEvent) => void;
  endStream: () => void;
  stopStream: () => void;
  resetStreamingContent: () => void;
  clearOptimisticMessage: () => void;
  addMessageImages: (messageId: string, images: MessageImage[]) => void;
  /** Copy images from optimistic msg ID to the real persisted msg ID */
  transferMessageImages: (fromId: string, toId: string) => void;
}

/**
 * Streaming token updates can fire 10-50x/second during generation.
 * This lives in Zustand (not TanStack Query, not Context) specifically
 * so that only components subscribed to `streamingContent` re-render —
 * the conversation sidebar, repo selector, etc. never re-render on
 * every token.
 */
export const useChatStore = create<ChatState>((set, get) => ({
  activeConversationId: null,
  streamingConversationId: null,
  streamingContent: "",
  isStreaming: false,
  activeToolCall: null,
  selectedRepoId: null,
  streamError: null,
  abortController: null,
  optimisticUserMessage: null,
  agentMode: "auto",
  messageImages: {},
  galleryImages: [],

  setActiveConversation: (id) =>
    set({ activeConversationId: id, streamingContent: "", streamError: null }),

  setSelectedRepo: (repoId) => set({ selectedRepoId: repoId }),

  setAgentMode: (mode) => set({ agentMode: mode }),

  startStream: (controller, userMessage, conversationId) =>
    set({
      isStreaming: true,
      streamingConversationId: conversationId,
      streamingContent: "",
      streamError: null,
      activeToolCall: null,
      abortController: controller,
      optimisticUserMessage: userMessage,
    }),

  applyStreamEvent: (event) => {
    switch (event.type) {
      case "token":
        set((s) => ({ streamingContent: s.streamingContent + event.content, activeToolCall: null }));
        break;
      case "tool_call":
        set({
          activeToolCall: {
            toolName: event.tool_name,
            rationale: event.rationale,
            startedAt: Date.now(),
          },
        });
        break;
      case "error":
        set({ streamError: event.message, isStreaming: false });
        break;
      case "done":
        set({ isStreaming: false, activeToolCall: null });
        break;
    }
  },

  endStream: () => set({ isStreaming: false, activeToolCall: null, abortController: null }),

  stopStream: () => {
    get().abortController?.abort();
    set({ isStreaming: false, activeToolCall: null, abortController: null });
  },

  resetStreamingContent: () => set({ streamingContent: "" }),
  
  clearOptimisticMessage: () => set({ optimisticUserMessage: null }),

  addMessageImages: (messageId, images) =>
    set((s) => ({
      messageImages: { ...s.messageImages, [messageId]: images },
      galleryImages: [...s.galleryImages, ...images],
    })),

  transferMessageImages: (fromId, toId) =>
    set((s) => {
      const imgs = s.messageImages[fromId];
      if (!imgs) return {};
      // Keep both keys so either ID resolves the images
      return { messageImages: { ...s.messageImages, [toId]: imgs } };
    }),
}));
