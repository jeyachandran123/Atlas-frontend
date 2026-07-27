"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2, Download, Eye, FileText, FolderOpen, Trash2, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { workspaceApi } from "@/lib/api/workspace";
import { useViewerStore } from "@/lib/stores/viewer-store";
import type { ConversationArtifact } from "@/types/workspace";

const FORMAT_LABELS: Record<string, string> = {
  pdf: "PDF", word: "Word", excel: "Excel", csv: "CSV",
  json: "JSON", markdown: "Markdown", html: "HTML",
};

function fmtBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/**
 * The generated document as it appears inside the conversation — a native chat
 * message, not a modal result. View / Download reuse the existing viewer +
 * download flow; Delete uses the full-lifecycle Generation Platform delete.
 */
export function GeneratedDocumentCard({
  workspaceId,
  artifact,
  onDeleted,
}: {
  workspaceId: string;
  artifact: ConversationArtifact;
  onDeleted?: (artifactId: string) => void;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const openViewer = useViewerStore((s) => s.open);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ready = artifact.status === "ready";
  const failed = artifact.status === "failed";
  const cancelled = artifact.status === "cancelled";
  const label = FORMAT_LABELS[artifact.format] ?? artifact.format.toUpperCase();

  function view() {
    if (!ready) return;
    openViewer({
      kind: "artifact", id: artifact.id, workspaceId,
      title: artifact.title || artifact.filename,
      filename: artifact.filename, extension: artifact.format,
    });
    void workspaceApi.recordArtifactEvent(workspaceId, artifact.id, "viewed");
    qc.invalidateQueries({ queryKey: ["workspace-timeline", workspaceId] });
  }

  async function download() {
    if (!ready) return;
    try {
      const { url, filename } = await workspaceApi.downloadArtifact(artifact.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || artifact.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      void workspaceApi.recordArtifactEvent(workspaceId, artifact.id, "downloaded");
      qc.invalidateQueries({ queryKey: ["workspace-timeline", workspaceId] });
    } catch {
      toast.error("Download failed");
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await workspaceApi.deleteArtifact(workspaceId, artifact.id);
      toast.success("Document deleted");
      onDeleted?.(artifact.id);
      qc.invalidateQueries({ queryKey: ["workspace-artifacts", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace-dashboard", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace-timeline", workspaceId] });
      if (artifact.conversation_id) {
        qc.invalidateQueries({ queryKey: ["workspace-restore", workspaceId, artifact.conversation_id] });
      }
      setConfirmOpen(false);
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      id={`gen-${artifact.id}`}
      className="scroll-mt-24 rounded-2xl rounded-bl-md p-3.5"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", maxWidth: "95%" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
        >
          <FileText className="size-5" style={{ color: "var(--accent-bright)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-[13.5px] font-semibold" style={{ color: "var(--text-primary)" }}
              title={artifact.title || artifact.filename}>
              {artifact.title || artifact.filename || "Generated document"}
            </span>
            <Badge variant="info">{label}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {ready && <span className="inline-flex items-center gap-1" style={{ color: "var(--status-ready)" }}><CheckCircle2 className="size-3" /> Completed</span>}
            {failed && <span className="inline-flex items-center gap-1" style={{ color: "var(--status-error)" }}><XCircle className="size-3" /> Failed</span>}
            {cancelled && <span className="inline-flex items-center gap-1"><XCircle className="size-3" /> Cancelled</span>}
            {ready && <span>{fmtBytes(artifact.size_bytes)}</span>}
            {artifact.created_at && <span>{fmtTime(artifact.created_at)}</span>}
            {ready && artifact.grounded && <span className="inline-flex items-center gap-1">Grounded</span>}
          </div>
          {failed && artifact.error && (
            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--status-error)" }}>{artifact.error}</p>
          )}

          {/* Actions */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {ready && (
              <>
                <ActionButton onClick={view} icon={<Eye className="size-3.5" />} label="View" primary />
                <ActionButton onClick={() => void download()} icon={<Download className="size-3.5" />} label="Download" />
                <ActionButton
                  onClick={() => { router.push(`/w/${workspaceId}`); }}
                  icon={<FolderOpen className="size-3.5" />} label="Open in Generated Documents" />
              </>
            )}
            <ActionButton
              onClick={() => setConfirmOpen(true)}
              icon={<Trash2 className="size-3.5" />} label="Delete" danger />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete generated document?"
        description="This permanently removes the document, its stored file, registry record, timeline references and bookmarks. This cannot be undone."
        confirmLabel="Delete"
        pending={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function ActionButton({
  onClick, icon, label, primary = false, danger = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors"
      style={{
        background: primary ? "var(--accent-subtle)" : "var(--surface-3)",
        border: `1px solid ${primary ? "var(--accent-border)" : "var(--border-subtle)"}`,
        color: danger ? "var(--status-error)" : primary ? "var(--accent-bright)" : "var(--text-secondary)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
