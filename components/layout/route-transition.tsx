"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  ChatPageSkeleton, LibrarySkeleton, NewChatSkeleton, PageSkeleton, WorkspaceSkeleton,
} from "@/components/ui/skeleton";

/** Give up on a navigation that never lands rather than strand the user on a skeleton. */
const GIVE_UP_MS = 20_000;

/** The skeleton shaped like the page at `path`. */
function RouteSkeleton({ path }: { path: string }) {
  if (path === "/chat") return <NewChatSkeleton />;
  if (path.startsWith("/chat/")) return <ChatPageSkeleton />;
  if (path === "/w" || path.startsWith("/w/") || path.startsWith("/knowledge")) return <WorkspaceSkeleton />;
  if (path.startsWith("/library")) return <LibrarySkeleton />;
  return <PageSkeleton />;
}

/**
 * The page area. When a click starts a navigation (useInstantNavigate), the
 * destination's skeleton replaces the old page at once; the real page takes
 * its place the moment it arrives. The old page stays mounted underneath,
 * hidden, so nothing it holds is lost if the navigation is abandoned.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pending = useUIStore((s) => s.pendingHref);
  const setPendingHref = useUIStore((s) => s.setPendingHref);

  // The page arrived — or we went somewhere else, e.g. Back.
  useEffect(() => {
    setPendingHref(null);
  }, [pathname, setPendingHref]);

  // Already here (a click on the page we are on): nothing to wait for.
  useEffect(() => {
    if (pending === pathname) setPendingHref(null);
  }, [pending, pathname, setPendingHref]);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPendingHref(null), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [pending, setPendingHref]);

  const waiting = pending !== null && pending !== pathname;

  return (
    <>
      {waiting && <RouteSkeleton path={pending} />}
      <div hidden={waiting} className="h-full">
        {children}
      </div>
    </>
  );
}
