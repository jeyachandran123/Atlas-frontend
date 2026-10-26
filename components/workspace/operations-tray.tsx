"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Loader2, Sparkles, X, XCircle } from "lucide-react";
import { knowledgeApi } from "@/lib/api/knowledge";
import { isFailed, isProcessing, isReady } from "@/lib/documents/processing-status";
import {
  STATUS_LABEL, useOperationsStore, type Operation,
} from "@/lib/stores/operations-store";

const KIND_ICON = { upload: FileText, generate: Sparkles, export: FileText, save: FileText };
const DONE = new Set(["completed", "failed"]);

/**
 * Floating tray showing every in-flight workspace operation. Mounted once in
 * the shell, so upload/generation/export progress stays visible across page
 * navigation. A single poller advances upload operations by reading the
 * document's real processing status.
 */
export function OperationsTray() {
  const operations = useOperationsStore((s) => s.operations);
  const update = useOperationsStore((s) => s.update);
  const finish = useOperationsStore((s) => s.finish);
  const remove = useOperationsStore((s) => s.remove);
  const qc = useQueryClient();
  const tick = useRef(0);

  // Which uploads still need watching. Keyed by id rather than by the
  // operations array itself: the array gets a new identity on every status
  // tweak, and depending on it tore down and rebuilt the interval mid-flight,
  // so a tick could be lost each time an operation advanced.
  const pendingKey = operations
    .filter((o) => o.kind === "upload" && o.documentId && !DONE.has(o.status))
    .map((o) => o.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!pendingKey) return;
    const timer = setInterval(async () => {
      tick.current += 1;
      // Read through the store rather than a captured array, so each tick sees
      // the current status instead of the one from when the effect last ran.
      const pending = useOperationsStore
        .getState()
        .operations.filter((o) => o.kind === "upload" && o.documentId && !DONE.has(o.status));
      for (const op of pending) {
        try {
          const state = await knowledgeApi.processingState(op.documentId!);
          const ps = state.processing_status;
          if (isReady(ps)) {
            finish(op.id, "completed");
            qc.invalidateQueries({ queryKey: ["workspace-documents", op.workspaceId] });
            qc.invalidateQueries({ queryKey: ["workspace-restore"] });
          } else if (isFailed(ps)) {
            finish(op.id, "failed", state.error ?? undefined);
          } else if (isProcessing(ps) && op.status !== "processing") {
            update(op.id, { status: "processing" });
          }
        } catch {
          /* transient — retry next tick */
        }
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [pendingKey, update, finish, qc]);

  if (operations.length === 0) return null;

  return (
    // On a phone it spans the width rather than hugging a corner it would
    // otherwise share with the composer.
    <div className="fixed inset-x-3 bottom-3 z-[110] flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[320px]">
      {operations.map((op) => (
        <OperationCard key={op.id} op={op} onDismiss={() => remove(op.id)} />
      ))}
    </div>
  );
}

function OperationCard({ op, onDismiss }: { op: Operation; onDismiss: () => void }) {
  const Icon = KIND_ICON[op.kind] ?? FileText;
  const done = DONE.has(op.status);
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 animate-scale-up"
      style={{ background: "var(--surface-overlay)", backdropFilter: "blur(24px)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-xl)" }}>
      <span className="shrink-0">
        {op.status === "completed" ? <CheckCircle2 className="size-4" style={{ color: "var(--status-ready)" }} />
          : op.status === "failed" ? <XCircle className="size-4" style={{ color: "var(--status-error)" }} />
          : <Loader2 className="size-4 animate-spin" style={{ color: "var(--accent)" }} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Icon className="size-3 shrink-0" style={{ color: "var(--text-muted)" }} />
          <span className="truncate text-[12.5px] font-medium" style={{ color: "var(--text-primary)" }}>{op.label}</span>
        </div>
        <div className="text-[11px]" style={{ color: op.status === "failed" ? "var(--status-error)" : "var(--text-muted)" }}>
          {STATUS_LABEL[op.status]}{op.detail ? ` · ${op.detail}` : ""}
        </div>
      </div>
      {done && (
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded-md p-1 hover:bg-[var(--surface-3)]">
          <X className="size-3.5" style={{ color: "var(--text-muted)" }} />
        </button>
      )}
    </div>
  );
}
