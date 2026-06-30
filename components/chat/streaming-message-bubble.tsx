"use client";

import { Sparkles } from "lucide-react";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { ToolCallIndicator } from "@/components/chat/tool-call-indicator";
import type { ActiveToolCall } from "@/lib/stores/chat-store";

/**
 * The in-progress assistant message. The left border pulse is the product's
 * core motion signature — a quiet, persistent signal that the agent is
 * actively working, distinct from the one-shot tool-call badge above it.
 */
export function StreamingMessageBubble({
  content,
  activeToolCall,
}: {
  content: string;
  activeToolCall: ActiveToolCall | null;
}) {
  return (
    <div className="flex gap-3 animate-fade-in-up">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-signal/20 bg-signal/10 text-signal-glow">
        <Sparkles className="size-3.5 animate-signal-pulse" />
      </div>

      <div className="flex max-w-[85%] flex-col gap-2">
        <ToolCallIndicator call={activeToolCall} />

        {content && (
          <div className="rounded-lg border-l-2 border-signal bg-surface-raised px-3.5 py-2.5 text-sm text-text-primary">
            <MessageMarkdown content={content} />
          </div>
        )}

        {!content && !activeToolCall && (
          <div className="flex items-center gap-1 px-1 py-2">
            <span className="size-1.5 rounded-full bg-text-tertiary animate-signal-pulse [animation-delay:0ms]" />
            <span className="size-1.5 rounded-full bg-text-tertiary animate-signal-pulse [animation-delay:200ms]" />
            <span className="size-1.5 rounded-full bg-text-tertiary animate-signal-pulse [animation-delay:400ms]" />
          </div>
        )}
      </div>
    </div>
  );
}
