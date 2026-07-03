"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { formatTokenCount } from "@/lib/utils/format";
import type { MessageOut } from "@/types/api";

function AtlasAvatar({ streaming }: { streaming?: boolean }) {
  return (
    <div
      className="relative flex size-7 shrink-0 items-center justify-center rounded-lg"
      style={{
        background: "linear-gradient(135deg, var(--accent) 0%, #6d28d9 100%)",
        boxShadow: streaming
          ? "0 0 0 2px var(--accent-border), 0 2px 12px rgba(99,102,241,0.40)"
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

export function MessageBubble({ message }: { message: MessageOut }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in-up">
        <div className="group flex max-w-[78%] flex-col items-end gap-1.5">
          <div className="user-bubble">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] opacity-0 transition-all group-hover:opacity-100"
            style={{ color: "var(--text-muted)" }}
          >
            {copied
              ? <><Check className="size-3" style={{ color: "var(--success)" }} /> Copied</>
              : <><Copy className="size-3" /> Copy</>
            }
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-in-up">
      <AtlasAvatar />
      <div className="group flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="assistant-content min-w-0 w-full">
          <MessageMarkdown content={message.content} />
        </div>
        <div className="flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
          {message.tokens_used > 0 && (
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {formatTokenCount(message.tokens_used)} tokens
            </span>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
          >
            {copied
              ? <><Check className="size-3" style={{ color: "var(--success)" }} /> Copied</>
              : <><Copy className="size-3" /> Copy</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
