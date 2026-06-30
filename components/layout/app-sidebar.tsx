"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  FolderGit2,
  Search,
  Settings,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Pin,
  PinOff,
  Edit2,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/lib/stores/ui-store";
import { 
  useConversations, 
  useCreateConversation,
  useUpdateConversationTitle,
  useDeleteConversation,
  usePinConversation,
  useUnpinConversation,
} from "@/lib/hooks/use-chat";
import { useChatStore } from "@/lib/stores/chat-store";
import { formatRelativeTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConversationOut } from "@/types/api";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/repos", label: "Repositories", icon: FolderGit2 },
  { href: "/search", label: "Search", icon: Search },
];

export function AppSidebar() {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [offset, setOffset] = useState(0);
  const limit = 15;
  const { data } = useConversations(limit, offset);
  const conversations = data?.conversations || [];
  const total = data?.total || 0;
  const createConversation = useCreateConversation();
  const updateTitle = useUpdateConversationTitle();
  const deleteConv = useDeleteConversation();
  const pinConv = usePinConversation();
  const unpinConv = useUnpinConversation();
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasMore = offset + limit < total;

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      if (scrollHeight - scrollTop <= clientHeight + 50 && hasMore) {
        setOffset((prev) => prev + limit);
      }
    };

    scrollEl.addEventListener("scroll", handleScroll);
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [hasMore, limit]);

  const startEdit = (conv: ConversationOut) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveEdit = () => {
    if (editingId && editTitle.trim()) {
      updateTitle.mutate({ conversationId: editingId, title: editTitle.trim() });
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this conversation?")) {
      deleteConv.mutate(id);
    }
  };

  const handlePin = (id: string, isPinned: boolean) => {
    if (isPinned) {
      unpinConv.mutate(id);
    } else {
      pinConv.mutate(id);
    }
  };

  if (collapsed) {
    return (
      <div className="flex w-14 flex-col items-center gap-2 border-r border-border-subtle bg-canvas py-3">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Expand sidebar">
          <PanelLeft className="size-4" />
        </Button>
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} title={label}>
            <Button variant="ghost" size="icon">
              <Icon className="size-4" />
            </Button>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="flex w-64 flex-col border-r border-border-subtle bg-canvas">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <span className="flex size-5 items-center justify-center rounded bg-signal text-[10px] font-bold text-white">
            A
          </span>
          Atlas
        </span>
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Collapse sidebar">
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-surface text-text-primary"
                  : "text-text-secondary hover:bg-surface hover:text-text-primary",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-2 flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-text-tertiary">Conversations</span>
        <button
          onClick={() => createConversation.mutate(undefined)}
          className="text-text-tertiary hover:text-text-primary"
          aria-label="New conversation"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2" ref={scrollRef}>
        {conversations.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-text-tertiary">No conversations yet</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group relative flex flex-col rounded-md transition-colors",
                  c.id === activeConversationId ? "bg-surface" : "hover:bg-surface/60",
                )}
              >
                {editingId === c.id ? (
                  <div className="flex items-center gap-1 px-2 py-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="h-6 text-xs"
                      autoFocus
                    />
                    <button onClick={saveEdit} className="text-add hover:text-add/80">
                      <Check className="size-3" />
                    </button>
                    <button onClick={cancelEdit} className="text-remove hover:text-remove/80">
                      <X className="size-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setActiveConversation(c.id)}
                      className="flex flex-1 flex-col items-start gap-0.5 px-2.5 py-2 text-left"
                    >
                      <div className="flex w-full items-center gap-1">
                        {c.is_pinned && <Pin className="size-3 flex-shrink-0 text-signal" />}
                        <span
                          className={cn(
                            "flex-1 truncate text-xs font-medium",
                            c.id === activeConversationId ? "text-text-primary" : "text-text-secondary",
                          )}
                        >
                          {c.title || "New conversation"}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-tertiary">
                        {formatRelativeTime(c.updated_at)}
                      </span>
                    </button>
                    <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                      <button
                        onClick={() => handlePin(c.id, c.is_pinned)}
                        className="rounded p-0.5 hover:bg-canvas"
                        title={c.is_pinned ? "Unpin" : "Pin"}
                      >
                        {c.is_pinned ? (
                          <PinOff className="size-3 text-text-tertiary" />
                        ) : (
                          <Pin className="size-3 text-text-tertiary" />
                        )}
                      </button>
                      <button
                        onClick={() => startEdit(c)}
                        className="rounded p-0.5 hover:bg-canvas"
                        title="Edit title"
                      >
                        <Edit2 className="size-3 text-text-tertiary" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="rounded p-0.5 hover:bg-canvas"
                        title="Delete"
                      >
                        <Trash2 className="size-3 text-remove" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {hasMore && (
              <p className="px-2.5 py-2 text-center text-[10px] text-text-tertiary">Loading more...</p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border-subtle px-2 py-2">
        <Link
          href="/settings/keys"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-text-secondary hover:bg-surface hover:text-text-primary"
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </div>
    </div>
  );
}
