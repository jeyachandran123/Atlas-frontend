"use client";

import { Copy, Check, User, Sparkles } from "lucide-react";
import { useState } from "react";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { cn } from "@/lib/utils/cn";
import { formatLatency, formatTokenCount } from "@/lib/utils/format";
import type { MessageOut } from "@/types/api";

export function MessageBubble({ message }: { message: MessageOut }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={cn("group flex gap-3 animate-fade-in-up", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md border",
          isUser ? "border-border bg-surface text-text-secondary" : "border-signal/20 bg-signal/10 text-signal-glow",
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Sparkles className="size-3.5" />}
      </div>

      <div className={cn("flex max-w-[85%] flex-col gap-1", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-lg px-3.5 py-2.5 text-sm",
            isUser ? "bg-surface text-text-primary" : "bg-surface-raised text-text-primary",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MessageMarkdown content={message.content} />
          )}
        </div>

        <div className="flex items-center gap-2 px-1 text-[11px] text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100">
          {!isUser && message.tokens_used > 0 && <span>{formatTokenCount(message.tokens_used)} tokens</span>}
          <button onClick={handleCopy} className="flex items-center gap-1 hover:text-text-secondary">
            {copied ? <Check className="size-3 text-add" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
