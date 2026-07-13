"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Share2, Check } from "lucide-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { StreamingMessageBubble } from "@/components/chat/streaming-message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { QuickActions } from "@/components/chat/quick-actions";
import { useMessages, useStreamChat } from "@/lib/hooks/use-chat";
import { useChatStore } from "@/lib/stores/chat-store";

export function ChatThread() {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const selectedRepoId = useChatStore((s) => s.selectedRepoId);
  const streamingConversationId = useChatStore((s) => s.streamingConversationId);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const activeToolCall = useChatStore((s) => s.activeToolCall);
  const streamError = useChatStore((s) => s.streamError);
  const optimisticUserMessage = useChatStore((s) => s.optimisticUserMessage);
  const resetStreamingContent = useChatStore((s) => s.resetStreamingContent);
  const clearOptimisticMessage = useChatStore((s) => s.clearOptimisticMessage);

  // Only show streaming state if it belongs to the currently viewed conversation
  const isActiveStream = isStreaming && streamingConversationId === activeConversationId;
  const activeStreamContent = isActiveStream || (streamingConversationId === activeConversationId && streamingContent)
    ? streamingContent
    : "";
  const showStreamError = streamError && streamingConversationId === activeConversationId;
  const showOptimistic = optimisticUserMessage && streamingConversationId === activeConversationId;

  const { data: messages = [], isLoading } = useMessages(activeConversationId);
  const { send, editAndResend, retry, deleteMessage, stop } = useStreamChat();

  function handleRetry(messageId: string, content: string) {
    retry(messageId, content, selectedRepoId ?? undefined);
  }

  function handleEdit(messageId: string, newContent: string) {
    editAndResend(messageId, newContent, selectedRepoId ?? undefined);
  }

  // Last user message for error-banner retry
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content
    ?? (showOptimistic ? optimisticUserMessage?.content : undefined);

  // Index of the last user message that has no assistant reply after it
  const lastUnansweredUserIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        // Check if any assistant message exists after this index
        const hasReply = messages.slice(i + 1).some((m) => m.role === "assistant");
        return hasReply ? -1 : i;
      }
    }
    return -1;
  })();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Track whether user is near the bottom — only auto-scroll if they are
  const isNearBottomRef = useRef(true);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  useEffect(() => {
    if (!isActiveStream && activeStreamContent && messages.length > 0) {
      const t = setTimeout(() => { resetStreamingContent(); clearOptimisticMessage(); }, 100);
      return () => clearTimeout(t);
    }
  }, [isActiveStream, activeStreamContent, messages.length, resetStreamingContent, clearOptimisticMessage]);

  // Auto-scroll only when user is already near the bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, activeStreamContent, isActiveStream, showOptimistic]);

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
      {/* Share button */}
      {!isEmpty && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={handleShareConversation}
            title="Copy conversation"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all hover:opacity-80"
            style={{
              background: "var(--surface-2, #1e1e2e)",
              border: "1px solid var(--border, #2d2d3d)",
              color: copied ? "var(--accent, #6366f1)" : "var(--text-muted, #888)",
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      )}
      {/* Messages */}
      <div className={`relative flex-1 ${isEmpty ? "overflow-hidden" : "overflow-y-auto"}`}
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {isEmpty ? (
          <EmptyState onPick={(t) => send(t, selectedRepoId ?? undefined, "auto")} />
        ) : (
          <div className="mx-auto max-w-[760px] px-6 py-8">
            <div className="flex flex-col gap-6">
              {messages.map((m, i) =>
                <MessageBubble
                  key={m.id}
                  message={m}
                  onRetry={m.role === "user" && i === lastUnansweredUserIdx && !isActiveStream
                    ? (id, content) => handleRetry(id, content)
                    : undefined}
                  onEdit={m.role === "user" && !isActiveStream
                    ? (id, newContent) => handleEdit(id, newContent)
                    : undefined}
                  onDelete={!isActiveStream ? (id) => deleteMessage(id) : undefined}
                  isLastUserWithoutReply={m.role === "user" && i === lastUnansweredUserIdx && !isActiveStream}
                />
              )}

              {showOptimistic &&
                !messages.find((m) => m.content === optimisticUserMessage!.content && m.role === "user") && (
                  <MessageBubble key={optimisticUserMessage!.id} message={optimisticUserMessage!} />
                )}

              {(isActiveStream || activeStreamContent) && (
                <StreamingMessageBubble content={activeStreamContent} activeToolCall={activeToolCall} />
              )}

              {showStreamError && (
                <div
                  className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: "var(--danger-bg)",
                    border: "1px solid var(--danger-border)",
                    color: "var(--danger)",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: "var(--danger)" }} />
                    {streamError}
                  </div>
                  {lastUserMessage && (
                    <button
                      onClick={() => {
                        const lastMsg = [...messages].reverse().find((m) => m.role === "user");
                        if (lastMsg) handleRetry(lastMsg.id, lastMsg.content);
                      }}
                      className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] transition-opacity hover:opacity-80"
                      style={{ background: "var(--danger-border)", color: "var(--danger)" }}
                    >
                      <RotateCcw className="size-3" /> Retry
                    </button>
                  )}
                </div>
              )}
            </div>
            <div ref={bottomRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="px-6 pb-6 pt-4"
        style={{ background: "linear-gradient(to top, var(--canvas) 65%, transparent)" }}
      >
        <div className="mx-auto max-w-[760px]">
          <ChatInput
            onSend={(msg, _files, agentId) => send(msg, selectedRepoId ?? undefined, agentId ?? "auto")}
            onStop={stop}
            isStreaming={isActiveStream}
          />
          <p className="mt-2.5 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
            Atlas can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-[620px] mt-8">

        {/* Hero */}
        <div className="mb-10 flex flex-col items-center text-center animate-fade-up">
          {/* Logo */}
          <div className="relative mb-7">
            <div
              className="absolute inset-0 rounded-3xl blur-2xl"
              style={{
                background: "linear-gradient(135deg, var(--accent), #7c3aed)",
                transform: "scale(1.7)",
                opacity: 0.28,
              }}
            />
            <div
              className="relative flex h-[68px] w-[68px] items-center justify-center rounded-[22px]"
              style={{
                background: "linear-gradient(145deg, var(--accent) 0%, #6d28d9 100%)",
                boxShadow: "0 0 0 1px var(--accent-border), 0 12px 40px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <div
                className="absolute inset-0 rounded-[22px]"
                style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.14) 0%, transparent 50%)" }}
              />
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="relative z-10">
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
            How can I help?
          </h1>
          <p
            className="mt-3 max-w-[400px] text-[14px] leading-relaxed"
            style={{ color: "var(--text-tertiary)" }}
          >
            Ask me anything about your codebase — I read files, search semantically, and check git history.
          </p>
        </div>

        {/* Quick actions */}
        <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
          <QuickActions onPick={onPick} />
        </div>
      </div>
    </div>
  );
}
