"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { StreamingMessageBubble } from "@/components/chat/streaming-message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { QuickActions } from "@/components/chat/quick-actions";
import { useMessages } from "@/lib/hooks/use-chat";
import { useStreamChat } from "@/lib/hooks/use-chat";
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

  // Clear streaming content when messages are loaded after streaming completes
  useEffect(() => {
    if (!isStreaming && streamingContent && messages.length > 0) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        resetStreamingContent();
        clearOptimisticMessage();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, streamingContent, messages.length, resetStreamingContent, clearOptimisticMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent, isStreaming, optimisticUserMessage]);

  const isEmpty = messages.length === 0 && !isStreaming && !isLoading && !optimisticUserMessage;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {isEmpty ? (
            <EmptyState onPick={(t) => send(t, selectedRepoId ?? undefined)} />
          ) : (
            <>
              {/* Show persisted messages */}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              
              {/* Show optimistic user message if it exists and hasn't been persisted yet */}
              {optimisticUserMessage && !messages.find(m => m.content === optimisticUserMessage.content && m.role === 'user') && (
                <MessageBubble key={optimisticUserMessage.id} message={optimisticUserMessage} />
              )}
              
              {/* Show streaming response */}
              {(isStreaming || streamingContent) && (
                <StreamingMessageBubble content={streamingContent} activeToolCall={activeToolCall} />
              )}
              
              {streamError && (
                <div className="rounded-md border border-remove/20 bg-remove-bg px-3 py-2 text-sm text-remove">
                  {streamError}
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-border-subtle px-4 py-4">
        <div className="mx-auto max-w-3xl">
          <ChatInput
            onSend={(msg) => send(msg, selectedRepoId ?? undefined)}
            onStop={stop}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (template: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg border border-signal/20 bg-signal/10">
        <Sparkles className="size-5 text-signal-glow" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Ask Atlas about this codebase</h2>
        <p className="mt-1 text-sm text-text-tertiary">
          Grounded answers with citations — Atlas reads files, checks git history, and searches code as needed.
        </p>
      </div>
      <QuickActions onPick={onPick} />
    </div>
  );
}
