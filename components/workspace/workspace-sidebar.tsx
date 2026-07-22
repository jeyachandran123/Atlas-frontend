"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import {
  Clock, FileText, LayoutDashboard, MessageSquarePlus, MoreHorizontal, Search,
  Sparkles, Star, Trash2,
} from "lucide-react";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { WorkspaceSearch } from "@/components/workspace/workspace-search";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useDeleteConversation, useStartConversation, useWorkspaceConversations,
} from "@/lib/hooks/use-workspace";
import { cn } from "@/lib/utils/cn";
import type { Workspace, WorkspaceConversation } from "@/types/workspace";

export function WorkspaceSidebar({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: conversations = [] } = useWorkspaceConversations(workspace.id);
  const startConv = useStartConversation(workspace.id);
  const deleteConv = useDeleteConversation(workspace.id);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WorkspaceConversation | null>(null);

  const base = `/w/${workspace.id}`;
  const activeConv = pathname.includes("/c/") ? pathname.split("/c/")[1] : null;

  async function newConversation() {
    const conv = await startConv.mutateAsync("");
    router.push(`${base}/c/${conv.conversation_id}`);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const deletedId = pendingDelete.conversation_id;
    await deleteConv.mutateAsync(deletedId);
    toast.success("Conversation deleted");
    setPendingDelete(null);
    if (activeConv === deletedId) router.push(base);
  }

  const navItems = [
    { href: base, label: "Dashboard", icon: LayoutDashboard, tab: "" },
    { href: `${base}?tab=documents`, label: "Documents", icon: FileText, tab: "documents" },
    { href: `${base}?tab=generated`, label: "Generated", icon: Sparkles, tab: "generated" },
    { href: `${base}?tab=bookmarks`, label: "Bookmarks", icon: Star, tab: "bookmarks" },
    { href: `${base}?tab=timeline`, label: "Timeline", icon: Clock, tab: "timeline" },
  ];

  return (
    <div
      className="flex h-full w-[264px] shrink-0 flex-col"
      style={{ borderRight: "1px solid var(--border-subtle)", background: "var(--sidebar-bg)" }}
    >
      <div className="p-2.5">
        <WorkspaceSwitcher current={workspace} />
      </div>

      <div className="px-2.5 pb-2">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors hover:bg-[var(--surface-2)]"
          style={{ border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
        >
          <Search className="size-3.5" />
          Search workspace…
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 pb-2">
        {navItems.map((item) => {
          const isActive = !activeConv &&
            (item.tab === ""
              ? pathname === base && !pathname.includes("tab=")
              : pathname.startsWith(base));
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors",
              )}
              style={{
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                background: isActive ? "var(--surface-2)" : "transparent",
              }}
            >
              <item.icon className="size-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-2.5 my-1 h-px" style={{ background: "var(--border-subtle)" }} />

      <div className="flex items-center justify-between px-3.5 pb-1 pt-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}>
          Conversations
        </span>
        <button
          onClick={newConversation}
          disabled={startConv.isPending}
          aria-label="New conversation"
          className="rounded-md p-1 transition-colors hover:bg-[var(--surface-3)]"
          style={{ color: "var(--text-secondary)" }}
        >
          <MessageSquarePlus className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 && (
          <p className="px-2.5 py-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
            No conversations yet. Start one to ask about your documents.
          </p>
        )}
        {conversations.map((conv) => {
          const isActive = activeConv === conv.conversation_id;
          return (
            <div
              key={conv.conversation_id}
              className="group relative mb-0.5 flex items-center gap-1 rounded-lg pr-1 transition-colors"
              style={{
                background: isActive ? "var(--surface-3)" : "transparent",
                border: isActive ? "1px solid var(--border-subtle)" : "1px solid transparent",
              }}
            >
              <Link
                href={`${base}/c/${conv.conversation_id}`}
                className="min-w-0 flex-1 truncate px-2.5 py-2 text-[12.5px]"
                style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}
                title={conv.title}
              >
                {conv.title}
              </Link>
              <Dropdown.Root>
                <Dropdown.Trigger asChild>
                  <button aria-label="Conversation actions"
                    className="shrink-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100 hover:bg-[var(--surface-4)]"
                    style={{ color: "var(--text-muted)" }}
                    onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </Dropdown.Trigger>
                <Dropdown.Portal>
                  <Dropdown.Content align="end" sideOffset={4}
                    className="z-50 w-36 overflow-hidden rounded-xl p-1.5 animate-scale-up"
                    style={{ background: "var(--surface-overlay)", backdropFilter: "blur(24px)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-xl)" }}>
                    <Dropdown.Item onSelect={() => setPendingDelete(conv)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--surface-3)]"
                      style={{ color: "var(--status-error)" }}>
                      <Trash2 className="size-3.5" /> Delete
                    </Dropdown.Item>
                  </Dropdown.Content>
                </Dropdown.Portal>
              </Dropdown.Root>
            </div>
          );
        })}
      </div>

      {searchOpen && (
        <WorkspaceSearch
          workspaceId={workspace.id}
          onClose={() => setSearchOpen(false)}
        />
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete conversation?"
        description={`“${pendingDelete?.title ?? ""}” will be removed from your workspace. Its history is preserved.`}
        confirmLabel="Delete"
        pending={deleteConv.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
