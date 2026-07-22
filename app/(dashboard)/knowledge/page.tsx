"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * The standalone Knowledge page is superseded by the Workspace experience
 * (Phase 5.5) — every document, conversation, and generated file now lives
 * inside a workspace. Redirect there.
 */
export default function KnowledgeRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/w");
  }, [router]);
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="size-5 animate-spin" style={{ color: "var(--text-muted)" }} />
    </div>
  );
}
