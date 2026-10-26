"use client";

import { Suspense, useCallback, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { WorkspaceSidebarContent } from "@/components/workspace/workspace-sidebar";
import { WorkspaceContextContent } from "@/components/workspace/workspace-context-panel";
import { useUIStore } from "@/lib/stores/ui-store";
import type { Workspace } from "@/types/workspace";

/**
 * Closes the drawer once the page has actually changed.
 *
 * It watches the query string as well as the path, because the workspace tabs
 * navigate to `?tab=documents` on the *same* pathname — a pathname-only effect
 * would leave the drawer sitting on top of the page it was asked for.
 *
 * useSearchParams() suspends, so it lives in its own component behind a
 * boundary, the way every page in this app that reads the query string does it
 * (see w/[workspaceId]/page.tsx and search/page.tsx). Without that, a build
 * can fail to prerender the route — and nothing in type-check would say so.
 *
 * It sits outside <Sheet> deliberately: Radix unmounts sheet content when
 * closed, so from inside it would only ever run as the drawer opened.
 */
function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");

  useEffect(() => {
    onNavigate();
  }, [pathname, tab, onNavigate]);

  return null;
}

/** The workspace's nav, below `md`. */
export function WorkspaceNavDrawer({ workspace }: { workspace: Workspace }) {
  const open = useUIStore((s) => s.workspaceNavOpen);
  const setOpen = useUIStore((s) => s.setWorkspaceNavOpen);
  // Stable, so the effect above fires on navigation and not on every render.
  const close = useCallback(() => setOpen(false), [setOpen]);

  return (
    <>
      <Suspense fallback={null}>
        <CloseOnNavigate onNavigate={close} />
      </Suspense>
      <Sheet open={open} onOpenChange={setOpen} side="left" title="Workspace menu" className="md:hidden">
        <WorkspaceSidebarContent workspace={workspace} />
      </Sheet>
    </>
  );
}

/**
 * The context panel, below `lg`. It is not decorative — inside a conversation
 * it becomes the retrieval control — so on a small screen it gets a route back
 * rather than being hidden, as a sheet at thumb height.
 */
export function WorkspaceContextSheet({ workspace }: { workspace: Workspace }) {
  const open = useUIStore((s) => s.workspaceContextOpen);
  const setOpen = useUIStore((s) => s.setWorkspaceContextOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen} side="bottom" title="Workspace context" className="lg:hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <WorkspaceContextContent workspace={workspace} />
      </div>
    </Sheet>
  );
}
