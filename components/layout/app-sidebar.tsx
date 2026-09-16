"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  BookOpenText, Check, ChevronsUpDown, FolderGit2, KeyRound, Library, LogOut, Monitor, Moon,
  PanelLeftClose, PanelLeftOpen, Search, SearchCode, Settings, SquarePen, Sun, X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { ConversationList } from "@/components/layout/conversation-list";
import { LogoutDialog } from "@/components/auth/logout-dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useUIStore } from "@/lib/stores/ui-store";
import { useChatStore } from "@/lib/stores/chat-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useRepos } from "@/lib/hooks/use-repos";
import { useInstantNavigate } from "@/lib/hooks/use-instant-navigate";
import { useTheme } from "@/app/providers";

const SPACES: Array<{ href: string; label: string; Icon: React.ElementType; match: string[] }> = [
  { href: "/library", label: "Library", Icon: Library, match: ["/library"] },
  { href: "/w", label: "Workspace", Icon: BookOpenText, match: ["/w", "/knowledge"] },
  { href: "/repos", label: "Knowledge", Icon: FolderGit2, match: ["/repos"] },
  { href: "/search", label: "Code search", Icon: SearchCode, match: ["/search"] },
  { href: "/settings/keys", label: "API keys", Icon: KeyRound, match: ["/settings/keys"] },
];

const THEMES = [
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "light", label: "Light", Icon: Sun },
  { id: "system", label: "System", Icon: Monitor },
] as const;

const EXPANDED_WIDTH = "var(--sidebar-width, 260px)";
const COLLAPSED_WIDTH = "60px";

/**
 * The one sidebar, on every page: the brand, the spaces, the chats, and the
 * account — the way ChatGPT lays it out. Folded, it keeps only the icons, so
 * every space stays one click away. Ctrl+\ folds it; Ctrl+K searches.
 *
 * Rendered in two places: inside <AppSidebar>'s column from `md` up, and
 * inside <MobileNavDrawer> below it. One implementation, so a space added
 * here shows up in both and the two can never drift apart.
 */
export function SidebarContent({
  variant = "sidebar",
  collapsed = false,
  onClose,
}: {
  variant?: "sidebar" | "drawer";
  /** Folded to the icon strip. Only ever true in the sidebar. */
  collapsed?: boolean;
  /** Dismisses the drawer; the sidebar ignores it. */
  onClose?: () => void;
}) {
  const toggle = useUIStore((s) => s.toggleSidebar);
  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const pathname = usePathname();
  const pendingHref = useUIStore((s) => s.pendingHref);
  const { navigate, onLinkClick } = useInstantNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Pulse the Knowledge space while any repository is indexing.
  const { data: repos = [] } = useRepos();
  const indexing = repos.some((r) => r.index_status === "indexing");

  function newChat() {
    // No API call — the backend creates the conversation on the first message.
    setActiveConversation(null);
    navigate("/chat");
  }

  // The highlight follows the click, not the page load.
  const here = pendingHref ?? pathname;
  const isActive = (match: string[]) => match.some((p) => here === p || here.startsWith(`${p}/`));

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────── */}
        {collapsed ? (
          <div className="flex justify-center pb-2 pt-3">
            <Tooltip content="Open sidebar" side="right">
              <button
                onClick={toggle}
                aria-label="Open sidebar"
                className="group relative flex size-10 items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-2)]"
              >
                <span className="transition-opacity duration-150 group-hover:opacity-0">
                  <BrandMark />
                </span>
                <PanelLeftOpen
                  className="absolute size-[18px] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{ color: "var(--text-secondary)" }}
                />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-3 pb-2 pt-3">
            <Link href="/chat" onClick={newChat} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 pl-1">
              <BrandMark />
              <span
                className="truncate text-[15.5px] font-semibold"
                style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
              >
                UnityWorks
              </span>
            </Link>
            <Tooltip content="Search  ·  Ctrl K" side="bottom">
              <button onClick={() => setPaletteOpen(true)} aria-label="Search" className="icon-btn size-8">
                <Search className="size-[17px]" />
              </button>
            </Tooltip>
            {variant === "drawer" ? (
              <button onClick={onClose} aria-label="Close menu" className="icon-btn size-8">
                <X className="size-[18px]" />
              </button>
            ) : (
              <Tooltip content="Close sidebar  ·  Ctrl \" side="bottom">
                <button onClick={toggle} aria-label="Close sidebar" className="icon-btn size-8">
                  <PanelLeftClose className="size-[17px]" />
                </button>
              </Tooltip>
            )}
          </div>
        )}

        {/* ── Spaces ─────────────────────────────────────────────────── */}
        <div className={cn("flex flex-col gap-0.5 px-2", collapsed && "items-center")}>
          <NavRow collapsed={collapsed} label="New chat" Icon={SquarePen} onClick={newChat} hint="Ctrl ⇧ O" />
          {collapsed && (
            <NavRow collapsed label="Search" Icon={Search} onClick={() => setPaletteOpen(true)} hint="Ctrl K" />
          )}
          {SPACES.map(({ href, label, Icon, match }) => (
            <NavRow
              key={href}
              collapsed={collapsed}
              label={label}
              Icon={Icon}
              href={href}
              onNavigate={(e) => onLinkClick(e, href)}
              active={isActive(match)}
              busy={href === "/repos" && indexing}
            />
          ))}
        </div>

        {/* ── Chats ──────────────────────────────────────────────────── */}
        {collapsed ? (
          <div className="flex-1" />
        ) : (
          <div className="mt-2 flex min-h-0 flex-1 flex-col">
            <ConversationList />
          </div>
        )}

        {/* ── Account ────────────────────────────────────────────────── */}
        <div className="p-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <AccountMenu collapsed={collapsed} onLogout={() => setConfirmLogout(true)} />
        </div>
      <LogoutDialog open={confirmLogout} onOpenChange={setConfirmLogout} />
    </>
  );
}

