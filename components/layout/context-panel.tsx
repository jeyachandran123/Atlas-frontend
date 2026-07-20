"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  MessageSquare, Plus, PanelLeftClose,
  Pin, PinOff, Edit2, Trash2, Check, X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  useConversations, useUpdateConversationTitle,
  useDeleteConversation, usePinConversation, useUnpinConversation,
} from "@/lib/hooks/use-chat";
import { useChatStore } from "@/lib/stores/chat-store";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ConversationOut } from "@/types/api";

/* ── Date grouping (Pinned / Today / Yesterday / Previous 7 days / Older) ── */
type ConvGroup = { label: string; items: ConversationOut[] };

function groupConversations(convs: ConversationOut[]): ConvGroup[] {
  const pinned = convs.filter((c) => c.is_pinned);
  const rest = convs.filter((c) => !c.is_pinned);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfWeek = startOfToday - 7 * 86_400_000;

  const today: ConversationOut[] = [];
  const yesterday: ConversationOut[] = [];
  const week: ConversationOut[] = [];
  const older: ConversationOut[] = [];

  for (const c of rest) {
    const t = new Date(c.updated_at).getTime();
    if (t >= startOfToday) today.push(c);
    else if (t >= startOfYesterday) yesterday.push(c);
    else if (t >= startOfWeek) week.push(c);
    else older.push(c);
  }

  const groups: ConvGroup[] = [];
  if (pinned.length) groups.push({ label: "Pinned", items: pinned });
  if (today.length) groups.push({ label: "Today", items: today });
  if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
  if (week.length) groups.push({ label: "Previous 7 days", items: week });
  if (older.length) groups.push({ label: "Older", items: older });
  return groups;
}

/**
 * V2 shell — the context panel for the Chat space.
 * Holds the conversation list and nothing else; spaces live in the rail.
 */
