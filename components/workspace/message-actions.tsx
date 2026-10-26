"use client";

import { useState } from "react";
import { Check, Copy, RotateCcw, Trash2 } from "lucide-react";

/**
 * Copy, retry, delete — the three things people expect to be able to do to a
 * message, and could not do here.
 *
 * They appear on hover rather than permanently: a row of buttons under every
 * bubble turns a conversation into a toolbar. The copy button reports back,
 * because a copy that gives no feedback gets pressed three times.
 */
export function MessageActions({
  text,
  onRetry,
  onDelete,
  className = "",
}: {
  text: string;
  onRetry?: () => void;
  onDelete?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard access can be refused (insecure origin, permissions). The
      // button simply does not confirm; nothing is broken and nothing lies.
    }
  }

  return (
    <div
      className={`flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 ${className}`}
    >
      <ActionButton onClick={copy} title={copied ? "Copied" : "Copy"}>
        {copied ? (
          <Check className="size-3.5" style={{ color: "var(--status-ready)" }} />
        ) : (
          <Copy className="size-3.5" />
        )}
      </ActionButton>

      {onRetry && (
        <ActionButton onClick={onRetry} title="Ask again">
          <RotateCcw className="size-3.5" />
        </ActionButton>
      )}

      {onDelete && (
        <ActionButton onClick={onDelete} title="Remove from this view" danger>
          <Trash2 className="size-3.5" />
        </ActionButton>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="rounded-md p-1.5 transition-colors hover:bg-[var(--surface-3)]"
      style={{ color: danger ? "var(--status-error)" : "var(--text-muted)" }}
    >
      {children}
    </button>
  );
}
