"use client";

import { useEffect } from "react";
import { WorkspaceSkeleton } from "@/components/ui/skeleton";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { WorkspaceContextPanel } from "@/components/workspace/workspace-context-panel";
import { WorkspaceContextSheet, WorkspaceNavDrawer } from "@/components/workspace/workspace-mobile";
import { OperationsTray } from "@/components/workspace/operations-tray";
import { UploadConfirmDialog } from "@/components/workspace/upload-confirm-dialog";
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

  if (isLoading) return <WorkspaceSkeleton />;

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
      {/* The same two columns, reachable on a screen too narrow to hold them. */}
      <WorkspaceNavDrawer workspace={workspace} />
      <WorkspaceContextSheet workspace={workspace} />
      {/* One operations tray for the whole workspace — mounted at the shell so
          it survives page navigation within the workspace. The document viewer
          is mounted once for the whole app, in the dashboard layout. */}
      <OperationsTray />
      <UploadConfirmDialog />
    </div>
  );
}
