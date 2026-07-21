"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare, FolderGit2, Search, Settings,
  Sun, Moon, Monitor, LogOut, ImageIcon, BookOpenText,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { useUIStore } from "@/lib/stores/ui-store";
import { useRepos } from "@/lib/hooks/use-repos";
import { useTheme } from "@/app/providers";
import { useLogout } from "@/lib/hooks/use-auth";

const THEME_CYCLE: Array<"dark" | "light" | "system"> = ["dark", "light", "system"];
const THEME_ICONS = { dark: Moon, light: Sun, system: Monitor } as const;
const THEME_LABELS = { dark: "Dark", light: "Light", system: "System" } as const;

/**
 * V2 shell — the icon rail. One job: switch spaces.
 * Conversation history, theme details, and account live elsewhere
 * (context panel / settings), so nothing here competes with content.
 */
export function IconRail() {
  const pathname = usePathname();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleGallery = useUIStore((s) => s.toggleGallery);
  const galleryOpen = useUIStore((s) => s.galleryOpen);
  const { theme, setTheme } = useTheme();
  const ThemeIcon = THEME_ICONS[theme];
  const logout = useLogout();

  // Global index status: pulse the Knowledge icon while any repo is indexing.
  const { data: repos = [] } = useRepos();
  const indexing = repos.some((r) => r.index_status === "indexing");

  const onChat = pathname.startsWith("/chat");

  function cycleTheme() {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length] ?? "dark";
    setTheme(next);
  }

  return (
    <TooltipProvider>
      <nav
        aria-label="Primary"
        className="flex shrink-0 flex-col items-center gap-1 py-3"
        style={{
          width: "52px",
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        {/* Wordmark */}
        <Link href="/chat" aria-label="UnityWorks home" className="mb-2">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "var(--accent-gradient)",
              boxShadow: "0 2px 8px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}
          >
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.95" />
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
            </svg>
          </div>
        </Link>

        {/* Spaces */}
        <Tooltip content={onChat ? "Toggle conversation list" : "Chat"} side="right">
          {onChat ? (
            <button onClick={toggleSidebar} aria-label="Toggle conversation list" className="rail-item-wrap">
              <RailItem icon={MessageSquare} active />
            </button>
          ) : (
            <Link href="/chat" aria-label="Chat" className="rail-item-wrap">
              <RailItem icon={MessageSquare} active={false} />
            </Link>
          )}
        </Tooltip>

        <Tooltip content={indexing ? "Knowledge — indexing…" : "Knowledge"} side="right">
          <Link href="/repos" aria-label="Knowledge" className="rail-item-wrap relative">
            <RailItem icon={FolderGit2} active={pathname.startsWith("/repos")} />
            {indexing && (
              <span
                className="absolute right-1 top-1 size-2 rounded-full"
                style={{
                  background: "var(--warning)",
                  boxShadow: "0 0 6px var(--warning)",
                  animation: "pulse-glow 2s ease-in-out infinite",
                }}
                aria-hidden
              />
            )}
          </Link>
        </Tooltip>

        <Tooltip content="Knowledge AI — documents, Q&A, generation" side="right">
          <Link href="/knowledge" aria-label="Knowledge AI" className="rail-item-wrap">
            <RailItem icon={BookOpenText} active={pathname.startsWith("/knowledge")} />
          </Link>
        </Tooltip>

        <Tooltip content="Search code" side="right">
          <Link href="/search" aria-label="Search code" className="rail-item-wrap">
            <RailItem icon={Search} active={pathname.startsWith("/search")} />
          </Link>
        </Tooltip>

        <Tooltip content="Gallery" side="right">
          <button onClick={toggleGallery} aria-label="Toggle gallery" aria-pressed={galleryOpen} className="rail-item-wrap">
            <RailItem icon={ImageIcon} active={galleryOpen} />
          </button>
        </Tooltip>

        {/* Bottom cluster */}
        <div className="mt-auto flex flex-col items-center gap-1">
          <Tooltip content={`Theme: ${THEME_LABELS[theme]}`} side="right">
            <button onClick={cycleTheme} aria-label={`Switch theme (current: ${THEME_LABELS[theme]})`} className="icon-btn size-8">
              <ThemeIcon className="size-[14px]" />
            </button>
          </Tooltip>
          <Tooltip content="Settings" side="right">
            <Link href="/settings/keys" aria-label="Settings" className="rail-item-wrap">
              <RailItem icon={Settings} active={pathname.startsWith("/settings")} />
            </Link>
          </Tooltip>
          <Tooltip content="Sign out" side="right">
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              aria-label="Sign out"
              className="icon-btn danger size-8"
            >
              <LogOut className="size-[14px]" />
            </button>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
}

function RailItem({ icon: Icon, active }: { icon: React.ElementType; active: boolean }) {
  return (
    <span className={cn("rail-item", active && "active")}>
      <Icon className="size-[15px]" />
    </span>
  );
}
