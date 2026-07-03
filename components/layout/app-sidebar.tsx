"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  MessageSquare, FolderGit2, Search, Settings,
  Plus, PanelLeftClose, PanelLeft,
  Pin, PinOff, Edit2, Trash2, Check, X, Sun, Moon, Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  useConversations, useCreateConversation, useUpdateConversationTitle,
  useDeleteConversation, usePinConversation, useUnpinConversation,
} from "@/lib/hooks/use-chat";
import { useChatStore } from "@/lib/stores/chat-store";
import { formatRelativeTime } from "@/lib/utils/format";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/app/providers";
import type { ConversationOut } from "@/types/api";

const NAV = [
  { href: "/chat",   label: "New chat",     icon: MessageSquare, newChat: true },
  { href: "/repos",  label: "Repositories", icon: FolderGit2 },
  { href: "/search", label: "Search",        icon: Search },
];

const THEME_CYCLE: Array<"dark" | "light" | "system"> = ["dark", "light", "system"];
const THEME_ICONS = { dark: Moon, light: Sun, system: Monitor } as const;
const THEME_LABELS = { dark: "Dark", light: "Light", system: "System" } as const;

export function AppSidebar() {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const { data } = useConversations(limit, offset);
  const conversations = data?.conversations || [];
  const total = data?.total || 0;
  const createConversation = useCreateConversation();
  const updateTitle = useUpdateConversationTitle();
  const deleteConv = useDeleteConversation();
  const pinConv = usePinConversation();
  const unpinConv = useUnpinConversation();
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const activeId = useChatStore((s) => s.activeConversationId);
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasMore = offset + limit < total;
  const { theme, setTheme } = useTheme();
  const ThemeIcon = THEME_ICONS[theme];

  function cycleTheme() {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
    setTheme(next);
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

  /* ── Collapsed rail ─────────────────────────────────────────── */
  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center gap-1 py-3"
        style={{
          width: "var(--sidebar-collapsed, 52px)",
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <AtlasLogo size="sm" className="mb-2" />
        <IconBtn onClick={toggleSidebar} title="Expand sidebar">
          <PanelLeft className="size-[15px]" />
        </IconBtn>
        <div className="my-2 w-5 border-t" style={{ borderColor: "var(--border-subtle)" }} />
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} title={label}>
              <div
                className="flex size-8 items-center justify-center rounded-lg transition-all duration-150"
                style={active ? {
                  background: "var(--accent-subtle)",
                  color: "var(--accent-bright)",
                  boxShadow: "inset 0 0 0 1px var(--accent-border)",
                } : {
                  color: "var(--text-tertiary)",
                }}
              >
                <Icon className="size-[15px]" />
              </div>
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-1">
          <IconBtn onClick={cycleTheme} title={`Theme: ${THEME_LABELS[theme]}`}>
            <ThemeIcon className="size-[14px]" />
          </IconBtn>
        </div>
      </div>
    );
  }

  /* ── Full sidebar ───────────────────────────────────────────── */
  return (
    <div
      className="flex flex-col"
      style={{
        width: "var(--sidebar-width, 248px)",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <AtlasLogo size="sm" />
          <span
            className="text-[15px] font-semibold"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
          >
            Atlas
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn onClick={cycleTheme} title={`Theme: ${THEME_LABELS[theme]}`}>
            <ThemeIcon className="size-[13px]" />
          </IconBtn>
          <IconBtn onClick={toggleSidebar} title="Collapse sidebar">
            <PanelLeftClose className="size-[13px]" />
          </IconBtn>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2 pb-2">
        {NAV.map(({ href, label, icon: Icon, newChat }) => {
          const active = pathname.startsWith(href);
          if (newChat) {
            return (
              <button
                key={href}
                onClick={() => {
                  setActiveConversation(null);
                  createConversation.mutate(undefined, {
                    onSuccess: (data) => {
                      setActiveConversation(data.id);
                      router.push("/chat");
                    },
                  });
                }}
                className={cn("sidebar-nav-item w-full", active && "active")}
              >
                <Icon
                  className="size-[15px] shrink-0"
                  style={{ color: active ? "var(--accent-bright)" : "var(--text-tertiary)" }}
                />
                <span>{label}</span>
                {active && (
                  <div
                    className="ml-auto size-1.5 rounded-full"
                    style={{ background: "var(--accent)", boxShadow: "0 0 5px var(--accent)" }}
                  />
                )}
              </button>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn("sidebar-nav-item", active && "active")}
            >
              <Icon
                className="size-[15px] shrink-0"
                style={{ color: active ? "var(--accent-bright)" : "var(--text-tertiary)" }}
              />
              <span>{label}</span>
              {active && (
                <div
                  className="ml-auto size-1.5 rounded-full"
                  style={{ background: "var(--accent)", boxShadow: "0 0 5px var(--accent)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t" style={{ borderColor: "var(--border-subtle)" }} />

      {/* Conversations header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)", letterSpacing: "0.10em" }}
        >
          Conversations
        </span>
        <button
          onClick={() => {
            setActiveConversation(null);
            createConversation.mutate(undefined, {
              onSuccess: (data) => {
                setActiveConversation(data.id);
                router.push("/chat");
              },
            });
          }}
          className="flex size-5 items-center justify-center rounded-md transition-all"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          }}
          title="New chat"
        >
          <Plus className="size-3" />
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2" ref={scrollRef}>
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-10">
            <div
              className="flex size-8 items-center justify-center rounded-lg"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)" }}
            >
              <MessageSquare className="size-3.5" style={{ color: "var(--text-muted)" }} />
            </div>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              No conversations yet
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {conversations.map((c) => (
              <ConversationItem
                key={c.id}
                conv={c}
                active={c.id === activeId}
                editing={editingId === c.id}
                editTitle={editTitle}
                onSelect={() => { setActiveConversation(c.id); router.push("/chat"); }}
                onStartEdit={() => { setEditingId(c.id); setEditTitle(c.title); }}
                onSaveEdit={saveEdit}
                onCancelEdit={() => { setEditingId(null); setEditTitle(""); }}
                onEditTitleChange={setEditTitle}
                onDelete={() => { if (confirm("Delete this conversation?")) deleteConv.mutate(c.id); }}
                onPin={() => (c.is_pinned ? unpinConv.mutate(c.id) : pinConv.mutate(c.id))}
              />
            ))}
            {hasMore && (
              <p className="py-2 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
                Loading…
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-2 py-2" style={{ borderColor: "var(--border-subtle)" }}>
        <Link
          href="/settings/keys"
          className={cn("sidebar-nav-item", pathname.startsWith("/settings") && "active")}
        >
          <Settings
            className="size-[15px] shrink-0"
            style={{ color: pathname.startsWith("/settings") ? "var(--accent-bright)" : "var(--text-tertiary)" }}
          />
          <span>Settings</span>
        </Link>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function AtlasLogo({ size = "sm", className }: { size?: "sm" | "md"; className?: string }) {
  const s = size === "md" ? 14 : 12;
  const dim = size === "md" ? "size-9" : "size-7";
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-xl", dim, className)}
      style={{
        background: "linear-gradient(135deg, var(--accent) 0%, #6d28d9 100%)",
        boxShadow: "0 2px 8px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
      }}
    >
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.95" />
        <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
      </svg>
    </div>
  );
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex size-7 items-center justify-center rounded-md transition-all"
      style={{ color: "var(--text-muted)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
      }}
    >
      {children}
    </button>
  );
}

function ConversationItem({
  conv, active, editing, editTitle,
  onSelect, onStartEdit, onSaveEdit, onCancelEdit, onEditTitleChange, onDelete, onPin,
}: {
  conv: ConversationOut; active: boolean; editing: boolean; editTitle: string;
  onSelect: () => void; onStartEdit: () => void; onSaveEdit: () => void;
  onCancelEdit: () => void; onEditTitleChange: (v: string) => void;
  onDelete: () => void; onPin: () => void;
}) {
  return (
    <div className="group relative rounded-lg overflow-hidden">
      {/* Active left accent bar */}
      {active && (
        <div
          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
          style={{ background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }}
        />
      )}

      {editing ? (
        <div className="flex items-center gap-1 px-2 py-1.5">
          <Input
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            className="h-6 text-xs"
            autoFocus
          />
          <button onClick={onSaveEdit} className="p-0.5" style={{ color: "var(--success)" }}>
            <Check className="size-3" />
          </button>
          <button onClick={onCancelEdit} className="p-0.5" style={{ color: "var(--danger)" }}>
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={onSelect}
            className="flex flex-col items-start gap-0.5 w-full rounded-lg px-3 py-2 text-left transition-all duration-150"
            style={active ? {
              background: "var(--surface-2)",
              paddingLeft: "16px",
            } : {}}
            onMouseEnter={(e) => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
            }}
            onMouseLeave={(e) => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.background = "";
            }}
          >
            <div className="flex w-full items-center gap-1.5 min-w-0">
              {conv.is_pinned && (
                <Pin className="size-2.5 shrink-0" style={{ color: "var(--accent-bright)" }} />
              )}
              <span
                className="flex-1 truncate text-[12.5px] leading-snug"
                style={{
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {conv.title || "New conversation"}
              </span>
            </div>
            <span
              className="text-[10.5px] leading-none"
              style={{ color: "var(--text-muted)" }}
            >
              {formatRelativeTime(conv.updated_at)}
            </span>
          </button>

          {/* Hover actions */}
          <div
            className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden items-center gap-0.5 rounded-md px-0.5 py-0.5 group-hover:flex"
            style={{
              background: "var(--surface-4)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <ConvActionBtn onClick={onPin} title={conv.is_pinned ? "Unpin" : "Pin"}>
              {conv.is_pinned ? <PinOff className="size-2.5" /> : <Pin className="size-2.5" />}
            </ConvActionBtn>
            <ConvActionBtn onClick={onStartEdit} title="Rename">
              <Edit2 className="size-2.5" />
            </ConvActionBtn>
            <ConvActionBtn onClick={onDelete} title="Delete" danger>
              <Trash2 className="size-2.5" />
            </ConvActionBtn>
          </div>
        </>
      )}
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
      className={cn(
        "flex size-5 items-center justify-center rounded transition-colors",
        danger
          ? "text-[var(--text-muted)] hover:text-[var(--danger)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
      )}
    >
      {children}
    </button>
  );
}
