"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Command } from "cmdk";
import {
  MessageSquare, FolderGit2, Search as SearchIcon, Settings,
  Plus, FileCode2, ImageIcon, Moon, Sun, Monitor, Loader2, CornerDownLeft,
} from "lucide-react";
import { useConversations } from "@/lib/hooks/use-chat";
import { useRepos } from "@/lib/hooks/use-repos";
import { useSearch } from "@/lib/hooks/use-search";
import { useChatStore } from "@/lib/stores/chat-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useTheme } from "@/app/providers";
import { truncatePath } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * ⌘K command layer — navigate, act, and semantically search code from
 * anywhere. Code search reuses the exact /search API the search page calls;
 * no new backend surface.
 *
 * Global shortcuts (registered here, active across the whole dashboard):
 *   Ctrl/⌘+K       toggle palette
 *   Ctrl/⌘+Shift+O new chat
 *   Ctrl/⌘+\       toggle conversation panel (chat space)
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  const { data: convData } = useConversations();
  const conversations = convData?.conversations ?? [];
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const selectedRepoId = useChatStore((s) => s.selectedRepoId);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleGallery = useUIStore((s) => s.toggleGallery);
  const { setTheme } = useTheme();

  // Code-search scope: chat's grounded repo first, else the first ready repo.
  const { data: repos = [] } = useRepos();
  const [scopeId, setScopeId] = useState<string | null>(null);
  const effectiveScope =
    repos.find((r) => r.id === scopeId)
    ?? repos.find((r) => r.id === selectedRepoId)
    ?? repos.find((r) => r.index_status === "ready")
    ?? repos[0];

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: codeData, isFetching: searching } = useSearch(
    open && debounced.trim().length > 2 && effectiveScope
      ? { query: debounced.trim(), repo_id: effectiveScope.id, top_k: 5 }
      : null,
  );
  const codeResults = codeData?.results ?? [];

  // Global shortcuts
  useEffect(() => {
    function down(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        newChat();
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        if (pathname.startsWith("/chat")) toggleSidebar();
      }
    }
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) { setQuery(""); setDebounced(""); }
  }, [open]);

  function run(fn: () => void) {
    setOpen(false);
    fn();
  }

  function newChat() {
    // No API call — the backend creates the conversation on first message
    // and the URL adopts it (/chat → /chat/{id}) mid-stream.
    setActiveConversation(null);
    router.push("/chat");
  }

  const q = query.trim().toLowerCase();
  const matches = (label: string) => q === "" || label.toLowerCase().includes(q);

  const actions = useMemo(() => ([
    { label: "New chat", icon: Plus, kbd: "Ctrl ⇧ O", fn: newChat },
    { label: "Go to Chat", icon: MessageSquare, fn: () => router.push("/chat") },
    { label: "Go to Knowledge", icon: FolderGit2, fn: () => router.push("/repos") },
    { label: "Go to Code Search", icon: SearchIcon, fn: () => router.push("/search") },
    { label: "Go to Settings", icon: Settings, fn: () => router.push("/settings/keys") },
    { label: "Toggle gallery", icon: ImageIcon, fn: toggleGallery },
    { label: "Theme: Dark", icon: Moon, fn: () => setTheme("dark") },
    { label: "Theme: Light", icon: Sun, fn: () => setTheme("light") },
    { label: "Theme: System", icon: Monitor, fn: () => setTheme("system") },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [router, toggleGallery, setTheme]);

  const visibleActions = actions.filter((a) => matches(a.label));
  const visibleConvs = conversations
    .filter((c) => matches(c.title || "New conversation"))
    .slice(0, 6);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      shouldFilter={false}
      label="Command palette"
      overlayClassName="cmdk-overlay"
      contentClassName="cmdk-content"
    >
      <div className="cmdk-inputwrap">
        {searching
          ? <Loader2 className="size-4 shrink-0 animate-spin" style={{ color: "var(--accent-bright)" }} />
          : <SearchIcon className="size-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search commands, chats, or your code…"
          className="cmdk-input"
        />
        <kbd className="kbd">Esc</kbd>
      </div>

      {/* Code-search scope chips */}
      {repos.length > 0 && (
        <div className="cmdk-scoperow">
          <span className="cmdk-scopelabel">Code scope</span>
          {repos.slice(0, 4).map((r) => (
            <button
              key={r.id}
              onClick={() => setScopeId(r.id)}
              className={cn("cmdk-scopechip", effectiveScope?.id === r.id && "active")}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      <Command.List className="cmdk-list">
        <Command.Empty className="cmdk-empty">
          {q.length > 2 && !searching ? "No matches." : "Type to search…"}
        </Command.Empty>

        {visibleActions.length > 0 && (
          <Command.Group heading="Actions" className="cmdk-group">
            {visibleActions.map(({ label, icon: Icon, kbd, fn }) => (
              <Command.Item key={label} value={label} onSelect={() => run(fn)} className="cmdk-item">
                <Icon className="size-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                <span className="flex-1">{label}</span>
                {kbd && <kbd className="kbd">{kbd}</kbd>}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {visibleConvs.length > 0 && (
          <Command.Group heading="Conversations" className="cmdk-group">
            {visibleConvs.map((c) => (
              <Command.Item
                key={c.id}
                value={`conv-${c.id}`}
                onSelect={() => run(() => { setActiveConversation(c.id); router.push(`/chat/${c.id}`); })}
                className="cmdk-item"
              >
                <MessageSquare className="size-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                <span className="flex-1 truncate">{c.title || "New conversation"}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {codeResults.length > 0 && effectiveScope && (
          <Command.Group heading={`Code — ${effectiveScope.name}`} className="cmdk-group">
            {codeResults.map((r, i) => {
              const score = Math.round(r.score * 100);
              return (
                <Command.Item
                  key={`${r.chunk.file_path}-${r.chunk.start_line}-${i}`}
                  value={`code-${i}`}
                  onSelect={() =>
                    run(() =>
                      router.push(
                        `/search?q=${encodeURIComponent(debounced.trim())}&repo=${effectiveScope.id}`,
                      ),
                    )
                  }
                  className="cmdk-item"
                >
                  <FileCode2 className="size-4 shrink-0" style={{ color: "var(--accent-bright)" }} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
                    {truncatePath(r.chunk.file_path, 3)}
                    <span style={{ color: "var(--text-muted)" }}> :{r.chunk.start_line}</span>
                  </span>
                  <span
                    className="rounded px-1 font-mono text-[10px]"
                    style={{
                      background: "var(--surface-3)",
                      color: score >= 80 ? "var(--success)" : "var(--text-tertiary)",
                    }}
                  >
                    {score}%
                  </span>
                </Command.Item>
              );
            })}
          </Command.Group>
        )}
      </Command.List>

      <div className="cmdk-footer">
        <span className="flex items-center gap-1"><kbd className="kbd">↑↓</kbd> navigate</span>
        <span className="flex items-center gap-1"><kbd className="kbd"><CornerDownLeft className="size-2.5" /></kbd> open</span>
        <span className="ml-auto flex items-center gap-1"><kbd className="kbd">Ctrl K</kbd> close</span>
      </div>
    </Command.Dialog>
  );
}
