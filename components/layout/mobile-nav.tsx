"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, SquarePen } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarContent } from "@/components/layout/app-sidebar";
import { useUIStore } from "@/lib/stores/ui-store";
import { useChatStore } from "@/lib/stores/chat-store";
import { useInstantNavigate } from "@/lib/hooks/use-instant-navigate";

/**
 * Below `md` the sidebar cannot sit beside the page — 260px of a 400px screen
 * leaves nothing for the conversation — so it becomes a drawer, and a slim bar
 * keeps the two things worth reaching without opening it: the menu, and a new
 * chat. Everything else lives one tap away behind the menu.
 */
export function MobileTopBar() {
  const setOpen = useUIStore((s) => s.setMobileNavOpen);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const { navigate } = useInstantNavigate();

  function newChat() {
    // Same as the sidebar: the backend creates the conversation on first send.
    setActiveConversation(null);
    navigate("/chat");
  }

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-1 px-2 md:hidden"
      style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="icon-btn size-10 rounded-lg"
      >
        <Menu className="size-[20px]" />
      </button>

      <span
        className="min-w-0 flex-1 truncate text-[15px] font-semibold"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
      >
        UnityWorks
      </span>

      <button onClick={newChat} aria-label="New chat" className="icon-btn size-10 rounded-lg">
        <SquarePen className="size-[18px]" />
      </button>
    </header>
  );
}

/**
 * The sidebar as a drawer. Radix Dialog brings the focus trap, escape-to-close
 * and scroll lock with it, so the only thing left to arrange is when it shuts.
 */
export function MobileNavDrawer() {
  const open = useUIStore((s) => s.mobileNavOpen);
  const setOpen = useUIStore((s) => s.setMobileNavOpen);
  const pathname = usePathname();

  // Close once the page has changed, wherever the navigation came from — a tap
  // in the drawer, the command palette, or the back button. RouteTransition
  // clears its own pendingHref off the same signal; the two don't interact.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  return (
    <Sheet open={open} onOpenChange={setOpen} side="left" title="Navigation" className="md:hidden">
      <TooltipProvider>
        <SidebarContent variant="drawer" onClose={() => setOpen(false)} />
      </TooltipProvider>
    </Sheet>
  );
}