export function ContextPanel() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const { data } = useConversations(limit, offset);
  const conversations = data?.conversations || [];
  const total = data?.total || 0;
  const updateTitle = useUpdateConversationTitle();
  const deleteConv = useDeleteConversation();
  const pinConv = usePinConversation();
  const unpinConv = useUnpinConversation();
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const activeId = useChatStore((s) => s.activeConversationId);
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ConversationOut | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasMore = offset + limit < total;

  function newChat() {
    // ChatGPT-style: no conversation is created until the first message.
    // The backend creates one on first send; the URL adopts it mid-stream.
    setActiveConversation(null);
    router.push("/chat");
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop <= el.clientHeight + 60 && hasMore)
        setOffset((p) => p + limit);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [hasMore, limit]);

  const saveEdit = () => {
    if (editingId && editTitle.trim()) {
      updateTitle.mutate({ conversationId: editingId, title: editTitle.trim() });
      setEditingId(null);
    }
  };

  const groups = groupConversations(conversations);

  return (
    <div
      className="flex shrink-0 flex-col"
      style={{
        width: "var(--sidebar-width, 260px)",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {/* Delete confirmation — app-standard dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Delete conversation?"
        description={`“${deleteTarget?.title || "New conversation"}” and all of its messages will be permanently removed.`}
        confirmLabel="Delete"
        pending={deleteConv.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          const wasActive = deleteTarget.id === activeId;
          deleteConv.mutate(deleteTarget.id, {
            onSuccess: () => { if (wasActive) router.push("/chat"); },
            onSettled: () => setDeleteTarget(null),
          });
        }}
      />

      {/* Header: new chat + collapse */}
      <div className="flex items-center gap-1.5 px-2 pb-2 pt-3">
        <button
          onClick={newChat}
          className="ghost-btn flex h-8 flex-1 items-center gap-2 px-3 text-[12.5px] font-medium"
        >
          <Plus className="size-3.5 shrink-0" style={{ color: "var(--accent-bright)" }} />
          New chat
        </button>
        <button
          onClick={toggleSidebar}
          aria-label="Collapse conversation list"
          title="Collapse conversation list"
          className="icon-btn size-8"
        >
          <PanelLeftClose className="size-[14px]" />
        </button>
      </div>

      {/* Conversations — grouped by date */}
      <div className="flex-1 overflow-y-auto px-2 pb-2" ref={scrollRef}>
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 px-3 py-12">
            <div
              className="flex size-9 items-center justify-center rounded-xl"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)" }}
            >
              <MessageSquare className="size-4" style={{ color: "var(--text-muted)" }} />
            </div>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              No conversations yet
            </p>
            <button
              onClick={newChat}
              className="link-accent text-[12px] font-medium"
            >
              Start your first chat
            </button>
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <div key={group.label}>
                <div className="sidebar-section-label flex items-center gap-1.5">
                  {group.label === "Pinned" && (
                    <Pin className="size-2.5" style={{ color: "var(--accent-bright)" }} />
                  )}
                  {group.label}
                </div>
                <div className="flex flex-col gap-px">
                  {group.items.map((c) => (
                    <ConversationItem
                      key={c.id}
                      conv={c}
                      active={c.id === activeId}
                      editing={editingId === c.id}
                      editTitle={editTitle}
                      onSelect={() => { setActiveConversation(c.id); router.push(`/chat/${c.id}`); }}
                      onStartEdit={() => { setEditingId(c.id); setEditTitle(c.title); }}
                      onSaveEdit={saveEdit}
                      onCancelEdit={() => { setEditingId(null); setEditTitle(""); }}
                      onEditTitleChange={setEditTitle}
                      onDelete={() => setDeleteTarget(c)}
                      onPin={() => (c.is_pinned ? unpinConv.mutate(c.id) : pinConv.mutate(c.id))}
                    />
                  ))}
                </div>
              </div>
            ))}
            {hasMore && (
              <p className="py-2 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
                Loading…
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function ConversationItem({
  conv, active, editing, editTitle,
  onSelect, onStartEdit, onSaveEdit, onCancelEdit, onEditTitleChange, onDelete, onPin,
}: {
  conv: ConversationOut; active: boolean; editing: boolean; editTitle: string;
  onSelect: () => void; onStartEdit: () => void; onSaveEdit: () => void;
  onCancelEdit: () => void; onEditTitleChange: (v: string) => void;
  onDelete: () => void; onPin: () => void;
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <Input
          value={editTitle}
          onChange={(e) => onEditTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          className="h-7 text-xs"
          autoFocus
        />
        <button onClick={onSaveEdit} aria-label="Save title" className="icon-btn size-6" style={{ color: "var(--success)" }}>
          <Check className="size-3" />
        </button>
        <button onClick={onCancelEdit} aria-label="Cancel rename" className="icon-btn size-6" style={{ color: "var(--danger)" }}>
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="group relative">
      <button onClick={onSelect} className={cn("conv-item", active && "active")}>
        <span className="flex-1 truncate leading-snug">
          {conv.title || "New conversation"}
        </span>
      </button>

      {/* Hover actions — fade over the row end */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden items-center rounded-r-[9px] pl-6 pr-1.5 group-hover:flex group-focus-within:flex"
        style={{
          background: "linear-gradient(90deg, transparent, var(--surface-2) 35%)",
        }}
      >
        <div className="pointer-events-auto flex items-center gap-0.5">
          <ConvActionBtn onClick={onPin} title={conv.is_pinned ? "Unpin" : "Pin"}>
            {conv.is_pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
          </ConvActionBtn>
          <ConvActionBtn onClick={onStartEdit} title="Rename">
            <Edit2 className="size-3" />
          </ConvActionBtn>
          <ConvActionBtn onClick={onDelete} title="Delete" danger>
            <Trash2 className="size-3" />
          </ConvActionBtn>
        </div>
      </div>
    </div>
  );
}

function ConvActionBtn({
  onClick, title, danger, children,
}: {
  onClick: () => void; title: string; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      aria-label={title}
      className={cn("icon-btn size-6", danger && "danger")}
    >
      {children}
    </button>
  );
}
