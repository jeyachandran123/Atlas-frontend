"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import {
  ArrowRight, Clock, Download, Eye, FileText, Loader2, MessageSquare, MoreHorizontal,
  Sparkles, Star, Trash2, Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BookmarkButton } from "@/components/workspace/bookmark-button";
import { workspaceApi } from "@/lib/api/workspace";
import {
  useDeleteBookmark, useWorkspaceArtifacts, useWorkspaceBookmarks, useWorkspaceDashboard,
  useWorkspaceDocuments, useWorkspaceTimeline,
} from "@/lib/hooks/use-workspace";
import { useOperationsStore } from "@/lib/stores/operations-store";
import { useViewerStore } from "@/lib/stores/viewer-store";
import type { Workspace, WorkspaceDocument } from "@/types/workspace";

const TABS = ["overview", "documents", "generated", "bookmarks", "timeline"] as const;
type Tab = (typeof TABS)[number];

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function DashboardView({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const tab = (params.get("tab") as Tab) ?? "overview";
  const wsId = workspace.id;

  const { data: dashboard, isLoading } = useWorkspaceDashboard(wsId);
  const { data: documents = [] } = useWorkspaceDocuments(wsId);
  const { data: artifacts = [] } = useWorkspaceArtifacts(wsId);
  const { data: bookmarks = [] } = useWorkspaceBookmarks(wsId);
  const { data: timeline = [] } = useWorkspaceTimeline(wsId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WorkspaceDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDeleteDocument() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await workspaceApi.deleteDocument(wsId, pendingDelete.id);
      toast.success(`${pendingDelete.filename} deleted`);
      qc.invalidateQueries({ queryKey: ["workspace-documents", wsId] });
      qc.invalidateQueries({ queryKey: ["workspace-dashboard", wsId] });
      qc.invalidateQueries({ queryKey: ["workspace-timeline", wsId] });
      setPendingDelete(null);
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setDeleting(false);
    }
  }

  // Refresh the AI summary in the background on first open if stale/empty.
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (!dashboard || refreshedRef.current) return;
    refreshedRef.current = true;
    if (!dashboard.summary && (dashboard.stats.documents || dashboard.stats.conversations)) {
      workspaceApi.refreshSummary(wsId).then(() =>
        qc.invalidateQueries({ queryKey: ["workspace-dashboard", wsId] }),
      ).catch(() => {});
    }
  }, [dashboard, wsId, qc]);

  const startOp = useOperationsStore((s) => s.start);
  const updateOp = useOperationsStore((s) => s.update);
  const finishOp = useOperationsStore((s) => s.finish);
  const openViewer = useViewerStore((s) => s.open);
  const deleteBookmark = useDeleteBookmark(wsId);

  function openBookmark(b: { target_type: string; target_id: string; note: string | null }) {
    if (b.target_type === "conversation") {
      router.push(`/w/${wsId}/c/${b.target_id}`);
    } else if (b.target_type === "document") {
      const doc = documents.find((d) => d.id === b.target_id);
      openViewer({ kind: "document", id: b.target_id, workspaceId: wsId, title: b.note ?? doc?.filename ?? "Document", filename: doc?.filename ?? b.note ?? "document", extension: doc?.extension });
    } else if (b.target_type === "artifact") {
      const art = artifacts.find((a) => a.id === b.target_id);
      openViewer({ kind: "artifact", id: b.target_id, workspaceId: wsId, title: b.note ?? art?.title ?? "Artifact", filename: art?.filename ?? "artifact", extension: art?.format });
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const opId = startOp({ kind: "upload", label: file.name, status: "uploading", workspaceId: wsId });
      try {
        const { document } = await workspaceApi.uploadDocument(wsId, file);
        // Hand off to the tray poller — progress now survives navigation.
        updateOp(opId, { status: "processing", documentId: document.id });
      } catch (e) {
        finishOp(opId, "failed", e instanceof Error ? e.message : undefined);
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    qc.invalidateQueries({ queryKey: ["workspace-documents", wsId] });
    qc.invalidateQueries({ queryKey: ["workspace-dashboard", wsId] });
    qc.invalidateQueries({ queryKey: ["workspace-timeline", wsId] });
  }

  async function newConversation() {
    const conv = await workspaceApi.startConversation(wsId);
    router.push(`/w/${wsId}/c/${conv.conversation_id}`);
  }

  async function download(id: string) {
    const { url } = await workspaceApi.downloadArtifact(id);
    window.open(url, "_blank");
  }

  function setTab(t: Tab) {
    router.replace(t === "overview" ? `/w/${wsId}` : `/w/${wsId}?tab=${t}`);
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 pb-3 pt-6">
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
          {workspace.name}
        </h1>
        {workspace.description && (
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>{workspace.description}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-8" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="relative px-3 py-2.5 text-[13px] font-medium capitalize transition-colors"
            style={{ color: tab === t ? "var(--text-primary)" : "var(--text-muted)" }}>
            {t}
            {tab === t && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: "var(--accent)" }} />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading && <Loader2 className="mx-auto mt-10 size-5 animate-spin" style={{ color: "var(--text-muted)" }} />}

        {tab === "overview" && dashboard && (
          <div className="mx-auto max-w-3xl">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Documents", value: dashboard.stats.documents ?? 0, icon: FileText },
                { label: "Conversations", value: dashboard.stats.conversations ?? 0, icon: MessageSquare },
                { label: "Generated", value: dashboard.stats.artifacts ?? 0, icon: Sparkles },
                { label: "Bookmarks", value: dashboard.stats.bookmarks ?? 0, icon: Star },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-4"
                  style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
                  <s.icon className="size-4" style={{ color: "var(--text-muted)" }} />
                  <div className="mt-2 text-[24px] font-semibold" style={{ color: "var(--text-primary)" }}>{s.value}</div>
                  <div className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* AI summary */}
            <div className="mt-4 rounded-xl p-5" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--accent-bright)" }}>
                <Sparkles className="size-3.5" /> Workspace summary
              </div>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {dashboard.summary || "Upload documents and start a conversation — your workspace summary will appear here."}
              </p>
            </div>

            {/* Suggested actions */}
            {dashboard.suggestions.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Suggested next</h3>
                <div className="flex flex-col gap-1.5">
                  {dashboard.suggestions.map((s, i) => (
                    <button key={i} onClick={newConversation}
                      className="flex items-center justify-between rounded-lg px-3.5 py-2.5 text-left text-[13px] transition-colors hover:bg-[var(--surface-2)]"
                      style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
                      {s} <ArrowRight className="size-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent activity */}
            {dashboard.recent_activity.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Recent activity</h3>
                <div className="flex flex-col gap-1">
                  {dashboard.recent_activity.map((e) => (
                    <div key={e.id} className="flex items-center gap-2.5 px-1 py-1.5 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                      <Clock className="size-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                      <span className="min-w-0 flex-1 truncate">{e.title}</span>
                      <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>{relTime(e.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "documents" && (
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{documents.length} document{documents.length === 1 ? "" : "s"}</span>
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Upload
              </Button>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
            </div>
            {documents.length === 0 ? (
              <EmptyState icon={FileText} text="No documents yet. Upload PDFs, Word, Excel, or text files to build your knowledge base." />
            ) : (
              <div className="flex flex-col gap-1.5">
                {documents.map((d) => (
                  <div key={d.id} className="group flex items-center gap-3 rounded-lg px-3.5 py-2.5"
                    style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
                    <FileText className="size-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--text-primary)" }}>{d.filename}</span>
                    <DocStatus status={d.processing_status} />
                    <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>{(d.size_bytes / 1024).toFixed(0)} KB</span>
                    <BookmarkButton workspaceId={wsId} targetType="document" targetId={d.id} note={d.filename} compact />
                    <DocumentActions workspaceId={wsId} document={d} onRequestDelete={() => setPendingDelete(d)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "generated" && (
          <div className="mx-auto max-w-3xl">
            {artifacts.length === 0 ? (
              <EmptyState icon={Sparkles} text="No generated documents yet. Use Generate inside a conversation to create PDFs, spreadsheets, and more." />
            ) : (
              <div className="flex flex-col gap-1.5">
                {artifacts.map((a) => (
                  <div key={a.id} className="group flex items-center gap-3 rounded-lg px-3.5 py-2.5"
                    style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
                    <Sparkles className="size-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <button
                      onClick={() => a.status === "ready" && openViewer({ kind: "artifact", id: a.id, workspaceId: wsId, title: a.title || a.filename, filename: a.filename, extension: a.format })}
                      className="min-w-0 flex-1 truncate text-left text-[13px]"
                      style={{ color: "var(--text-primary)", cursor: a.status === "ready" ? "pointer" : "default" }}
                      title={a.status === "ready" ? "View" : undefined}>
                      {a.title || a.filename}
                    </button>
                    <Badge variant="default">{a.format}</Badge>
                    <BookmarkButton workspaceId={wsId} targetType="artifact" targetId={a.id} note={a.title || a.filename} compact />
                    {a.status === "ready" ? (
                      <button onClick={() => download(a.id)} aria-label="Download"><Download className="size-4" style={{ color: "var(--accent)" }} /></button>
                    ) : (
                      <Badge variant={a.status === "failed" ? "error" : "pending"}>{a.status}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "bookmarks" && (
          <div className="mx-auto max-w-3xl">
            {bookmarks.length === 0 ? (
              <EmptyState icon={Star} text="No bookmarks yet. Bookmark answers, documents, or artifacts to find them fast." />
            ) : (
              <div className="flex flex-col gap-1.5">
                {bookmarks.map((b) => (
                  <div key={b.id} className="group flex items-center gap-3 rounded-lg px-3.5 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
                    style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
                    <Star className="size-4 shrink-0" style={{ color: "var(--accent)" }} />
                    <button onClick={() => openBookmark(b)}
                      className="min-w-0 flex-1 truncate text-left text-[13px]" style={{ color: "var(--text-primary)" }}>
                      {b.note || `${b.target_type} · ${b.target_id.slice(0, 8)}`}
                    </button>
                    <Badge variant="default">{b.target_type}</Badge>
                    <button onClick={() => deleteBookmark.mutate(b.id)} aria-label="Remove bookmark"
                      className="rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-3)]"
                      style={{ color: "var(--text-muted)" }}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "timeline" && (
          <div className="mx-auto max-w-3xl">
            {timeline.length === 0 ? (
              <EmptyState icon={Clock} text="Nothing has happened yet. Your workspace history will appear here." />
            ) : (
              <div className="relative flex flex-col gap-0 pl-4">
                <div className="absolute bottom-2 left-[7px] top-2 w-px" style={{ background: "var(--border-default)" }} />
                {timeline.map((e) => (
                  <div key={e.id} className="relative flex items-start gap-3 py-2">
                    <span className="absolute -left-4 top-3 size-2 rounded-full" style={{ background: "var(--accent)" }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>{e.title}</div>
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{relTime(e.created_at)} · {e.event_type.replace(/_/g, " ")}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title="Delete document?"
        description={`“${pendingDelete?.filename ?? ""}” will be permanently removed from this workspace, along with its knowledge and embeddings. This cannot be undone.`}
        confirmLabel="Delete"
        pending={deleting}
        onConfirm={confirmDeleteDocument}
      />
    </div>
  );
}

function DocumentActions({
  workspaceId,
  document: d,
  onRequestDelete,
}: {
  workspaceId: string;
  document: WorkspaceDocument;
  onRequestDelete: () => void;
}) {
  const openViewer = useViewerStore((s) => s.open);

  function view() {
    openViewer({ kind: "document", id: d.id, workspaceId, title: d.filename, filename: d.filename, extension: d.extension });
  }

  async function download() {
    try {
      const { url, filename } = await workspaceApi.documentUrl(d.id);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = filename;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("Download failed");
    }
  }

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button aria-label="Document actions"
          className="rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-3)]"
          style={{ color: "var(--text-muted)" }}>
          <MoreHorizontal className="size-4" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={6}
          className="z-50 w-40 overflow-hidden rounded-xl p-1.5 animate-scale-up"
          style={{ background: "var(--surface-overlay)", backdropFilter: "blur(24px)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-xl)" }}>
          <Dropdown.Item onSelect={view}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--surface-3)]"
            style={{ color: "var(--text-primary)" }}>
            <Eye className="size-4" /> View
          </Dropdown.Item>
          <Dropdown.Item onSelect={download}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--surface-3)]"
            style={{ color: "var(--text-primary)" }}>
            <Download className="size-4" /> Download
          </Dropdown.Item>
          <div className="my-1 h-px" style={{ background: "var(--border-subtle)" }} />
          <Dropdown.Item onSelect={onRequestDelete}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--surface-3)]"
            style={{ color: "var(--status-error)" }}>
            <Trash2 className="size-4" /> Delete
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function DocStatus({ status }: { status: string }) {
  if (status === "knowledge_ready") return <Badge variant="ready" dot>Ready</Badge>;
  if (status === "failed") return <Badge variant="error" dot>Failed</Badge>;
  if (["queued", "processing", "retrying"].includes(status)) return <Badge variant="indexing" dot>Processing…</Badge>;
  return <Badge variant="pending">{status}</Badge>;
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="mt-14 flex flex-col items-center text-center">
      <Icon className="mb-3 size-8" style={{ color: "var(--text-muted)" }} />
      <p className="max-w-sm text-[13px]" style={{ color: "var(--text-muted)" }}>{text}</p>
    </div>
  );
}
