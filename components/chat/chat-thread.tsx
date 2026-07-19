"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Share2, Check, AlertCircle } from "lucide-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { StreamingMessageBubble } from "@/components/chat/streaming-message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { QuickActions } from "@/components/chat/quick-actions";
import { useMessages, useStreamChat, useConversations } from "@/lib/hooks/use-chat";
import { useChatStore } from "@/lib/stores/chat-store";
import { useAuthStore } from "@/lib/stores/auth-store";

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

  // Conversation title for the header (best-effort from the cached list)
  const { data: convData } = useConversations();
  const activeTitle = convData?.conversations.find((c) => c.id === activeConversationId)?.title;

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
      if (messages[i]?.role === "user") {
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

      {/* Messages */}
      <div className={`relative flex-1 ${isEmpty ? "overflow-hidden" : "overflow-y-auto"}`}
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {isEmpty ? (
          <EmptyState onPick={(t) => send(t, selectedRepoId ?? undefined, "auto")} />
        ) : (
          <div className="mx-auto max-w-[768px] px-6 py-8">
            <div className="flex flex-col gap-7">
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
                  onDelete={m.role === "user" && !isActiveStream ? (id) => deleteMessage(id) : undefined}
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
            <div ref={bottomRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="px-6 pb-5 pt-3"
        style={{ background: "linear-gradient(to top, var(--canvas) 60%, transparent)" }}
      >
        <div className="mx-auto max-w-[768px]">
          <ChatInput
            onSend={(msg, files, agentId) => send(msg, selectedRepoId ?? undefined, agentId ?? "auto", files)}
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

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
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
