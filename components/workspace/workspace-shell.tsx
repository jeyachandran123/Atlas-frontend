"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { WorkspaceContextPanel } from "@/components/workspace/workspace-context-panel";
import { DocumentViewer } from "@/components/workspace/document-viewer";
import { OperationsTray } from "@/components/workspace/operations-tray";
import { useWorkspaces } from "@/lib/hooks/use-workspace";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

/** The 3-column workspace shell: left nav · center (children) · right context. */
export function WorkspaceShell({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const { data: workspaces, isLoading } = useWorkspaces();
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);
  const workspace = workspaces?.find((w) => w.id === workspaceId);

  useEffect(() => {
    if (workspace) setActive(workspace.id);
  }, [workspace, setActive]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>Workspace not found</p>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>It may have been archived or belongs to another account.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <WorkspaceSidebar workspace={workspace} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      <WorkspaceContextPanel workspace={workspace} />
      {/* One viewer + one operations tray for the whole workspace — mounted
          at the shell so they survive page navigation within the workspace. */}
      <DocumentViewer />
      <OperationsTray />
    </div>
  );
}
