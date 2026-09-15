"use client";

import { Copy, Check, RotateCcw, Pencil, Trash2, FileText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { ClarifyCard, type ClarifyPayload } from "@/components/chat/clarify-card";
import { ChatFileCard, type ChatFilePayload } from "@/components/chat/chat-file-card";
import { ChatImage, ChatImageGallery, type ChatImageItem } from "@/components/chat/chat-image";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ImageLightbox, type LightboxImage } from "@/components/ui/image-lightbox";
import { cn } from "@/lib/utils/cn";
import { formatTokenCount } from "@/lib/utils/format";
import { saveUrl } from "@/lib/utils/save-file";
import { libraryApi } from "@/lib/api/library";
import { chatImageQuery } from "@/lib/hooks/use-chat-image";
import { useChatStore } from "@/lib/stores/chat-store";
import { useViewerStore } from "@/lib/stores/viewer-store";
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
  /** `keep` lists the attachments left on the message while editing. */
  onEdit?: (id: string, newContent: string, keep?: string[]) => void;
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
  /** Which image is open full-screen, if any. */
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  /** While editing: the attachments still on the message (image keys and document ids). */
  const [kept, setKept] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

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

  // Images: the saved ones from the API, each drawn from the local preview of
  // the file just sent when this session still has it (no download at all),
  // and from a cached signed link otherwise. A message still being sent has
  // only its previews.
  const localPreviews = (zustandImages ?? []).filter((p) => !p.isDocument && p.url);
  const images: ChatImageItem[] = message.images && message.images.length > 0
    ? message.images.map((img, i) => {
        const local = localPreviews.find((p) => p.name === img.filename) ?? localPreviews[i];
        return {
          key: img.id, id: img.id, name: img.filename,
          localSrc: local?.url ?? null, width: img.width, height: img.height,
        };
      })
    : localPreviews.map((p) => ({ key: p.id, id: null, name: p.name, localSrc: p.url }));

  // Full-screen viewing draws from the same cached link the thumbnail used.
  const lightboxImages: LightboxImage[] = images.map((img) => ({
    key: img.key,
    name: img.name,
    src: img.localSrc,
    resolve: img.id ? () => queryClient.fetchQuery(chatImageQuery(img.id as string)) : undefined,
    download: () => downloadImage(img),
  }));

  async function downloadImage(img: ChatImageItem) {
    if (img.localSrc) return saveUrl(img.localSrc, img.name);
    if (!img.id) return;
    const { url, filename, revoke } = await libraryApi.downloadById("image", img.id, img.name);
    saveUrl(url, filename || img.name, revoke);
  }

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
      onEdit?.(message.id, trimmed, kept);
    }
    setEditing(false);
  }

  function openEdit() {
    setEditValue(message.content);
    // Everything attached stays with the edit unless it is removed here.
    setKept([...images.map((img) => img.key), ...displayDocs.map((doc) => doc.id)]);
    setEditing(true);
  }

  const editImages = images.filter((img) => kept.includes(img.key));
  const editDocs = displayDocs.filter((doc) => kept.includes(doc.id));
  const leftOff = images.length + displayDocs.length - editImages.length - editDocs.length;

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
          <div className="group flex w-full max-w-[82%] flex-col items-end gap-2">
            {editing ? (
              <div className="flex w-full flex-col gap-2">
                {/* One card: what stays attached, then the words */}
                <div
                  className="flex w-full flex-col gap-2.5 rounded-2xl p-3"
                  style={{ background: "var(--surface-2)", border: "1.5px solid var(--accent)" }}
                >
                  {(editImages.length > 0 || editDocs.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                      {editImages.map((img) => (
                        <ChatImage
                          key={img.key}
                          item={img}
                          variant="thumb"
                          onRemove={() => setKept((k) => k.filter((x) => x !== img.key))}
                        />
                      ))}
                      {editDocs.map((doc) => (
                        <DocChip
                          key={doc.id}
                          doc={doc}
                          onRemove={() => setKept((k) => k.filter((x) => x !== doc.id))}
                        />
                      ))}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    className="w-full resize-none overflow-hidden bg-transparent px-1 text-sm leading-relaxed"
                    style={{ color: "var(--text-primary)", minHeight: "56px", outline: "none" }}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); }
                      if (e.key === "Escape") setEditing(false);
                    }}
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  {leftOff > 0 && (
                    <span className="mr-auto text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                      {leftOff} attachment{leftOff === 1 ? "" : "s"} will be left off
                    </span>
                  )}
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
              <>
                {/* Attachments sit above the words, the way a message reads */}
                {images.length > 0 && <ChatImageGallery images={images} onOpen={setViewerIndex} />}
                {displayDocs.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {displayDocs.map((doc) => (
                      <DocChip key={doc.id} doc={doc} onOpen={doc.url ? () => openDocument(doc) : undefined} />
                    ))}
                  </div>
                )}
                {message.content && (
                  <div className="user-bubble">
                    <UserText content={message.content} />
                  </div>
                )}
              </>
            )}
            {viewerIndex !== null && lightboxImages.length > 0 && (
              <ImageLightbox
                images={lightboxImages}
                index={Math.min(viewerIndex, lightboxImages.length - 1)}
                onIndex={setViewerIndex}
                onClose={() => setViewerIndex(null)}
              />
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

/** A document on a message: openable in the viewer, or removable while editing. */
function DocChip({ doc, onOpen, onRemove }: {
  doc: { id: string; name: string; pages?: number | null };
  onOpen?: () => void;
  onRemove?: () => void;
}) {
  const ext = doc.name.includes(".") ? doc.name.split(".").pop()!.toUpperCase() : "FILE";
  const detail = doc.pages != null ? `${doc.pages} page${doc.pages === 1 ? "" : "s"} · ${ext}` : ext;
  const shell = "relative flex max-w-[260px] items-center gap-2.5 rounded-xl py-2 pl-2 pr-3 text-left";
  const style: React.CSSProperties = { background: "var(--surface-2)", border: "1px solid var(--border-default)" };
  const body = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-subtle)" }}>
        <FileText className="size-4" style={{ color: "var(--accent-bright)" }} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium" style={{ color: "var(--text-primary)" }}>{doc.name}</span>
        <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{detail}</span>
      </span>
    </>
  );

  if (onRemove) {
    return (
      <div className={shell} style={style}>
        {body}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${doc.name}`}
          title="Remove"
          className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
          style={{ background: "rgba(0,0,0,0.75)" }}
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      title={onOpen ? `Open ${doc.name}` : doc.name}
      className={cn(shell, "transition-colors", onOpen ? "hover:bg-[var(--surface-3)]" : "cursor-default")}
      style={style}
    >
      {body}
    </button>
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
