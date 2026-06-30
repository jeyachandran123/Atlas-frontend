"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  FolderGit2,
  Search,
  Settings,
  Plus,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUIStore } from "@/lib/stores/ui-store";
import { useConversations, useCreateConversation } from "@/lib/hooks/use-chat";
import { useChatStore } from "@/lib/stores/chat-store";
import { formatRelativeTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/repos", label: "Repositories", icon: FolderGit2 },
  { href: "/search", label: "Search", icon: Search },
];

export function AppSidebar() {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { data: conversations = [] } = useConversations();
  const createConversation = useCreateConversation();
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const activeConversationId = useChatStore((s) => s.activeConversationId);

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

      <div className="flex-1 overflow-y-auto px-2">
        {conversations.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-text-tertiary">No conversations yet</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveConversation(c.id)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors",
                  c.id === activeConversationId
                    ? "bg-surface text-text-primary"
                    : "text-text-secondary hover:bg-surface/60",
                )}
              >
                <span className="w-full truncate text-xs font-medium">{c.title || "New conversation"}</span>
                <span className="text-[10px] text-text-tertiary">{formatRelativeTime(c.updated_at)}</span>
              </button>
            ))}
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