/**
 * The sidebar column — from `md` up only. Below that there is no room for
 * 260px beside the page, and <MobileNavDrawer> carries the same content.
 */
export function AppSidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <TooltipProvider>
      <nav
        aria-label="Sidebar"
        className="hidden shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out md:flex"
        style={{
          width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <SidebarContent collapsed={collapsed} />
      </nav>
    </TooltipProvider>
  );
}

function BrandMark() {
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-lg"
      style={{
        background: "var(--accent-gradient)",
        boxShadow: "0 2px 8px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
      }}
    >
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.95" />
        <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
      </svg>
    </span>
  );
}

function NavRow({
  collapsed, label, Icon, href, onClick, onNavigate, active = false, hint, busy = false,
}: {
  collapsed: boolean;
  label: string;
  Icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  /** Runs as the link is clicked, before the page arrives. */
  onNavigate?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  active?: boolean;
  hint?: string;
  busy?: boolean;
}) {
  const className = cn(
    "group relative flex items-center rounded-lg outline-none transition-colors",
    "focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]",
    collapsed ? "size-10 justify-center" : "h-9 w-full gap-3 px-2.5",
    active
      ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
      : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
  );

  const content = (
    <>
      <Icon className="size-[17px] shrink-0" />
      {!collapsed && <span className="flex-1 truncate text-left text-[13.5px] font-medium">{label}</span>}
      {!collapsed && hint && (
        <span
          className="shrink-0 text-[10.5px] opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: "var(--text-muted)" }}
        >
          {hint}
        </span>
      )}
      {busy && (
        <span
          className={cn("absolute size-1.5 rounded-full", collapsed ? "right-2 top-2" : "right-3 top-1/2 -translate-y-1/2")}
          style={{ background: "var(--warning)", boxShadow: "0 0 6px var(--warning)", animation: "pulse-glow 2s ease-in-out infinite" }}
          aria-label="Indexing"
        />
      )}
    </>
  );

  const element = href ? (
    <Link href={href} onClick={onNavigate} aria-label={label} aria-current={active ? "page" : undefined} className={className}>
      {content}
    </Link>
  ) : (
    <button onClick={onClick} aria-label={label} className={className}>
      {content}
    </button>
  );

  return collapsed ? (
    <Tooltip content={hint ? `${label}  ·  ${hint}` : label} side="right">
      {element}
    </Tooltip>
  ) : (
    element
  );
}

function AccountMenu({ collapsed, onLogout }: { collapsed: boolean; onLogout: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const { navigate } = useInstantNavigate();

  const name = user?.full_name?.trim() || user?.email?.split("@")[0] || "Account";
  const avatar = <UserAvatar name={name} src={user?.avatar_url} className="size-8 text-[12px]" />;

  return (
    // Not modal: opening the log-out dialog from a menu item must not leave
    // the page locked behind a menu that is closing.
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="Account menu"
          className={cn(
            "flex w-full items-center rounded-lg outline-none transition-colors hover:bg-[var(--surface-2)] data-[state=open]:bg-[var(--surface-2)]",
            collapsed ? "justify-center p-1.5" : "gap-2.5 px-2 py-1.5",
          )}
        >
          {avatar}
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {name}
                </span>
                <span className="block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                  {user?.email ?? ""}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            </>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={collapsed ? "right" : "top"}
          align={collapsed ? "end" : "start"}
          sideOffset={8}
          className="z-50 w-[244px] rounded-xl p-1.5 animate-scale-up"
          style={{
            background: "var(--surface-overlay)",
            backdropFilter: "blur(24px)",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          <div className="flex items-center gap-2.5 px-2 pb-2 pt-1.5">
            {avatar}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{name}</p>
              <p className="truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>{user?.email ?? ""}</p>
            </div>
          </div>
          <MenuSeparator />
          <MenuItem Icon={Settings} label="Settings" onSelect={() => navigate("/settings")} />
          <DropdownMenu.Label
            className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Theme
          </DropdownMenu.Label>
          {THEMES.map(({ id, label, Icon }) => (
            <MenuItem key={id} Icon={Icon} label={label} checked={theme === id} onSelect={() => setTheme(id)} />
          ))}
          <MenuSeparator />
          <MenuItem Icon={LogOut} label="Log out" danger onSelect={onLogout} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px" style={{ background: "var(--border-subtle)" }} />;
}

function MenuItem({
  Icon, label, onSelect, checked = false, danger = false,
}: {
  Icon: React.ElementType;
  label: string;
  onSelect: () => void;
  checked?: boolean;
  danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors",
        danger
          ? "text-[var(--danger)] data-[highlighted]:bg-[var(--danger-bg)]"
          : "text-[var(--text-secondary)] data-[highlighted]:bg-[var(--surface-3)] data-[highlighted]:text-[var(--text-primary)]",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {checked && <Check className="size-3.5" style={{ color: "var(--accent-bright)" }} />}
    </DropdownMenu.Item>
  );
}
