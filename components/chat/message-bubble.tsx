"use client";

import { Copy, Check, RotateCcw, Pencil, Trash2, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { ClarifyCard, type ClarifyPayload } from "@/components/chat/clarify-card";
import { ChatFileCard, type ChatFilePayload } from "@/components/chat/chat-file-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatTokenCount } from "@/lib/utils/format";
import { useChatStore } from "@/lib/stores/chat-store";
import { useViewerStore } from "@/lib/stores/viewer-store";
import { getAccessToken } from "@/lib/api/token-store";
import type { MessageOut } from "@/types/api";

function AtlasAvatar({ streaming }: { streaming?: boolean }) {
  return (
    <div
      className="relative flex size-7 shrink-0 items-center justify-center rounded-lg"
      style={{
        background: "var(--accent-gradient)",
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
  isLast,
  onClarifySubmit,
}: {
  message: MessageOut;
  onRetry?: (id: string, content: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  isLastUserWithoutReply?: boolean;
  /** The newest message in the thread — only then is a question card live. */
  isLast?: boolean;
  onClarifySubmit?: (text: string) => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Optimistic attachments live in the store under the optimistic message's own
  // id, and only there. A persisted message takes its attachments from the API.
  //
  // This used to fall back to "the first optimistic entry in the store" for
  // any persisted user message without one of its own — which handed a single
  // attachment to every message in the conversation, including ones sent
  // before it. The API returns each message's own attachments now, so there is
  // nothing to guess.
  const zustandImages = useChatStore((s) => s.messageImages[message.id]);
  const openViewer = useViewerStore((s) => s.open);

  // For API images, we need authenticated fetch since <img> can't send Bearer tokens
  const [resolvedApiImages, setResolvedApiImages] = useState<Array<{ id: string; url: string; name: string }>>([]);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";

  useEffect(() => {
    if (!message.images || message.images.length === 0) {
      setResolvedApiImages([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      message.images.map(async (img) => {
        const token = getAccessToken();
        const res = await fetch(`${API_BASE}${img.url}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return { id: img.id, url: "", name: img.filename };
        const blob = await res.blob();
        return { id: img.id, url: URL.createObjectURL(blob), name: img.filename };
      })
    ).then((results) => {
      if (!cancelled) setResolvedApiImages(results.filter((r) => r.url));
    });
    return () => { cancelled = true; };
  }, [message.images, API_BASE]);

  // Build the image list: resolved API images > Zustand fallback (documents excluded)
  const displayImages: Array<{ id: string; url: string; name: string }> = (() => {
    if (resolvedApiImages.length > 0) return resolvedApiImages;
    if (zustandImages && zustandImages.length > 0) {
      return zustandImages
        .filter((img) => !img.isDocument)
        .map((img) => ({ id: img.id, url: img.url, name: img.name }));
    }
    return [];
  })();

  // Build the document chip list: persisted API metadata > optimistic Zustand chips
  const displayDocs: Array<{ id: string; name: string; url?: string; pages?: number | null }> = (() => {
    if (message.documents && message.documents.length > 0) {
      return message.documents.map((d) => ({
        id: d.id, name: d.filename, url: d.url, pages: d.page_count,
      }));
    }
    return (zustandImages ?? [])
      .filter((img) => img.isDocument)
      .map((d) => ({ id: d.id, name: d.name }));
  })();

  // Opens in the in-app viewer (with a Download button there). A document
  // that is still uploading has no saved copy yet, so there is nothing to open.
  function openDocument(doc: { id: string; name: string; url?: string }) {
    if (!doc.url) return;
    openViewer({ kind: "chat_document", id: doc.id, title: doc.name, filename: doc.name });
  }

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
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete message?"
          description="This message and its response will be permanently removed."
          confirmLabel="Delete"
          onConfirm={() => { setConfirmDelete(false); onDelete?.(message.id); }}
        />
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
                    style={{ background: "var(--surface-3)", color: "var(--text-muted)", border: "1px solid var(--border-default)" }}
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
              <div className="user-bubble">
                {/* Attached documents */}
                {displayDocs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {displayDocs.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => openDocument(doc)}
                        title={doc.url ? `Open ${doc.name}` : doc.name}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition-opacity hover:opacity-80"
                        style={{
                          background: "var(--surface-3)",
                          border: "1px solid var(--border-default)",
                          color: "var(--text-primary)",
                          cursor: doc.url ? "pointer" : "default",
                          maxWidth: "220px",
                        }}
                      >
                        <FileText className="size-4 shrink-0" style={{ color: "var(--accent-bright)" }} />
                        <span className="truncate font-medium">{doc.name}</span>
                        {doc.pages != null && (
                          <span style={{ color: "var(--text-muted)" }}>{doc.pages}p</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {/* Attached images */}
                {displayImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {displayImages.map((img) => (
                      <div
                        key={img.id}
                        className="relative cursor-zoom-in overflow-hidden rounded-lg transition-transform hover:scale-[1.02]"
                        onClick={() => setExpandedImage(img.url)}
                      >
                        <img
                          src={img.url}
                          alt={img.name}
                          className="object-cover rounded-lg"
                          style={{
                            maxWidth: displayImages.length === 1 ? "280px" : "140px",
                            maxHeight: displayImages.length === 1 ? "200px" : "120px",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {message.content && <UserText content={message.content} />}
              </div>
            )}
            {/* Fullscreen image viewer */}
            {expandedImage && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center cursor-zoom-out"
                style={{ background: "rgba(0,0,0,0.85)" }}
                onClick={() => setExpandedImage(null)}
              >
                <img
                  src={expandedImage}
                  alt="Expanded"
                  className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
                />
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
    <div className="flex gap-3 animate-fade-in-up">
      <AtlasAvatar />
      <div className="group flex min-w-0 flex-1 flex-col gap-1.5">
        <AssistantBody message={message} isLast={!!isLast} onClarifySubmit={onClarifySubmit} />
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {message.tokens_used > 0 && (
            <span className="mr-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {formatTokenCount(message.tokens_used)} tokens
            </span>
          )}
          {/* A question or file card is stored as JSON — copying it would hand over raw JSON. */}
          {message.agent_used !== "clarifier" && message.agent_used !== "file_artifact" && (
            <ActionBtn onClick={handleCopy} title="Copy">
              {copied
                ? <Check className="size-3.5" style={{ color: "var(--success)" }} />
                : <Copy className="size-3.5" />}
            </ActionBtn>
          )}
        </div>
      </div>
    </div>
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
      aria-label={title}
      className={`icon-btn p-1.5 ${danger ? "danger" : ""}`}
    >
      {children}
    </button>
  );
}

/** A created file, and the note written about what is inside it. */
function FileReply({ data }: { data: ChatFilePayload }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ChatFileCard data={data} />
      {data.summary && (
        <div className="assistant-content min-w-0 w-full">
          <MessageMarkdown content={data.summary} />
        </div>
      )}
    </div>
  );
}

const CHOICES_PREFIX = "Here are my choices:";

/**
 * What the user wrote — or, for answers sent from a question card, those
 * answers laid out as answers rather than as a block of arrows.
 */
function UserText({ content }: { content: string }) {
  const rows = content.startsWith(CHOICES_PREFIX)
    ? content
        .slice(CHOICES_PREFIX.length)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => /^\d+\.\s*(.*?)\s*→\s*(.+)$/.exec(l))
    : [];
  if (rows.length === 0 || rows.some((r) => !r)) {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }
  return (
    <div className="flex flex-col gap-2 py-0.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        My choices
      </p>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <span className="text-[12px] leading-snug" style={{ color: "var(--text-tertiary)" }}>{r![1]}</span>
          <span className="flex items-center gap-1.5 text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>
            <Check className="size-3.5 shrink-0" style={{ color: "var(--accent-bright)" }} />
            {r![2]}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Questions and files are stored as JSON on the message — so they survive a
 * reload intact — and drawn as cards. Everything else is markdown.
 */
function AssistantBody({
  message, isLast, onClarifySubmit,
}: {
  message: MessageOut;
  isLast: boolean;
  onClarifySubmit?: (text: string) => void;
}) {
  if (message.agent_used === "clarifier" || message.agent_used === "file_artifact") {
    let data: unknown = null;
    try {
      data = JSON.parse(message.content);
    } catch {
      data = null;
    }
    if (data && typeof data === "object") {
      return message.agent_used === "clarifier"
        ? <ClarifyCard data={data as ClarifyPayload} interactive={isLast} onSubmit={onClarifySubmit} />
        : <FileReply data={data as ChatFilePayload} />;
    }
  }
  return (
    <div className="assistant-content min-w-0 w-full">
      <MessageMarkdown content={message.content} />
    </div>
  );
}
