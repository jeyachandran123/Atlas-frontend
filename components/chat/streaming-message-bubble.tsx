"use client";

import { MessageMarkdown } from "@/components/chat/message-markdown";
import { ToolCallIndicator } from "@/components/chat/tool-call-indicator";
import type { ActiveToolCall } from "@/lib/stores/chat-store";

function AtlasAvatar({ streaming }: { streaming?: boolean }) {
  return (
    <div
      className="relative flex size-7 shrink-0 items-center justify-center rounded-lg"
      style={{
        background: "linear-gradient(135deg, var(--accent) 0%, #6d28d9 100%)",
        boxShadow: streaming
          ? "0 0 0 2px var(--accent-border), 0 2px 10px rgba(99,102,241,0.40)"
          : "0 2px 8px rgba(99,102,241,0.28), inset 0 1px 0 rgba(255,255,255,0.12)",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.95" />
        <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
      </svg>
      {streaming && (
        <span
          className="absolute -right-0.5 -top-0.5 size-2 rounded-full animate-signal-pulse"
          style={{ background: "var(--accent-bright)", boxShadow: "0 0 5px var(--accent)" }}
        />
      )}
    </div>
  );
}

export function StreamingMessageBubble({
  content, activeToolCall,
}: {
  content: string;
  activeToolCall: ActiveToolCall | null;
}) {
  return (
    <div className="flex gap-3 animate-fade-in-up">
      <AtlasAvatar streaming />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <ToolCallIndicator call={activeToolCall} />

        {content ? (
          <div className="assistant-content">
            <MessageMarkdown content={content} />
            <span
              className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-0.5 rounded-full animate-cursor"
              style={{ background: "var(--accent)" }}
            />
          </div>
        ) : !activeToolCall ? (
          <div className="flex items-center gap-1.5 py-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1.5 rounded-full animate-typing-dot"
                style={{ background: "var(--accent)", animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
