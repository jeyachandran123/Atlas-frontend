import { use } from "react";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  return <WorkspaceShell workspaceId={workspaceId}>{children}</WorkspaceShell>;
}
