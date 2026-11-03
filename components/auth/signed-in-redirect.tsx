"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { refreshAccessToken } from "@/lib/api/client";

/**
 * Sends someone already signed in from the sign-in pages to the chat.
 *
 * A session cookie existing does not prove the session is alive, so it is verified
 * here, not trusted by a server redirect: the dashboard sends a failed session back
 * to /login, and with the backend down a cookie-only redirect would bounce between
 * the two forever. Any failure here simply shows the form.
 */
export function SignedInRedirect({
  mayHaveSession,
  children,
}: {
  /** A session cookie exists. Without one the form shows at once, with no check. */
  mayHaveSession: boolean;
  children: ReactNode;
}) {
  const [checking, setChecking] = useState(mayHaveSession);
  const router = useRouter();

  useEffect(() => {
    if (!mayHaveSession) return;
    let cancelled = false;
    refreshAccessToken()
      .catch(() => null)
      .then((token) => {
        if (cancelled) return;
        if (token) router.replace("/chat");
        else setChecking(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checking) return <>{children}</>;
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Checking your session">
      <Loader2 className="size-5 animate-spin" style={{ color: "var(--text-tertiary)" }} />
    </div>
  );
}
