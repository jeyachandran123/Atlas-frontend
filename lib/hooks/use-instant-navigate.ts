"use client";

import { useCallback, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUIStore } from "@/lib/stores/ui-store";

function pathOf(href: string): string {
  return href.split(/[?#]/)[0] || "/";
}

/**
 * Navigation that answers the click at once. The next page can take a moment
 * to arrive — in development it is compiled on first visit — so the click
 * marks where it is heading, and RouteTransition shows that page's skeleton
 * straight away instead of leaving the old page on screen until then.
 */
export function useInstantNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  const setPendingHref = useUIStore((s) => s.setPendingHref);

  const begin = useCallback(
    (href: string) => {
      const target = pathOf(href);
      // Same page (e.g. new search terms): nothing to wait for, so no skeleton.
      if (target !== pathname) setPendingHref(target);
    },
    [pathname, setPendingHref],
  );

  /** Go to `href`, showing its skeleton immediately. */
  const navigate = useCallback(
    (href: string) => {
      begin(href);
      router.push(href);
    },
    [begin, router],
  );

  /** For a <Link>'s onClick — the Link navigates; this only shows the page at once. */
  const onLinkClick = useCallback(
    (e: MouseEvent, href: string) => {
      // A new-tab or new-window click leaves this page where it is.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      begin(href);
    },
    [begin],
  );

  return { navigate, onLinkClick };
}
