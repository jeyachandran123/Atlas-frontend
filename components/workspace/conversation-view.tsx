"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import {
  BookMarked, BookOpenCheck, ChevronDown, Download, FileOutput, Loader2, Paperclip,
  Pencil, SendHorizonal, ShieldAlert, ShieldCheck, Trash2, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { ASK_STAGE_LABELS, StageIndicator } from "@/components/knowledge/stage-indicator";
import { GenerateDialog } from "@/components/workspace/generate-dialog";
import { streamWorkspaceAsk, workspaceApi } from "@/lib/api/workspace";
import { useDeleteConversation, useWorkspaceDocuments } from "@/lib/hooks/use-workspace";
import type { Citation } from "@/types/workspace";

interface TurnView {
  id?: string;
  question: string;
  answer: string;
  grounded: boolean | null;
  citations: Citation[];
  refusalReason: string | null;
  error: string | null;
}

interface CtxDoc {
  id: string;
  filename: string;
  initialStatus: string;
}

const READY = "knowledge_ready";
const PROCESSING = new Set(["queued", "processing", "retrying"]);

function CitationChips({ citations }: { citations: Citation[] }) {
  return (
    <>
      {citations.map((c) => (
        <Badge key={c.source_id} variant="info"
          title={`${c.section || "document"}${c.page != null ? ` · page ${c.page}` : ""} · ${(c.confidence * 100).toFixed(0)}%`}>
          {c.source_id}{c.page != null ? ` · p.${c.page}` : ""}
        </Badge>
      ))}
    </>
  );
}

