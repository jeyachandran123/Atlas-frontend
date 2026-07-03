"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { StreamingMessageBubble } from "@/components/chat/streaming-message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { QuickActions } from "@/components/chat/quick-actions";
import { useMessages, useStreamChat } from "@/lib/hooks/use-chat";
import { useChatStore } from "@/lib/stores/chat-store";

export function ChatThread() {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const selectedRepoId = useChatStore((s) => s.selectedRepoId);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const activeToolCall = useChatStore((s) => s.activeToolCall);
  const streamError = useChatStore((s) => s.streamError);
  const optimisticUserMessage = useChatStore((s) => s.optimisticUserMessage);
  const resetStreamingContent = useChatStore((s) => s.resetStreamingContent);
  const clearOptimisticMessage = useChatStore((s) => s.clearOptimisticMessage);

  const { data: messages = [], isLoading } = useMessages(activeConversationId);
  const { send, stop } = useStreamChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isStreaming && streamingContent && messages.length > 0) {
      const t = setTimeout(() => { resetStreamingContent(); clearOptimisticMessage(); }, 100);
      return () => clearTimeout(t);
    }
  }, [isStreaming, streamingContent, messages.length, resetStreamingContent, clearOptimisticMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent, isStreaming, optimisticUserMessage]);

  const isEmpty = messages.length === 0 && !isStreaming && !isLoading && !optimisticUserMessage;

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className={`relative flex-1 ${isEmpty ? "overflow-hidden" : "overflow-y-auto"}`}>
        {isEmpty ? (
          <EmptyState onPick={(t) => send(t, selectedRepoId ?? undefined, "auto")} />
        ) : (
          <div className="mx-auto max-w-[760px] px-6 py-8">
            <div className="flex flex-col gap-6">
              {messages.map((m) => <MessageBubble key={m.id} message={m} />)}

              {optimisticUserMessage &&
                !messages.find((m) => m.content === optimisticUserMessage.content && m.role === "user") && (
                  <MessageBubble key={optimisticUserMessage.id} message={optimisticUserMessage} />
                )}

              {(isStreaming || streamingContent) && (
                <StreamingMessageBubble content={streamingContent} activeToolCall={activeToolCall} />
              )}

              {streamError && (
                <div
                  className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: "var(--danger-bg)",
                    border: "1px solid var(--danger-border)",
                    color: "var(--danger)",
                  }}
                >
                  <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ background: "var(--danger)" }} />
                  {streamError}
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
            isStreaming={isStreaming}
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
