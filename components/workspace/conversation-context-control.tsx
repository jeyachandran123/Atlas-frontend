"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, FileText, Layers, Loader2, Plus, Search, SquareStack, X } from "lucide-react";
import {
  useConversationDocuments, useConversationRestore, useSetConversationMode,
  useWorkspaceDocuments,
} from "@/lib/hooks/use-workspace";
import { isFailed, isProcessing, isReady } from "@/lib/documents/processing-status";
import { useViewerStore } from "@/lib/stores/viewer-store";
import { cn } from "@/lib/utils/cn";
import type { RetrievalMode, WorkspaceDocument } from "@/types/workspace";

function statusDot(status: string) {
  if (isReady(status)) return { color: "var(--status-ready)", label: "Ready" };
  if (isFailed(status)) return { color: "var(--status-error)", label: "Failed" };
  if (isProcessing(status)) return { color: "var(--status-indexing)", label: "Processing" };
  return { color: "var(--text-muted)", label: status };
}

/**
 * The conversation's retrieval control center (Objective 2/5/6). Shows the
 * mode (All / Selected), which documents participate, their processing
 * status, and lets the user search / attach / detach in Selected mode.
 * Switching mode or selection updates the scope immediately (the next
 * question uses it) without touching conversation history.
 */
export function ConversationContextControl({
  workspaceId,
  conversationId,
}: {
  workspaceId: string;
  conversationId: string;
}) {
  const { data: restore } = useConversationRestore(workspaceId, conversationId);
  const { data: allDocs = [] } = useWorkspaceDocuments(workspaceId);
  const setMode = useSetConversationMode(workspaceId, conversationId);
  const { attach, detach } = useConversationDocuments(workspaceId, conversationId);
  const openViewer = useViewerStore((s) => s.open);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const mode: RetrievalMode = restore?.retrieval_mode ?? "all";
  const selected = useMemo(() => restore?.documents ?? [], [restore]);
  const selectedIds = useMemo(() => new Set(selected.map((d) => d.id)), [selected]);
  const readyAll = allDocs.filter((d) => d.processing_status === "knowledge_ready");

  const scopeDocs = mode === "all" ? allDocs : selected;
  const readyInScope = scopeDocs.filter((d) => d.processing_status === "knowledge_ready").length;

  const addable = useMemo(
    () => allDocs.filter((d) => !selectedIds.has(d.id) &&
      d.filename.toLowerCase().includes(query.toLowerCase())),
    [allDocs, selectedIds, query],
  );

  async function switchMode(next: RetrievalMode) {
    if (next === mode) return;
    try {
      await setMode.mutateAsync(next);
      toast.success(next === "all" ? "Using all documents" : "Using selected documents");
    } catch {
      toast.error("Could not change mode");
    }
  }

  function view(d: WorkspaceDocument) {
    openViewer({ kind: "document", id: d.id, workspaceId, title: d.filename, filename: d.filename, extension: d.extension });
  }

  return (
    <div className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        Knowledge Context
      </h3>

      {/* Mode toggle */}
      <div className="mb-2.5 flex rounded-lg p-0.5" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
        {([["all", "All", Layers], ["selected", "Selected", SquareStack]] as const).map(([m, label, Icon]) => (
          <button key={m} onClick={() => switchMode(m)} disabled={setMode.isPending}
            className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition-colors")}
            style={{
              background: mode === m ? "var(--surface-3)" : "transparent",
              color: mode === m ? "var(--text-primary)" : "var(--text-muted)",
            }}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Scope indicator */}
      <div className="mb-2.5 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text-secondary)" }}>
        {setMode.isPending && <Loader2 className="size-3 animate-spin" />}
        {mode === "all" ? (
          <span>Retrieving from <strong style={{ color: "var(--text-primary)" }}>all {readyAll.length}</strong> ready document{readyAll.length === 1 ? "" : "s"}</span>
        ) : (
          <span><strong style={{ color: "var(--text-primary)" }}>{readyInScope}</strong> of {selected.length} selected document{selected.length === 1 ? "" : "s"} in scope</span>
        )}
      </div>

      {/* Document list */}
      {mode === "all" ? (
        <div className="flex flex-col gap-1">
          {readyAll.length === 0 && (
            <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>Upload documents to give the AI knowledge to draw on.</p>
          )}
          {allDocs.slice(0, 12).map((d) => (
            <DocRow key={d.id} doc={d} onView={() => view(d)} included />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            {selected.length === 0 && (
              <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                No documents selected yet — add some below, or switch to All.
              </p>
            )}
            {selected.map((d) => (
              <DocRow key={d.id} doc={d} onView={() => view(d)} included
                onDetach={async () => {
                  try { await detach.mutateAsync(d.id); toast.success(`Removed ${d.filename}`); }
                  catch { toast.error("Could not remove"); }
                }} />
            ))}
          </div>

          {/* Add documents */}
          <div className="mt-2.5">
            {!adding ? (
              <button onClick={() => setAdding(true)}
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] transition-colors hover:bg-[var(--surface-2)]"
                style={{ border: "1px dashed var(--border-default)", color: "var(--text-secondary)" }}>
                <Plus className="size-3.5" /> Add document
              </button>
            ) : (
              <div className="rounded-lg p-1.5" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
                <div className="mb-1 flex items-center gap-1.5 px-1">
                  <Search className="size-3.5" style={{ color: "var(--text-muted)" }} />
                  <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search documents…"
                    className="flex-1 bg-transparent py-1 text-[12px] outline-none" style={{ color: "var(--text-primary)" }} />
                  <button onClick={() => { setAdding(false); setQuery(""); }} aria-label="Close"><X className="size-3.5" style={{ color: "var(--text-muted)" }} /></button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {addable.length === 0 && (
                    <p className="px-2 py-2 text-[11.5px]" style={{ color: "var(--text-muted)" }}>No documents to add.</p>
                  )}
                  {addable.map((d) => (
                    <button key={d.id} onClick={async () => {
                      try { await attach.mutateAsync(d.id); toast.success(`Added ${d.filename}`); }
                      catch { toast.error("Could not add"); }
                    }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--surface-3)]"
                      style={{ color: "var(--text-secondary)" }}>
                      <FileText className="size-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                      <span className="min-w-0 flex-1 truncate">{d.filename}</span>
                      <Plus className="size-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DocRow({
  doc, onView, onDetach, included,
}: {
  doc: WorkspaceDocument;
  onView: () => void;
  onDetach?: () => void;
  included: boolean;
}) {
  const s = statusDot(doc.processing_status);
  return (
    <div className="group flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-[var(--surface-2)]">
      {included && <Check className="size-3 shrink-0" style={{ color: "var(--status-ready)" }} />}
      <button onClick={onView} className="min-w-0 flex-1 truncate text-left text-[12px] hover:underline"
        style={{ color: "var(--text-secondary)" }} title={`View ${doc.filename}`}>
        {doc.filename}
      </button>
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: s.color }} title={s.label} />
      {onDetach && (
        <button onClick={onDetach} aria-label={`Remove ${doc.filename}`}
          className="shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-3)]"
          style={{ color: "var(--text-muted)" }}>
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
