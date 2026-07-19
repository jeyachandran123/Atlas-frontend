"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, PanelLeft } from "lucide-react";
import { IconRail } from "@/components/layout/icon-rail";
import { ContextPanel } from "@/components/layout/context-panel";
import { CommandPalette } from "@/components/command/command-palette";
import { ImageGalleryPanel } from "@/components/chat/image-gallery-panel";
import { useCurrentUser } from "@/lib/hooks/use-auth";
import { setAccessToken } from "@/lib/api/token-store";
import { scheduleProactiveRefresh } from "@/lib/api/client";
import { useUIStore } from "@/lib/stores/ui-store";

/**
 * Bootstraps the session on every hard navigation/refresh:
 *   1. POST /api/auth/refresh — reads the httpOnly cookie server-side,
 *      exchanges it for a fresh access token via the FastAPI backend.
 *   2. Store that access token in memory (token-store.ts).
 *   3. Fetch /auth/me to hydrate the Zustand auth store.
 *
 * If step 1 fails (no cookie / expired), redirect to /login.
 */
function useSessionBootstrap() {
  const [status, setStatus] = useState<"loading" | "ready" | "unauthenticated">("loading");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST" });
        if (!res.ok) throw new Error("no session");
        const { access_token } = await res.json();
        if (cancelled) return;
        setAccessToken(access_token);
        scheduleProactiveRefresh(); // keep token alive for the whole session
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("unauthenticated");
          router.replace("/login");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return status;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const status = useSessionBootstrap();
  const galleryOpen = useUIStore((s) => s.galleryOpen);
  const setGalleryOpen = useUIStore((s) => s.setGalleryOpen);
  const panelCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const pathname = usePathname();

  // The context panel belongs to the Chat space; other spaces get a full-width stage.
  const onChat = pathname.startsWith("/chat");
  const showPanel = onChat && !panelCollapsed;

  return (
    <SessionGate status={status}>
      <div className="relative flex h-screen bg-canvas">
        <CommandPalette />
        <IconRail />
        {showPanel && <ContextPanel />}
        {/* Always-visible re-open affordance when the list is hidden */}
        {onChat && panelCollapsed && (
          <button
            onClick={toggleSidebar}
            aria-label="Show conversations"
            title="Show conversations (Ctrl+\)"
            className="icon-btn absolute left-[60px] top-3 z-20 size-8"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <PanelLeft className="size-[15px]" />
          </button>
        )}
        {galleryOpen && <ImageGalleryPanel onClose={() => setGalleryOpen(false)} />}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </SessionGate>
  );
}

function SessionGate({ status, children }: { status: "loading" | "ready" | "unauthenticated"; children: ReactNode }) {
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--color-canvas)" }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="flex size-12 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, var(--accent), #6d28d9)",
              boxShadow: "0 0 0 1px var(--accent-border), 0 8px 32px rgba(99,102,241,0.28)",
            }}
          >
            <Loader2 className="size-5 animate-spin text-white" />
          </div>
          <p className="text-[13px] text-text-tertiary">Loading UnityWorks…</p>
        </div>
      </div>
    );
  }
  if (status === "unauthenticated") {
    return null; // redirect already in flight
  }
  return <UserHydrator>{children}</UserHydrator>;
}

function UserHydrator({ children }: { children: ReactNode }) {
  useCurrentUser();
  return <>{children}</>;
}
