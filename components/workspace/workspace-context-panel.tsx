"use client";

import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Download, FileText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListRowsSkeleton } from "@/components/ui/skeleton";
import { ConversationContextControl } from "@/components/workspace/conversation-context-control";
import { workspaceApi } from "@/lib/api/workspace";
import {
  useWorkspaceArtifacts, useWorkspaceDashboard, useWorkspaceDocuments,
} from "@/lib/hooks/use-workspace";
import { useViewerStore } from "@/lib/stores/viewer-store";
import type { Workspace } from "@/types/workspace";

function relTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

/**
 * What the workspace knows right now: its summary, documents, artifacts and
 * activity — or, inside a conversation, the retrieval control itself. Rendered
 * in the column from `lg` up and in a bottom sheet below it.
 */
export function WorkspaceContextContent({ workspace }: { workspace: Workspace }) {
  const pathname = usePathname();
  const wsId = workspace.id;
  const { data: dashboard } = useWorkspaceDashboard(wsId);
  const { data: documents = [], isLoading: documentsLoading } = useWorkspaceDocuments(wsId);
  const { data: artifacts = [], isLoading: artifactsLoading } = useWorkspaceArtifacts(wsId);
  const openViewer = useViewerStore((s) => s.open);
  const qc = useQueryClient();

  // /w/{workspaceId}/c/{conversationId}
  const conversationId = pathname.includes("/c/") ? pathname.split("/c/")[1]?.split("/")[0] ?? null : null;

  function viewArtifact(a: { id: string; title: string; filename: string; format: string }) {
    openViewer({ kind: "artifact", id: a.id, workspaceId: wsId, title: a.title || a.filename, filename: a.filename, extension: a.format });
    void workspaceApi.recordArtifactEvent(wsId, a.id, "viewed");
    qc.invalidateQueries({ queryKey: ["workspace-timeline", wsId] });
  }

  async function download(id: string) {
    const { url } = await workspaceApi.downloadArtifact(id);
    window.open(url, "_blank");
    void workspaceApi.recordArtifactEvent(wsId, id, "downloaded");
    qc.invalidateQueries({ queryKey: ["workspace-timeline", wsId] });
  }

  return (
    <>
      {/* In a conversation, the retrieval control center replaces the plain
          document list — it IS the knowledge-context control (Objective 5). */}
      {conversationId ? (
        <ConversationContextControl workspaceId={wsId} conversationId={conversationId} />
      ) : (
        <>
          <Section title="Workspace">
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {dashboard?.summary || "Ask questions and generate documents — your workspace summary appears here."}
            </p>
            {dashboard && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge variant="default">{dashboard.stats.documents ?? 0} docs</Badge>
                <Badge variant="default">{dashboard.stats.conversations ?? 0} chats</Badge>
                <Badge variant="default">{dashboard.stats.artifacts ?? 0} files</Badge>
              </div>
            )}
          </Section>

          <Section title="Documents">
            {documentsLoading ? (
              <ListRowsSkeleton rows={4} />
            ) : documents.length === 0 ? (
              <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>No documents yet.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {documents.slice(0, 8).map((d) => (
                  <button key={d.id} onClick={() => openViewer({ kind: "document", id: d.id, workspaceId: wsId, title: d.filename, filename: d.filename, extension: d.extension })}
                    className="flex items-center gap-2 rounded px-1 py-0.5 text-left text-[12px] transition-colors hover:bg-[var(--surface-2)]"
                    style={{ color: "var(--text-secondary)" }}>
                    <FileText className="size-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <span className="min-w-0 flex-1 truncate" title={d.filename}>{d.filename}</span>
                    {d.processing_status === "knowledge_ready" && (
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: "var(--status-ready)" }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      {/* Recent artifacts */}
      <Section title="Recent artifacts">
        {artifactsLoading ? (
          <ListRowsSkeleton rows={3} />
        ) : artifacts.length === 0 ? (
          <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>None generated yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {artifacts.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                <Sparkles className="size-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                <button
                  onClick={() => a.status === "ready" && viewArtifact(a)}
                  disabled={a.status !== "ready"}
                  className="min-w-0 flex-1 truncate text-left transition-colors hover:text-[var(--text-primary)] disabled:cursor-default"
                  title={a.title || a.filename}>
                  {a.title || a.filename}
                </button>
                {a.status === "ready" && (
                  <button onClick={() => download(a.id)} aria-label="Download"><Download className="size-3.5" style={{ color: "var(--accent)" }} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Activity */}
      {dashboard && dashboard.recent_activity.length > 0 && (
        <Section title="Activity">
          <div className="flex flex-col gap-1.5">
            {dashboard.recent_activity.slice(0, 6).map((e) => (
              <div key={e.id} className="flex items-start gap-2 text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
                <Clock className="mt-0.5 size-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1">{e.title}</span>
                  <span style={{ color: "var(--text-muted)" }}>{relTime(e.created_at)}</span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/** The context column — from `lg` up. Below that it opens as a bottom sheet. */
export function WorkspaceContextPanel({ workspace }: { workspace: Workspace }) {
  return (
    <aside
      className="hidden w-[280px] shrink-0 flex-col overflow-y-auto lg:flex"
      style={{ borderLeft: "1px solid var(--border-subtle)", background: "var(--sidebar-bg)" }}
    >
      <WorkspaceContextContent workspace={workspace} />
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{title}</h3>
      {children}
    </div>
  );
}