export function ConversationView({
  workspaceId,
  conversationId,
}: {
  workspaceId: string;
  conversationId: string;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const deleteConv = useDeleteConversation(workspaceId);

  const [turns, setTurns] = useState<TurnView[]>([]);
  const [contextDocs, setContextDocs] = useState<CtxDoc[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef<string | null>(null);

  // Full restore payload — the single source for initial hydration.
  const { data: restore } = useQuery({
    queryKey: ["workspace-restore", workspaceId, conversationId],
    queryFn: () => workspaceApi.restore(workspaceId, conversationId),
  });

  // Reset local session state the instant the conversation changes, so we
  // never briefly show the previous conversation's messages.
  useEffect(() => {
    hydratedRef.current = null;
    setTurns([]);
    setContextDocs([]);
    setTitle("");
    setStages([]);
    setCurrent(null);
    abortRef.current?.abort();
  }, [conversationId]);

  // Hydrate ONCE per conversation. Never rebuild turns afterwards — an
  // upload or background refetch must never wipe the live session (issue 8).
  useEffect(() => {
    if (!restore || hydratedRef.current === conversationId) return;
    hydratedRef.current = conversationId;
    setTitle(restore.title);
    setTurns(
      restore.turns.map((t) => ({
        id: t.id, question: t.question, answer: t.answer ?? "",
        grounded: t.grounded, citations: t.citations,
        refusalReason: t.status === "completed" && !t.grounded ? "no_source" : null,
        error: t.status === "failed" ? "This response could not be generated." : null,
      })),
    );
    setContextDocs(
      restore.documents.map((d) => ({
        id: d.id, filename: d.filename, initialStatus: d.processing_status,
      })),
    );
  }, [restore, conversationId]);

  // Live processing status for context docs (issue 3: a freshly uploaded doc
  // becomes usable once ready — reflected here without a refresh). The shared
  // documents query already polls only while something is processing.
  const anyProcessing = useMemo(
    () => contextDocs.some((d) => PROCESSING.has(d.initialStatus)),
    [contextDocs],
  );
  const { data: wsDocs } = useWorkspaceDocuments(anyProcessing ? workspaceId : null);
  const statusMap = useMemo(
    () => Object.fromEntries((wsDocs ?? []).map((d) => [d.id, d.processing_status])),
    [wsDocs],
  );
  const docStatus = (d: CtxDoc) => statusMap[d.id] ?? d.initialStatus;
  const contextProcessing = contextDocs.some((d) => PROCESSING.has(docStatus(d)));

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, stages]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(async () => {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    setStages([]);
    setCurrent(null);
    setTurns((t) => [...t, { question, answer: "", grounded: null, citations: [], refusalReason: null, error: null }]);

    abortRef.current = streamWorkspaceAsk(
      workspaceId, conversationId, question, null,
      (e) => {
        const patchLast = (patch: Partial<TurnView>) =>
          setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, ...patch } : turn)));
        if (e.event === "stage") {
          setStages((p) => (p.includes(e.data.stage) ? p : [...p, e.data.stage]));
          setCurrent(e.data.stage);
        } else if (e.event === "token") {
          setCurrent(null);
          setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, answer: turn.answer + e.data.text } : turn)));
        } else if (e.event === "citations") {
          patchLast({ citations: e.data.citations, grounded: e.data.grounded });
        } else if (e.event === "done") {
          patchLast({ refusalReason: e.data.refusal_reason, ...(e.data.answer ? { answer: e.data.answer } : {}) });
        } else if (e.event === "title") {
          setTitle(e.data.title);
          qc.invalidateQueries({ queryKey: ["workspace-conversations", workspaceId] });
        } else if (e.event === "error") {
          patchLast({ error: e.data.message, grounded: false });
        }
      },
      () => { setBusy(false); setCurrent(null); toast.error("The response could not be generated."); },
      () => {
        setBusy(false); setStages([]); setCurrent(null);
        qc.invalidateQueries({ queryKey: ["workspace-timeline", workspaceId] });
        qc.invalidateQueries({ queryKey: ["workspace-dashboard", workspaceId] });
      },
    );
  }, [input, busy, workspaceId, conversationId, qc]);

  // Attach documents mid-conversation — atomic upload+link+attach, dedup by id
  // so one upload is one chip (issue 10), history untouched (issue 8).
  const attachDocuments = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setUploading(true);
      for (const file of Array.from(files)) {
        try {
          const { document } = await workspaceApi.uploadDocument(workspaceId, file, conversationId);
          setContextDocs((prev) =>
            prev.some((d) => d.id === document.id)
              ? prev
              : [...prev, { id: document.id, filename: document.filename, initialStatus: document.processing_status }]);
          toast.success(`${document.filename} added — processing…`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Upload failed");
        }
      }
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
      qc.invalidateQueries({ queryKey: ["workspace-documents", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace-dashboard", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace-timeline", workspaceId] });
    },
    [workspaceId, conversationId, qc],
  );

  // Remove a document from THIS conversation only (issue 9) — stays in workspace.
  const removeContextDoc = useCallback(
    async (docId: string) => {
      const prev = contextDocs;
      setContextDocs((p) => p.filter((d) => d.id !== docId)); // optimistic
      try {
        await workspaceApi.detachDocument(workspaceId, conversationId, docId);
        toast.success("Removed from this conversation");
        qc.invalidateQueries({ queryKey: ["workspace-timeline", workspaceId] });
      } catch {
        setContextDocs(prev); // revert
        toast.error("Failed to remove document");
      }
    },
    [contextDocs, workspaceId, conversationId, qc],
  );

  async function saveTitle() {
    setEditingTitle(false);
    if (title.trim()) {
      await workspaceApi.renameConversation(workspaceId, conversationId, title.trim());
      qc.invalidateQueries({ queryKey: ["workspace-conversations", workspaceId] });
    }
  }

  async function saveAsKnowledge() {
    setSaving(true);
    try {
      await workspaceApi.saveAsKnowledge(workspaceId, conversationId);
      toast.success("Saved as knowledge — it will become searchable shortly");
      qc.invalidateQueries({ queryKey: ["workspace-documents", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace-dashboard", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace-timeline", workspaceId] });
    } catch {
      toast.error("Failed to save as knowledge");
    } finally {
      setSaving(false);
    }
  }

  async function exportAs(format: string) {
    try {
      await workspaceApi.exportConversation(workspaceId, conversationId, format);
    } catch {
      toast.error("Export failed");
    }
  }

  async function confirmDelete() {
    await deleteConv.mutateAsync(conversationId);
    toast.success("Conversation deleted");
    setDeleteOpen(false);
    router.push(`/w/${workspaceId}`);
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {editingTitle ? (
            <input
              autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle} onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          ) : (
            <button onClick={() => setEditingTitle(true)} className="group flex min-w-0 items-center gap-2 text-left">
              <span className="truncate text-[15px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                {title || "New conversation"}
              </span>
              <Pencil className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" style={{ color: "var(--text-muted)" }} />
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={saveAsKnowledge} disabled={saving || !turns.length}>
            {saving ? <Loader2 className="animate-spin" /> : <BookMarked />} Save as knowledge
          </Button>
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <Button size="sm" variant="ghost" disabled={!turns.length}>
                <Download /> Export <ChevronDown className="size-3" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content align="end" sideOffset={6}
                className="z-50 w-40 overflow-hidden rounded-xl p-1.5 animate-scale-up"
                style={{ background: "var(--surface-overlay)", backdropFilter: "blur(24px)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-xl)" }}>
                {([["markdown", "Markdown (.md)"], ["pdf", "PDF (.pdf)"], ["word", "Word (.docx)"]] as const).map(([fmt, label]) => (
                  <Dropdown.Item key={fmt} onSelect={() => exportAs(fmt)}
                    className="cursor-pointer rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--surface-3)]"
                    style={{ color: "var(--text-primary)" }}>
                    {label}
                  </Dropdown.Item>
                ))}
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
          <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}>
            <FileOutput /> Generate
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setDeleteOpen(true)} aria-label="Delete conversation"
            className="!text-[color:var(--status-error)]">
            <Trash2 />
          </Button>
        </div>
      </div>

      {/* Context documents strip (issue 9: each removable) */}
      {contextDocs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-6 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Context:</span>
          {contextDocs.map((d) => {
            const status = docStatus(d);
            const processing = PROCESSING.has(status);
            return (
              <span key={d.id}
                className="group inline-flex items-center gap-1.5 rounded-full py-0.5 pl-2.5 pr-1 text-[11px]"
                style={{ background: "var(--surface-overlay)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                {processing && <Loader2 className="size-3 animate-spin" style={{ color: "var(--accent)" }} />}
                {status === READY && <span className="size-1.5 rounded-full" style={{ background: "var(--status-ready)" }} />}
                <span className="max-w-[180px] truncate" title={d.filename}>{d.filename}</span>
                <button onClick={() => removeContextDoc(d.id)} aria-label={`Remove ${d.filename}`}
                  className="rounded-full p-0.5 opacity-40 transition-opacity hover:opacity-100">
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {turns.length === 0 && (
          <div className="mt-16 text-center">
            <BookOpenCheck className="mx-auto mb-3 size-8" style={{ color: "var(--text-muted)" }} />
            <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>Ask anything about your documents</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
              Grounded answers with citations. Attach more documents anytime — context expands, never restarts.
            </p>
          </div>
        )}
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {turns.map((turn, i) => (
            <div key={turn.id ?? i} className="flex flex-col gap-3">
              <div className="self-end rounded-2xl rounded-br-md px-4 py-2.5 text-[13.5px]"
                style={{ background: "var(--surface-3)", color: "var(--text-primary)", maxWidth: "85%" }}>
                {turn.question}
              </div>
              {i === turns.length - 1 && busy && stages.length > 0 && !turn.answer && (
                <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
                  <StageIndicator stages={stages} current={current} labels={ASK_STAGE_LABELS} />
                </div>
              )}
              {(turn.answer || turn.error) && (
                <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", maxWidth: "95%" }}>
                  {turn.error ? (
                    <p className="text-[13px]" style={{ color: "var(--status-error)" }}>{turn.error}</p>
                  ) : (
                    <MessageMarkdown content={turn.answer} />
                  )}
                  {turn.grounded !== null && !turn.error && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {turn.grounded ? (
                        <Badge variant="ready"><ShieldCheck className="size-3" /> Grounded</Badge>
                      ) : (
                        <Badge variant="pending"><ShieldAlert className="size-3" />
                          {turn.refusalReason === "unsupported_request" ? "Not supported" : "No source found"}
                        </Badge>
                      )}
                      <CitationChips citations={turn.citations} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-6 pb-5">
        {contextProcessing && (
          <p className="mx-auto mb-1.5 max-w-2xl px-1 text-[11px]" style={{ color: "var(--accent-bright)" }}>
            <Loader2 className="mr-1 inline size-3 animate-spin" />
            A document is still being processed — it becomes answerable as soon as it&apos;s ready.
          </p>
        )}
        <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl p-2"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
          <button onClick={() => fileInput.current?.click()} disabled={uploading} aria-label="Attach document"
            className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-3)] disabled:opacity-50" style={{ color: "var(--text-muted)" }}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          </button>
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => attachDocuments(e.target.files)} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }}
            rows={1}
            placeholder="Ask about your documents…"
            className="max-h-32 flex-1 resize-none bg-transparent px-1 py-1.5 text-[13.5px] outline-none"
            style={{ color: "var(--text-primary)" }}
            disabled={busy}
          />
          <Button size="icon-sm" variant="signal" onClick={() => void ask()} disabled={busy || !input.trim()} aria-label="Send">
            <SendHorizonal />
          </Button>
        </div>
      </div>

      {generateOpen && (
        <GenerateDialog workspaceId={workspaceId} conversationId={conversationId} onClose={() => setGenerateOpen(false)} />
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete conversation?"
        description="This conversation will be removed from your workspace. Its history is preserved and can be restored by support if needed."
        confirmLabel="Delete"
        pending={deleteConv.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
