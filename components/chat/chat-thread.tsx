"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Share2, Check, AlertCircle } from "lucide-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { StreamingMessageBubble } from "@/components/chat/streaming-message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { QuickActions, type QuickStart } from "@/components/chat/quick-actions";
import { PromptNavigator, type PromptEntry } from "@/components/chat/prompt-navigator";
import { ScrollToBottomButton } from "@/components/chat/scroll-to-bottom";
import { ChatMessagesSkeleton } from "@/components/ui/skeleton";
import { useMessages, useStreamChat, useConversations } from "@/lib/hooks/use-chat";
import { useChatStore } from "@/lib/stores/chat-store";
import { useAuthStore } from "@/lib/stores/auth-store";

/** How close to the bottom still counts as "reading the latest". */
const NEAR_BOTTOM_PX = 120;
/** Where a prompt lands when jumped to — a little breathing room above it. */
const JUMP_OFFSET_PX = 16;

export function ChatThread() {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const selectedRepoId = useChatStore((s) => s.selectedRepoId);
  const streamingConversationId = useChatStore((s) => s.streamingConversationId);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const streamingReasoning = useChatStore((s) => s.streamingReasoning);
  const streamingFileStage = useChatStore((s) => s.streamingFileStage);
  const streamingFile = useChatStore((s) => s.streamingFile);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const activeToolCall = useChatStore((s) => s.activeToolCall);
  const streamError = useChatStore((s) => s.streamError);
  const optimisticUserMessage = useChatStore((s) => s.optimisticUserMessage);
  const resetStreamingContent = useChatStore((s) => s.resetStreamingContent);
  const clearOptimisticMessage = useChatStore((s) => s.clearOptimisticMessage);
  const streamEndedAt = useChatStore((s) => s.streamEndedAt);

  // Only show streaming state if it belongs to the currently viewed conversation
  const isActiveStream = isStreaming && streamingConversationId === activeConversationId;
  const activeStreamContent = isActiveStream || (streamingConversationId === activeConversationId && streamingContent)
    ? streamingContent
    : "";
  const showStreamError = streamError && streamingConversationId === activeConversationId;
  const showOptimistic = optimisticUserMessage && streamingConversationId === activeConversationId;

  const { data: messages = [], isLoading, dataUpdatedAt } = useMessages(activeConversationId);
  const { send, editAndResend, retry, deleteMessage, stop } = useStreamChat();

  // The streamed reply stays on screen after the stream ends, until its saved
  // copy is in the list — the refetch takes a moment, and clearing it sooner
  // left the answer blank in between. The hand-over ends when the reply is the
  // last message, or when fresh data from after the stream arrives (a stopped
  // or failed turn saves no reply). Both are decided in the same render the
  // saved copy appears in, so the two never show together.
  const lastMessage = messages[messages.length - 1];
  const handingOver =
    !isActiveStream && !streamError && streamEndedAt !== null
    && streamingConversationId === activeConversationId
    && lastMessage?.role !== "assistant" && dataUpdatedAt <= streamEndedAt;

  // Conversation title for the header (best-effort from the cached list)
  const { data: convData } = useConversations();
  const activeTitle = convData?.conversations.find((c) => c.id === activeConversationId)?.title;

  function handleRetry(messageId: string, content: string) {
    retry(messageId, content, selectedRepoId ?? undefined);
  }

  // A quick-start card fills the prompt box and picks the mode — it never sends.
  function startFromCard(start: QuickStart) {
    const store = useChatStore.getState();
    store.setAgentMode(start.mode);
    store.setComposerDraft({ text: start.text, files: start.files });
  }

  function handleEdit(messageId: string, newContent: string, keep?: string[]) {
    editAndResend(messageId, newContent, selectedRepoId ?? undefined, keep);
  }

  // Last user message for error-banner retry
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content
    ?? (showOptimistic ? optimisticUserMessage?.content : undefined);

  // Index of the last user message that has no assistant reply after it
  const lastUnansweredUserIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") {
        // Check if any assistant message exists after this index
        const hasReply = messages.slice(i + 1).some((m) => m.role === "assistant");
        return hasReply ? -1 : i;
      }
    }
    return -1;
  })();

  // The prompts, in order — what the navigator lists and jumps between.
  const prompts: PromptEntry[] = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user")
        .map((m) => ({
          id: m.id,
          text: m.content?.trim() || m.documents?.[0]?.filename || m.images?.[0]?.filename || "Attachment",
          time: m.created_at,
        })),
    [messages],
  );

  // ── Scrolling ──────────────────────────────────────────────────────────────
  //
  // The rule: follow new content only while the reader is at the bottom. The
  // moment they scroll up, they are reading something, and a streaming reply
  // must not drag them away from it. Following resumes when they come back
  // down on their own, or press the button.
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const updateActivePrompt = useCallback(() => {
    const el = scrollRef.current;
    if (!el || prompts.length === 0) return;
    const line = el.getBoundingClientRect().top + 96;
    let current = prompts[0]!.id;
    for (const p of prompts) {
      const node = el.querySelector<HTMLElement>(`[data-msg-id="${CSS.escape(p.id)}"]`);
      if (!node) continue;
      if (node.getBoundingClientRect().top <= line) current = p.id;
      else break;
    }
    setActivePromptId(current);
  }, [prompts]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    followRef.current = near;
    setAtBottom(near);
    if (near) setHasNewBelow(false);
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateActivePrompt();
      });
    }
  }

  // A wheel or touch upwards is intent, and it is known before the scroll
  // event lands — acting on it here means the next streamed token cannot win
  // a race against the reader's own hand.
  function handleWheel(e: React.WheelEvent) {
    if (e.deltaY < 0) followRef.current = false;
  }
  function handleTouchMove() {
    followRef.current = false;
  }

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    followRef.current = true;
    setHasNewBelow(false);
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const jumpToPrompt = useCallback((id: string) => {
    const el = scrollRef.current;
    const node = el?.querySelector<HTMLElement>(`[data-msg-id="${CSS.escape(id)}"]`);
    if (!el || !node) return;
    followRef.current = false;
    el.scrollTo({ top: Math.max(0, node.offsetTop - JUMP_OFFSET_PX), behavior: "smooth" });
    setActivePromptId(id);
    setFlashId(id);
    window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
  }, []);

  // Opening a conversation starts at its latest message.
  useEffect(() => {
    followRef.current = true;
    setHasNewBelow(false);
    setAtBottom(true);
  }, [activeConversationId]);

  // Follow new content — instantly, not smoothly: a smooth scroll started on
  // every streamed token is an animation that never finishes, and it fights
  // any scroll the reader starts while it runs.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (followRef.current) {
      el.scrollTop = el.scrollHeight;
    } else if (isActiveStream || activeStreamContent) {
      setHasNewBelow(true);
    }
  }, [messages.length, activeStreamContent, streamingReasoning, isActiveStream, showOptimistic]);

  useEffect(() => { updateActivePrompt(); }, [updateActivePrompt]);
  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  // Once the saved reply has taken its place, the streamed copy is done with.
  // A failed turn keeps its prompt for the error banner's retry.
  useEffect(() => {
    if (!isActiveStream && streamEndedAt !== null && !handingOver && !streamError) {
      resetStreamingContent();
      clearOptimisticMessage();
    }
  }, [isActiveStream, streamEndedAt, handingOver, streamError, resetStreamingContent, clearOptimisticMessage]);

  const isEmpty = messages.length === 0 && !isActiveStream && !isLoading && !showOptimistic;

  const [copied, setCopied] = useState(false);

  function handleShareConversation() {
    const text = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: "${m.content}"`)
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Conversation header */}
      {!isEmpty && (
        <div
          className="glass sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-4 px-5"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <p
            className="truncate text-[13px] font-medium"
            style={{ color: "var(--text-secondary)", letterSpacing: "-0.01em" }}
          >
            {activeTitle || "Conversation"}
          </p>
          <button
            onClick={handleShareConversation}
            title="Copy conversation"
            className="ghost-btn flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium"
            style={copied ? { color: "var(--success)" } : undefined}
          >
            {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
            {copied ? "Copied" : "Share"}
          </button>
        </div>
      )}

      {/* Message area. The navigator overlays exactly this region, so it can
          never run under the header above or the composer below. */}
      <div className="relative min-h-0 flex-1">
        <div
          className={`absolute inset-0 ${isEmpty ? "overflow-hidden" : "overflow-y-auto"}`}
          ref={scrollRef}
          onScroll={handleScroll}
          onWheel={handleWheel}
          onTouchMove={handleTouchMove}
        >
          {isEmpty ? (
            <EmptyState onStart={startFromCard} />
          ) : isLoading && messages.length === 0 && !showOptimistic ? (
            <div className="mx-auto max-w-[768px] px-6 py-8">
              <ChatMessagesSkeleton />
            </div>
          ) : (
            <div className="mx-auto max-w-[768px] px-6 py-8">
              <div className="flex flex-col gap-7">
                {messages.map((m, i) => (
                  <div
                    key={m.id}
                    data-msg-id={m.id}
                    className="-mx-3 rounded-2xl px-3 py-1 transition-[box-shadow,background-color] duration-700 ease-out"
                    style={flashId === m.id ? {
                      background: "var(--accent-subtle)",
                      boxShadow: "0 0 0 1px var(--accent-border), 0 0 28px rgba(99,102,241,0.18)",
                    } : undefined}
                  >
                    <MessageBubble
                      message={m}
                      onRetry={m.role === "user" && i === lastUnansweredUserIdx && !isActiveStream
                        ? (id, content) => handleRetry(id, content)
                        : undefined}
                      onEdit={m.role === "user" && !isActiveStream
                        ? (id, newContent, keep) => handleEdit(id, newContent, keep)
                        : undefined}
                      onDelete={m.role === "user" && !isActiveStream ? (id) => deleteMessage(id) : undefined}
                      isLastUserWithoutReply={m.role === "user" && i === lastUnansweredUserIdx && !isActiveStream}
                      isLast={i === messages.length - 1 && !isActiveStream}
                      onClarifySubmit={(text) => {
                        scrollToBottom("smooth");
                        send(text, selectedRepoId ?? undefined, useChatStore.getState().agentMode);
                      }}
                    />
                  </div>
                ))}

                {showOptimistic &&
                  !messages.find((m) => m.content === optimisticUserMessage!.content && m.role === "user") && (
                    <MessageBubble key={optimisticUserMessage!.id} message={optimisticUserMessage!} />
                  )}

                {(isActiveStream || handingOver) && (
                  <StreamingMessageBubble content={activeStreamContent} activeToolCall={activeToolCall} reasoning={isActiveStream ? streamingReasoning : ""} fileStage={isActiveStream ? streamingFileStage : null} file={streamingConversationId === activeConversationId ? streamingFile : null} />
                )}

                {showStreamError && (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-[13px] animate-fade-in-up"
                    style={{
                      background: "var(--danger-bg)",
                      border: "1px solid var(--danger-border)",
                      color: "var(--danger)",
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AlertCircle className="size-4 shrink-0" />
                      <span className="truncate">{streamError}</span>
                    </div>
                    {lastUserMessage && (
                      <button
                        onClick={() => {
                          const lastMsg = [...messages].reverse().find((m) => m.role === "user");
                          if (lastMsg) handleRetry(lastMsg.id, lastMsg.content);
                        }}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                        style={{ background: "var(--danger-border)", color: "var(--danger)" }}
                      >
                        <RotateCcw className="size-3" /> Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="h-4" />
            </div>
          )}
        </div>

        {/* Prompt navigator — right edge of the message area */}
        {!isEmpty && (
          <PromptNavigator prompts={prompts} activeId={activePromptId} onJump={jumpToPrompt} />
        )}
      </div>

      {/* Input */}
      <div
        className="px-6 pb-5 pt-3"
        style={{ background: "linear-gradient(to top, var(--canvas) 60%, transparent)" }}
      >
        <div className="relative mx-auto max-w-[768px]">
          {!isEmpty && (
            <ScrollToBottomButton
              visible={!atBottom}
              hasNew={hasNewBelow}
              onClick={() => scrollToBottom("smooth")}
            />
          )}
          <ChatInput
            onSend={(msg, files, agentId) => {
              // Sending is a clear signal you want to see what comes next.
              scrollToBottom("smooth");
              send(msg, selectedRepoId ?? undefined, agentId ?? "auto", files);
            }}
            onStop={stop}
            isStreaming={isActiveStream}
          />
          <p className="mt-2.5 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
            UnityWorks can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function EmptyState({ onStart }: { onStart: (start: QuickStart) => void }) {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.full_name?.split(" ")[0];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
      <div className="mt-8 w-full max-w-[640px]">

        {/* Hero */}
        <div className="mb-10 flex flex-col items-center text-center animate-fade-up">
          {/* Logo */}
          <div className="relative mb-7">
            <div
              className="absolute inset-0 rounded-3xl blur-2xl"
              style={{
                background: "var(--accent-gradient)",
                transform: "scale(1.7)",
                opacity: 0.26,
              }}
            />
            <div
              className="relative flex h-[64px] w-[64px] items-center justify-center rounded-[20px]"
              style={{
                background: "var(--accent-gradient)",
                boxShadow: "0 0 0 1px var(--accent-border), 0 12px 40px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <div
                className="absolute inset-0 rounded-[20px]"
                style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.14) 0%, transparent 50%)" }}
              />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="relative z-10">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.95" />
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
              </svg>
            </div>
          </div>

          <h1
            className="text-[30px] font-semibold"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.035em", lineHeight: 1.15 }}
          >
            {firstName ? `${greeting()}, ${firstName}` : greeting()}
          </h1>
          <p
            className="mt-3 max-w-[420px] text-[14px] leading-relaxed"
            style={{ color: "var(--text-tertiary)" }}
          >
            Ask anything — or bring a document, a spreadsheet or your code, and I&apos;ll answer from it,
            analyse it, or turn it into a file.
          </p>
        </div>

        {/* Quick actions */}
        <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
          <QuickActions onPick={onStart} />
        </div>
      </div>
    </div>
  );
}
