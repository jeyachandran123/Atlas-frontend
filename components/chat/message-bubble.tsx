"use client";

import { Copy, Check, RotateCcw, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { formatTokenCount } from "@/lib/utils/format";
import type { MessageOut } from "@/types/api";

function DeleteConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onCancel}
    >
      <div
        className="flex flex-col gap-4 rounded-2xl p-6 w-[340px] shadow-2xl"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-default)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)" }}
          >
            <AlertTriangle className="size-4" style={{ color: "var(--danger)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Delete message?</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              This message and its response will be permanently removed.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-1.5 text-sm transition-opacity hover:opacity-80"
            style={{ background: "var(--surface-3)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg px-4 py-1.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--danger)", color: "white" }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

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

export function MessageBubble({
  message,
  onRetry,
  onEdit,
  onDelete,
  isLastUserWithoutReply,
}: {
  message: MessageOut;
  onRetry?: (id: string, content: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  isLastUserWithoutReply?: boolean;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as content grows
  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editing, editValue]);

  function handleCopy() {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleEditSubmit() {
    const trimmed = editValue.trim();
    if (trimmed) {
      onEdit?.(message.id, trimmed);
    }
    setEditing(false);
  }

  function openEdit() {
    setEditValue(message.content);
    setEditing(true);
  }

  // ── User message ──────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <>
        {confirmDelete && (
          <DeleteConfirmModal
            onConfirm={() => { setConfirmDelete(false); onDelete?.(message.id); }}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
        <div className="flex justify-end animate-fade-in-up">
          <div className="group flex w-full max-w-[82%] flex-col items-end gap-1">
            {editing ? (
              <div className="flex w-full flex-col gap-2">
                <textarea
                  ref={textareaRef}
                  className="w-full rounded-2xl px-4 py-3 text-sm leading-relaxed resize-none overflow-hidden"
                  style={{
                    background: "var(--surface-2)",
                    border: "1.5px solid var(--accent)",
                    color: "var(--text-primary)",
                    minHeight: "80px",
                    outline: "none",
                  }}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); }
                    if (e.key === "Escape") setEditing(false);
                  }}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ background: "var(--surface-3)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSubmit}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ background: "var(--accent)", color: "white" }}
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            )}
            {!editing && (
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <ActionBtn onClick={handleCopy} title="Copy">
                  {copied
                    ? <Check className="size-3.5" style={{ color: "var(--success)" }} />
                    : <Copy className="size-3.5" />}
                </ActionBtn>
                {onEdit && (
                  <ActionBtn onClick={openEdit} title="Edit">
                    <Pencil className="size-3.5" />
                  </ActionBtn>
                )}
                {isLastUserWithoutReply && onRetry && (
                  <ActionBtn onClick={() => onRetry(message.id, message.content)} title="Retry">
                    <RotateCcw className="size-3.5" />
                  </ActionBtn>
                )}
                {onDelete && (
                  <ActionBtn onClick={() => setConfirmDelete(true)} title="Delete" danger>
                    <Trash2 className="size-3.5" />
                  </ActionBtn>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Assistant message ─────────────────────────────────────────────────────
  return (
    <>
      {confirmDelete && (
        <DeleteConfirmModal
          onConfirm={() => { setConfirmDelete(false); onDelete?.(message.id); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div className="flex gap-3 animate-fade-in-up">
        <AtlasAvatar />
        <div className="group flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="assistant-content min-w-0 w-full">
            <MessageMarkdown content={message.content} />
          </div>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {message.tokens_used > 0 && (
              <span className="mr-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {formatTokenCount(message.tokens_used)} tokens
              </span>
            )}
            <ActionBtn onClick={handleCopy} title="Copy">
              {copied
                ? <Check className="size-3.5" style={{ color: "var(--success)" }} />
                : <Copy className="size-3.5" />}
            </ActionBtn>
            {onDelete && (
              <ActionBtn onClick={() => setConfirmDelete(true)} title="Delete" danger>
                <Trash2 className="size-3.5" />
              </ActionBtn>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ActionBtn({ onClick, title, danger, children }: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center rounded-lg p-1.5 transition-colors"
      style={{ color: "var(--text-muted)" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = danger ? "var(--danger)" : "var(--text-primary)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
    >
      {children}
    </button>
  );
}
