"use client";

import { Suspense, use } from "react";
import { DashboardView } from "@/components/workspace/dashboard-view";
import { useWorkspaces } from "@/lib/hooks/use-workspace";

function DashboardInner({ workspaceId }: { workspaceId: string }) {
  const { data: workspaces } = useWorkspaces();
  const workspace = workspaces?.find((w) => w.id === workspaceId);
  if (!workspace) return null;
  return <DashboardView workspace={workspace} />;
}

export default function WorkspaceDashboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  return (
    <Suspense fallback={null}>
      <DashboardInner workspaceId={workspaceId} />
    </Suspense>
  );
}
