"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { RouteTransition } from "@/components/layout/route-transition";
import { AppShellSkeleton } from "@/components/ui/skeleton";
import { CommandPalette } from "@/components/command/command-palette";
import { DocumentViewer } from "@/components/workspace/document-viewer";
import { useCurrentUser } from "@/lib/hooks/use-auth";
import { setAccessToken } from "@/lib/api/token-store";
import { scheduleProactiveRefresh } from "@/lib/api/client";

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

  // One sidebar on every page — brand, spaces, chats and account — and the
  // page beside it. Folding the sidebar (Ctrl+\) leaves its icon strip.
  return (
    <SessionGate status={status}>
      <div className="relative flex h-screen bg-canvas">
        <CommandPalette />
        <AppSidebar />
        <main className="flex-1 overflow-hidden">
          <RouteTransition>{children}</RouteTransition>
        </main>
        {/* One file viewer for the whole app: chat, Library, workspaces. */}
        <DocumentViewer />
      </div>
    </SessionGate>
  );
}

function SessionGate({ status, children }: { status: "loading" | "ready" | "unauthenticated"; children: ReactNode }) {
  // The app's own shape while the session is restored, not a lone spinner.
  if (status === "loading") return <AppShellSkeleton />;
  if (status === "unauthenticated") {
    return null; // redirect already in flight
  }
  return <UserHydrator>{children}</UserHydrator>;
}

function UserHydrator({ children }: { children: ReactNode }) {
  useCurrentUser();
  return <>{children}</>;
}
