"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { useCurrentUser } from "@/lib/hooks/use-auth";
import { setAccessToken } from "@/lib/api/token-store";

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

  return (
    <SessionGate status={status}>
      <div className="flex h-screen bg-canvas">
        <AppSidebar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </SessionGate>
  );
}

function SessionGate({ status, children }: { status: "loading" | "ready" | "unauthenticated"; children: ReactNode }) {
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Loader2 className="size-5 animate-spin text-text-tertiary" />
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
