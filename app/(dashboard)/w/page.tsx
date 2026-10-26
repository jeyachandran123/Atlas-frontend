"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceSkeleton } from "@/components/ui/skeleton";
import { useWorkspaces } from "@/lib/hooks/use-workspace";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

/** Resolves to the last-active workspace, else the default, and redirects. */
export default function WorkspaceResolverPage() {
  const router = useRouter();
  const { data: workspaces } = useWorkspaces();
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!workspaces?.length) return;
    const target =
      workspaces.find((w) => w.id === activeId) ??
      workspaces.find((w) => w.is_default) ??
      workspaces[0];
    if (target) router.replace(`/w/${target.id}`);
  }, [workspaces, activeId, router]);

  // The workspace's shape while it is found — the redirect lands on the same layout.
  return <WorkspaceSkeleton />;
}
