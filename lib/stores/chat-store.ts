import { create } from "zustand";
import type { ChatFilePayload, ChatStreamEvent, MessageOut, AgentMode } from "@/types/api";

export interface ActiveToolCall {
  toolName: string;
  rationale?: string;
  startedAt: number;
}

/** Attachment preview stored alongside a user message (image or document) */
export interface MessageImage {
  id: string;
  url: string; // data URL (persists across renders, unlike object URLs); "" for documents
  name: string;
  conversationId?: string;
  timestamp?: number;
  /** True for non-image attachments (PDF/Word/text) — rendered as a file chip */
  isDocument?: boolean;
}

/** What a quick-start card hands the prompt box. `nonce` makes each hand-off distinct. */
export interface ComposerDraft {
  text: string;
  files?: File[];
  nonce: number;
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
  agentMode: AgentMode;
  /** null = the mode's default; true / false force thinking on or off. */
  thinking: boolean | null;
  setThinking: (value: boolean | null) => void;
  /** The model's reasoning for the message being streamed — never saved. */
  streamingReasoning: string;
  /** What the file being made is doing right now, e.g. "building_file". */
  streamingFileStage: string | null;
  /** The file this turn made, shown live while its overview streams in. */
  streamingFile: ChatFilePayload | null;
  /** Text (and files) a quick-start card puts in the prompt box — taken once by ChatInput. */
  composerDraft: ComposerDraft | null;
  /**
   * When the last stream ended (done, error or stop). Its reply stays on screen
   * until the saved copy is back from the server, so there is never a moment
   * showing neither; cleared once that hand-over is complete.
   */
  streamEndedAt: number | null;
  /** Maps message ID → image previews for display */
  messageImages: Record<string, MessageImage[]>;
  /** All images uploaded across all conversations (gallery) */
  galleryImages: MessageImage[];

  setActiveConversation: (id: string | null) => void;
  /** A new chat learns its id mid-stream: follow it without clearing the stream. */
  adoptStreamConversation: (id: string) => void;
  setComposerDraft: (draft: { text: string; files?: File[] } | null) => void;
  setSelectedRepo: (repoId: string | null) => void;
  setAgentMode: (mode: AgentMode) => void;
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
  thinking: null,
  streamingReasoning: "",
  streamingFileStage: null,
  streamingFile: null,
  composerDraft: null,
  streamEndedAt: null,
  messageImages: {},
  galleryImages: [],

  setActiveConversation: (id) =>
    set({ activeConversationId: id, streamingContent: "", streamingReasoning: "", streamError: null }),

  adoptStreamConversation: (id) => set({ activeConversationId: id, streamingConversationId: id }),

  setComposerDraft: (draft) => set({ composerDraft: draft ? { ...draft, nonce: Date.now() } : null }),

  setSelectedRepo: (repoId) => set({ selectedRepoId: repoId }),

  setAgentMode: (mode) => set({ agentMode: mode }),

  setThinking: (value) => set({ thinking: value }),

  startStream: (controller, userMessage, conversationId) =>
    set({
      isStreaming: true,
      streamingConversationId: conversationId,
      streamingContent: "",
      streamingReasoning: "",
      streamingFileStage: null,
      streamingFile: null,
      streamEndedAt: null,
      streamError: null,
      activeToolCall: null,
      abortController: controller,
      optimisticUserMessage: userMessage,
    }),

  applyStreamEvent: (event) => {
    switch (event.type) {
      case "file_stage":
        set({ streamingFileStage: event.stage });
        break;
      case "file":
        set({ streamingFile: { ...event }, streamingFileStage: null });
        break;
      case "reasoning":
        set((s) => ({ streamingReasoning: s.streamingReasoning + event.content }));
        break;
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
        set((s) => ({ streamError: event.message, isStreaming: false, streamEndedAt: s.streamEndedAt ?? Date.now() }));
        break;
      case "done":
        set((s) => ({ isStreaming: false, activeToolCall: null, streamEndedAt: s.streamEndedAt ?? Date.now() }));
        break;
    }
  },

  // The first end wins: "done" arrives before the stream closes, and the
  // hand-over waits for data fetched after that moment.
  endStream: () =>
    set((s) => ({
      isStreaming: false, activeToolCall: null, abortController: null, streamingFileStage: null,
      streamEndedAt: s.streamEndedAt ?? Date.now(),
    })),

  stopStream: () => {
    get().abortController?.abort();
    set((s) => ({
      isStreaming: false, activeToolCall: null, abortController: null,
      streamEndedAt: s.streamEndedAt ?? Date.now(),
    }));
  },

  resetStreamingContent: () =>
    set({ streamingContent: "", streamingReasoning: "", streamingFileStage: null, streamingFile: null, streamEndedAt: null }),
  
  clearOptimisticMessage: () => set({ optimisticUserMessage: null }),

  addMessageImages: (messageId, images) =>
    set((s) => ({
      messageImages: { ...s.messageImages, [messageId]: images },
      // Documents don't belong in the image gallery
      galleryImages: [...s.galleryImages, ...images.filter((img) => !img.isDocument)],
    })),

  transferMessageImages: (fromId, toId) =>
    set((s) => {
      const imgs = s.messageImages[fromId];
      if (!imgs) return {};
      // Keep both keys so either ID resolves the images
      return { messageImages: { ...s.messageImages, [toId]: imgs } };
    }),
}));
