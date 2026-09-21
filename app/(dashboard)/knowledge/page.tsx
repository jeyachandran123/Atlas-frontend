"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceSkeleton } from "@/components/ui/skeleton";

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
  return <WorkspaceSkeleton />;
}
