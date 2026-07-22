"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useWorkspaces } from "@/lib/hooks/use-workspace";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

/** Resolves to the last-active workspace, else the default, and redirects. */
export default function WorkspaceResolverPage() {
  const router = useRouter();
  const { data: workspaces, isLoading } = useWorkspaces();
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    if (!workspaces?.length) return;
    const target =
      workspaces.find((w) => w.id === activeId) ??
      workspaces.find((w) => w.is_default) ??
      workspaces[0];
    if (target) router.replace(`/w/${target.id}`);
  }, [workspaces, activeId, router]);

  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="size-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      {isLoading ? null : null}
    </div>
  );
}
