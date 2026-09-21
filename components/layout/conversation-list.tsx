"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  MessageSquare, Pin, PinOff, Edit2, Trash2, Check, X, ArrowUp, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useInfiniteConversations, useUpdateConversationTitle,
  useDeleteConversation, usePinConversation, useUnpinConversation,
} from "@/lib/hooks/use-chat";
import { useChatStore } from "@/lib/stores/chat-store";
import { useInstantNavigate } from "@/lib/hooks/use-instant-navigate";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ConversationListSkeleton } from "@/components/ui/skeleton";
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

/** Scrolled this far down the list, offer a way back to the recent chats. */
const SHOW_RECENT_AFTER_PX = 400;
/** Start loading the next page this close to the end of the list. */
const LOAD_MORE_WITHIN_PX = 120;

/**
 * The conversations in the sidebar: pinned first, then by date, loading
 * older ones as the list is scrolled. Rename, pin and delete sit on each row.
 */
export function ConversationList() {
  const limit = 20;
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteConversations(limit);

  // Pages accumulate: reaching the end adds older chats *under* the ones
  // already shown. Offset pages can overlap when a new chat lands at the top
  // between two fetches, so the merge is de-duplicated by id.
  const conversations = useMemo(() => {
    const seen = new Set<string>();
    const out: ConversationOut[] = [];
    for (const page of data?.pages ?? []) {
      for (const c of page.conversations) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        out.push(c);
      }
    }
    return out;
  }, [data]);

  const updateTitle = useUpdateConversationTitle();
  const deleteConv = useDeleteConversation();
  const pinConv = usePinConversation();
  const unpinConv = useUnpinConversation();
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const activeId = useChatStore((s) => s.activeConversationId);
  const router = useRouter();
  const { navigate } = useInstantNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ConversationOut | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showRecent, setShowRecent] = useState(false);

  function newChat() {
    // ChatGPT-style: no conversation is created until the first message.
    setActiveConversation(null);
    navigate("/chat");
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      setShowRecent(el.scrollTop > SHOW_RECENT_AFTER_PX);
      const nearEnd = el.scrollHeight - el.scrollTop <= el.clientHeight + LOAD_MORE_WITHIN_PX;
      if (nearEnd && hasNextPage && !isFetchingNextPage) void fetchNextPage();
    };
    // Also run once now: a first page too short to fill the list produces no
    // scroll event, and would otherwise never load the rest.
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, conversations.length]);

  const saveEdit = () => {
    if (editingId && editTitle.trim()) {
      updateTitle.mutate({ conversationId: editingId, title: editTitle.trim() });
      setEditingId(null);
    }
  };

  const groups = groupConversations(conversations);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
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

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" ref={scrollRef}>
        {isLoading ? (
          // Not "No conversations yet" — they are on their way.
          <ConversationListSkeleton />
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 px-3 py-10">
            <div
              className="flex size-9 items-center justify-center rounded-xl"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)" }}
            >
              <MessageSquare className="size-4" style={{ color: "var(--text-muted)" }} />
            </div>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No conversations yet</p>
            <button onClick={newChat} className="link-accent text-[12px] font-medium">
              Start your first chat
            </button>
          </div>
        ) : (
          <>
            {groups.map((group) => (
              <div key={group.label} className="animate-fade-in">
                <p
                  className="flex select-none items-center gap-1.5 px-2.5 pb-1.5 pt-4 text-[12px] font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  {group.label}
                </p>
                <div className="flex flex-col gap-px">
                  {group.items.map((c) => (
                    <ConversationItem
                      key={c.id}
                      conv={c}
                      active={c.id === activeId}
                      editing={editingId === c.id}
                      editTitle={editTitle}
                      onSelect={() => { setActiveConversation(c.id); navigate(`/chat/${c.id}`); }}
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
            {isFetchingNextPage && (
              <div
                className="flex items-center justify-center gap-2 py-3 text-[11px] animate-fade-in"
                style={{ color: "var(--text-muted)" }}
              >
                <Loader2 className="size-3 animate-spin" /> Loading older chats…
              </div>
            )}
          </>
        )}
      </div>

      {/* Back to the recent chats, once you have scrolled away from them */}
      <button
        onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to recent chats"
        aria-hidden={!showRecent}
        tabIndex={showRecent ? 0 : -1}
        className="absolute left-1/2 top-2 z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-all duration-300 ease-out hover:brightness-125"
        style={{
          opacity: showRecent ? 1 : 0,
          transform: `translateX(-50%) translateY(${showRecent ? 0 : -8}px)`,
          pointerEvents: showRecent ? "auto" : "none",
          background: "var(--surface-2)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
          color: "var(--text-primary)",
          backdropFilter: "blur(12px)",
        }}
      >
        <ArrowUp className="size-3" /> Recent
      </button>
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
        {conv.is_pinned && <Pin className="size-3 shrink-0" style={{ color: "var(--text-muted)" }} />}
        <span className="flex-1 truncate leading-snug">{conv.title || "New conversation"}</span>
      </button>

      {/* Hover actions — fade over the row end */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden items-center rounded-r-[9px] pl-6 pr-1.5 group-hover:flex group-focus-within:flex"
        style={{ background: "linear-gradient(90deg, transparent, var(--surface-2) 35%)" }}
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
