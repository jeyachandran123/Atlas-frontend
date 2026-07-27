"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import {
  BookMarked, BookOpenCheck, ChevronDown, Download, Layers, Loader2,
  Paperclip, Pencil, SendHorizonal, ShieldAlert, ShieldCheck, Sparkles,
  SquareStack, Square, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import {
  ASK_STAGE_LABELS, GENERATE_STAGE_LABELS, StageIndicator,
} from "@/components/knowledge/stage-indicator";
import { BookmarkButton } from "@/components/workspace/bookmark-button";
import { GeneratedDocumentCard } from "@/components/workspace/generated-document-card";
import {
  streamWorkspaceAsk, streamWorkspaceGenerate, workspaceApi,
} from "@/lib/api/workspace";
import { useDeleteConversation, useWorkspaces } from "@/lib/hooks/use-workspace";
import { useOperationsStore } from "@/lib/stores/operations-store";
import { useUploadConfirmStore } from "@/lib/stores/upload-confirm-store";
import type { Citation, ConversationArtifact } from "@/types/workspace";

// ── Conversation items: a question→answer exchange, or a document generation.
//    Generation is a first-class message, merged with turns by time. ──────────
interface AskItem {
  kind: "ask";
  key: string;
  createdAt: number;
  id?: string;
  turnId?: string;
  question: string;
  answer: string;
  grounded: boolean | null;
  citations: Citation[];
  refusalReason: string | null;
  error: string | null;
  stages: string[];
  current: string | null;
}

interface GenItem {
  kind: "gen";
  key: string;
  createdAt: number;
  prompt: string;
  format: string;
  status: "running" | "ready" | "failed" | "cancelled";
  stages: string[];
  current: string | null;
  artifact: ConversationArtifact | null;
  error: string | null;
}

type Item = AskItem | GenItem;

const GEN_FORMATS: { value: string; label: string }[] = [
  { value: "pdf", label: "PDF" }, { value: "word", label: "Word" },
  { value: "excel", label: "Excel" }, { value: "markdown", label: "Markdown" },
  { value: "csv", label: "CSV" }, { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
];
const formatLabel = (v: string) => GEN_FORMATS.find((f) => f.value === v)?.label ?? v.toUpperCase();

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
  const startOp = useOperationsStore((s) => s.start);
  const updateOp = useOperationsStore((s) => s.update);
  const finishOp = useOperationsStore((s) => s.finish);
  const requestUpload = useUploadConfirmStore((s) => s.request);
  const { data: workspaces = [] } = useWorkspaces();
  const workspaceName = workspaces.find((w) => w.id === workspaceId)?.name ?? "this workspace";

  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [genMode, setGenMode] = useState(false);
  const [format, setFormat] = useState("pdf");
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef<string | null>(null);
  const scrolledHashRef = useRef<string | null>(null);

  // Full restore payload — the single source for initial hydration.
  const { data: restore } = useQuery({
    queryKey: ["workspace-restore", workspaceId, conversationId],
    queryFn: () => workspaceApi.restore(workspaceId, conversationId),
  });

  // Reset local session state the instant the conversation changes.
  useEffect(() => {
    hydratedRef.current = null;
    scrolledHashRef.current = null;
    setItems([]);
    setTitle("");
    abortRef.current?.abort();
  }, [conversationId]);

  const retrievalMode = restore?.retrieval_mode ?? "all";
  const contextCount = restore?.documents.length ?? 0;

  // Hydrate ONCE per conversation. Turns + generated documents are merged into
  // one chronological timeline — generation is permanent conversation history,
  // reproduced exactly as it first appeared.
  useEffect(() => {
    if (!restore || hydratedRef.current === conversationId) return;
    hydratedRef.current = conversationId;
    setTitle(restore.title);
    const askItems: Item[] = restore.turns.map((t) => ({
      kind: "ask",
      key: `ask-${t.id}`,
      createdAt: new Date(t.created_at).getTime(),
      id: t.id,
      turnId: t.id,
      question: t.question,
      answer: t.answer ?? "",
      grounded: t.grounded,
      citations: t.citations,
      refusalReason: t.status === "completed" && !t.grounded ? "no_source" : null,
      error: t.status === "failed" ? "This response could not be generated." : null,
      stages: [],
      current: null,
    }));
    const genItems: Item[] = restore.artifacts.map((a) => ({
      kind: "gen",
      key: `gen-${a.id}`,
      createdAt: new Date(a.created_at).getTime(),
      prompt: a.prompt,
      format: a.format,
      status: a.status === "ready" ? "ready" : a.status === "cancelled" ? "cancelled" : a.status === "failed" ? "failed" : "ready",
      stages: [],
      current: null,
      artifact: a,
      error: a.error,
    }));
    setItems([...askItems, ...genItems].sort((x, y) => x.createdAt - y.createdAt));
  }, [restore, conversationId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [items]);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Search → "scroll to the generated document message". The result navigates
  // here with #gen-<artifactId>; we scroll to it and flash a highlight once.
  useEffect(() => {
    if (!items.length) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash.startsWith("#gen-") || scrolledHashRef.current === hash) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    scrolledHashRef.current = hash;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.transition = "box-shadow 0.3s ease";
    el.style.boxShadow = "0 0 0 2px var(--accent-border)";
    setTimeout(() => { el.style.boxShadow = ""; }, 1800);
  }, [items]);

  const patchAsk = useCallback((key: string, patch: Partial<AskItem>) => {
    setItems((prev) => prev.map((it) => (it.kind === "ask" && it.key === key ? { ...it, ...patch } : it)));
  }, []);
  const patchGen = useCallback((key: string, patch: Partial<GenItem> | ((g: GenItem) => Partial<GenItem>)) => {
    setItems((prev) => prev.map((it) =>
      it.kind === "gen" && it.key === key ? { ...it, ...(typeof patch === "function" ? patch(it) : patch) } : it));
  }, []);

  const syncWorkspace = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["workspace-timeline", workspaceId] });
    qc.invalidateQueries({ queryKey: ["workspace-dashboard", workspaceId] });
    qc.invalidateQueries({ queryKey: ["workspace-artifacts", workspaceId] });
  }, [qc, workspaceId]);

  // ── Ask ─────────────────────────────────────────────────────────────────
  const ask = useCallback(async (question: string) => {
    const key = `ask-live-${Date.now()}`;
    setBusy(true);
    setItems((prev) => [...prev, {
      kind: "ask", key, createdAt: Date.now(), question, answer: "",
      grounded: null, citations: [], refusalReason: null, error: null,
      stages: [], current: null,
    }]);

    abortRef.current = streamWorkspaceAsk(
      workspaceId, conversationId, question, null,
      (e) => {
        if (e.event === "meta") {
          patchAsk(key, { turnId: e.data.turn_id });
        } else if (e.event === "stage") {
          setItems((prev) => prev.map((it) => (it.kind === "ask" && it.key === key
            ? { ...it, stages: it.stages.includes(e.data.stage) ? it.stages : [...it.stages, e.data.stage], current: e.data.stage }
            : it)));
        } else if (e.event === "token") {
          setItems((prev) => prev.map((it) => (it.kind === "ask" && it.key === key
            ? { ...it, current: null, answer: it.answer + e.data.text } : it)));
        } else if (e.event === "citations") {
          patchAsk(key, { citations: e.data.citations, grounded: e.data.grounded });
        } else if (e.event === "done") {
          patchAsk(key, { refusalReason: e.data.refusal_reason, current: null, ...(e.data.answer ? { answer: e.data.answer } : {}) });
        } else if (e.event === "title") {
          setTitle(e.data.title);
          qc.invalidateQueries({ queryKey: ["workspace-conversations", workspaceId] });
        } else if (e.event === "error") {
          patchAsk(key, { error: e.data.message, grounded: false, current: null });
        }
      },
      () => { setBusy(false); patchAsk(key, { current: null }); toast.error("The response could not be generated."); },
      () => { setBusy(false); patchAsk(key, { current: null }); syncWorkspace(); },
    );
  }, [workspaceId, conversationId, qc, patchAsk, syncWorkspace]);

  // ── Generate a document (native conversation capability) ──────────────────
  const generate = useCallback(async (prompt: string, fmt: string) => {
    const key = `gen-live-${Date.now()}`;
    setBusy(true);
    setItems((prev) => [...prev, {
      kind: "gen", key, createdAt: Date.now(), prompt, format: fmt,
      status: "running", stages: [], current: null, artifact: null, error: null,
    }]);
    let settled = false;

    abortRef.current = streamWorkspaceGenerate(
      workspaceId, prompt, fmt, conversationId,
      (e) => {
        if (e.event === "stage") {
          patchGen(key, (g) => ({
            stages: g.stages.includes(e.data.stage) ? g.stages : [...g.stages, e.data.stage],
            current: e.data.stage,
          }));
        } else if (e.event === "done") {
          settled = true;
          const ready = e.data.status === "ready";
          patchGen(key, {
            status: ready ? "ready" : "failed",
            current: null,
            error: e.data.error,
            artifact: {
              id: e.data.artifact_id, title: e.data.title, filename: e.data.filename,
              format: e.data.format, status: e.data.status, prompt,
              size_bytes: e.data.size_bytes, grounded: false, error: e.data.error,
              conversation_id: conversationId, created_at: new Date().toISOString(),
            },
          });
          syncWorkspace();
          qc.invalidateQueries({ queryKey: ["workspace-restore", workspaceId, conversationId] });
        } else if (e.event === "error") {
          settled = true;
          patchGen(key, { status: "failed", current: null, error: e.data.message });
        }
      },
      () => {
        setBusy(false);
        if (!settled) patchGen(key, { status: "failed", current: null, error: "Generation failed" });
      },
      () => {
        // Fires on normal completion AND on Stop (abort). If no terminal event
        // was seen, the user cancelled → show Cancelled (backend cleans up).
        setBusy(false);
        if (!settled) patchGen(key, { status: "cancelled", current: null });
        syncWorkspace();
      },
    );
  }, [workspaceId, conversationId, qc, patchGen, syncWorkspace]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    if (genMode) void generate(text, format);
    else void ask(text);
  }, [input, busy, genMode, format, generate, ask]);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

  // Upload documents mid-conversation — confirmed, then atomic upload+attach.
  const runAttach = useCallback(
    async (files: File[]) => {
      setUploading(true);
      for (const file of files) {
        const opId = startOp({ kind: "upload", label: file.name, status: "uploading", workspaceId });
        try {
          const { document } = await workspaceApi.uploadDocument(workspaceId, file, conversationId);
          updateOp(opId, { status: "processing", documentId: document.id });
          toast.success(`${document.filename} added — processing…`);
        } catch (e) {
          finishOp(opId, "failed", e instanceof Error ? e.message : undefined);
          toast.error(e instanceof Error ? e.message : "Upload failed");
        }
      }
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
      qc.invalidateQueries({ queryKey: ["workspace-restore", workspaceId, conversationId] });
      qc.invalidateQueries({ queryKey: ["workspace-documents", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace-dashboard", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace-timeline", workspaceId] });
    },
    [workspaceId, conversationId, qc, startOp, updateOp, finishOp],
  );

  const attachDocuments = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    requestUpload({ files: Array.from(files), workspaceName, onConfirm: runAttach });
  }, [requestUpload, workspaceName, runAttach]);

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

  async function exportAs(fmt: string) {
    try {
      await workspaceApi.exportConversation(workspaceId, conversationId, fmt);
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

  const hasHistory = items.length > 0;
  const removeItem = useCallback((artifactId: string) => {
    setItems((prev) => prev.filter((it) => !(it.kind === "gen" && it.artifact?.id === artifactId)));
  }, []);

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
          <BookmarkButton workspaceId={workspaceId} targetType="conversation" targetId={conversationId}
            note={title || "Conversation"} label="Bookmark" />
          <Button size="sm" variant="ghost" onClick={saveAsKnowledge} disabled={saving || !hasHistory}>
            {saving ? <Loader2 className="animate-spin" /> : <BookMarked />} Save as knowledge
          </Button>
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <Button size="sm" variant="ghost" disabled={!hasHistory}>
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
          <Button size="icon-sm" variant="ghost" onClick={() => setDeleteOpen(true)} aria-label="Delete conversation"
            className="!text-[color:var(--status-error)]">
            <Trash2 />
          </Button>
        </div>
      </div>

      {/* Compact retrieval-scope cue. */}
      <div className="flex items-center gap-2 px-6 py-1.5 text-[11px]" style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
        {retrievalMode === "all" ? (
          <><Layers className="size-3" /> Using all documents</>
        ) : (
          <><SquareStack className="size-3" /> Using {contextCount} selected document{contextCount === 1 ? "" : "s"}</>
        )}
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!hasHistory && (
          <div className="mt-16 text-center">
            <BookOpenCheck className="mx-auto mb-3 size-8" style={{ color: "var(--text-muted)" }} />
            <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>Ask anything, or generate a document</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
              Grounded answers with citations. Turn on <span style={{ color: "var(--accent-bright)" }}>Generate</span> to create a PDF, Word, Excel and more — right inside the chat.
            </p>
          </div>
        )}
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {items.map((item, i) => {
            const isLast = i === items.length - 1;
            if (item.kind === "ask") {
              return (
                <div key={item.key} className="flex flex-col gap-3">
                  <div className="self-end rounded-2xl rounded-br-md px-4 py-2.5 text-[13.5px]"
                    style={{ background: "var(--surface-3)", color: "var(--text-primary)", maxWidth: "85%" }}>
                    {item.question}
                  </div>
                  {isLast && busy && item.stages.length > 0 && !item.answer && (
                    <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
                      <StageIndicator stages={item.stages} current={item.current} labels={ASK_STAGE_LABELS} />
                    </div>
                  )}
                  {(item.answer || item.error) && (
                    <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", maxWidth: "95%" }}>
                      {item.error ? (
                        <p className="text-[13px]" style={{ color: "var(--status-error)" }}>{item.error}</p>
                      ) : (
                        <MessageMarkdown content={item.answer} />
                      )}
                      {item.grounded !== null && !item.error && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          {item.grounded ? (
                            <Badge variant="ready"><ShieldCheck className="size-3" /> Grounded</Badge>
                          ) : (
                            <Badge variant="pending"><ShieldAlert className="size-3" />
                              {item.refusalReason === "unsupported_request" ? "Not supported" : "No source found"}
                            </Badge>
                          )}
                          <CitationChips citations={item.citations} />
                          {(item.turnId ?? item.id) && item.answer && (
                            <BookmarkButton workspaceId={workspaceId} targetType="answer"
                              targetId={(item.turnId ?? item.id)!}
                              note={item.question.slice(0, 80)} label="Bookmark" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            // Generation message
            return (
              <div key={item.key} className="flex flex-col gap-3">
                <div className="flex flex-col items-end gap-1 self-end" style={{ maxWidth: "85%" }}>
                  <Badge variant="info"><Sparkles className="size-3" /> Generate · {formatLabel(item.format)}</Badge>
                  <div className="rounded-2xl rounded-br-md px-4 py-2.5 text-[13.5px]"
                    style={{ background: "var(--surface-3)", color: "var(--text-primary)" }}>
                    {item.prompt}
                  </div>
                </div>
                {item.status === "running" && (
                  <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", maxWidth: "95%" }}>
                    <div className="mb-2 flex items-center gap-2 text-[12.5px] font-medium" style={{ color: "var(--text-primary)" }}>
                      <Loader2 className="size-3.5 animate-spin" style={{ color: "var(--signal)" }} /> Preparing document…
                    </div>
                    {item.stages.length > 0
                      ? <StageIndicator stages={item.stages} current={item.current} labels={GENERATE_STAGE_LABELS} />
                      : <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>Queued…</p>}
                  </div>
                )}
                {item.status === "cancelled" && (
                  <div className="rounded-2xl rounded-bl-md px-4 py-3 text-[13px]" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)", maxWidth: "95%" }}>
                    Generation cancelled.
                  </div>
                )}
                {(item.status === "ready" || item.status === "failed") && item.artifact && (
                  <GeneratedDocumentCard workspaceId={workspaceId} artifact={item.artifact} onDeleted={removeItem} />
                )}
                {item.status === "failed" && !item.artifact && (
                  <div className="rounded-2xl rounded-bl-md px-4 py-3 text-[13px]" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", color: "var(--status-error)", maxWidth: "95%" }}>
                    {item.error ?? "Generation failed."}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Composer — the single entry point for chat AND generation */}
      <div className="px-6 pb-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 rounded-xl p-2"
          style={{ background: "var(--surface-1)", border: `1px solid ${genMode ? "var(--accent-border)" : "var(--border-default)"}`, boxShadow: "var(--shadow-sm)" }}>
          {/* Mode row: Generate toggle + document-type selector */}
          <div className="flex items-center gap-1.5 px-1">
            <button
              onClick={() => setGenMode((v) => !v)}
              disabled={busy}
              aria-pressed={genMode}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-50"
              style={{
                background: genMode ? "var(--accent-subtle)" : "var(--surface-3)",
                border: `1px solid ${genMode ? "var(--accent-border)" : "var(--border-subtle)"}`,
                color: genMode ? "var(--accent-bright)" : "var(--text-secondary)",
              }}
            >
              <Sparkles className="size-3.5" /> Generate
            </button>
            {genMode && (
              <Dropdown.Root>
                <Dropdown.Trigger asChild>
                  <button
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-50"
                    style={{ background: "var(--surface-3)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}>
                    {formatLabel(format)} <ChevronDown className="size-3" />
                  </button>
                </Dropdown.Trigger>
                <Dropdown.Portal>
                  <Dropdown.Content align="start" sideOffset={6}
                    className="z-50 w-36 overflow-hidden rounded-xl p-1.5 animate-scale-up"
                    style={{ background: "var(--surface-overlay)", backdropFilter: "blur(24px)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-xl)" }}>
                    {GEN_FORMATS.map((f) => (
                      <Dropdown.Item key={f.value} onSelect={() => setFormat(f.value)}
                        className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--surface-3)]"
                        style={{ color: "var(--text-primary)" }}>
                        {f.label}
                        {format === f.value && <span className="size-1.5 rounded-full" style={{ background: "var(--accent-bright)" }} />}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Content>
                </Dropdown.Portal>
              </Dropdown.Root>
            )}
            {genMode && (
              <span className="ml-auto pr-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                Grounded in this conversation
              </span>
            )}
          </div>

          {/* Input row */}
          <div className="flex items-end gap-2">
            <button onClick={() => fileInput.current?.click()} disabled={uploading || busy} aria-label="Attach document"
              className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-3)] disabled:opacity-50" style={{ color: "var(--text-muted)" }}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            </button>
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => attachDocuments(e.target.files)} />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder={genMode ? `Describe the ${formatLabel(format)} to generate…` : "Ask about your documents…"}
              className="max-h-32 flex-1 resize-none bg-transparent px-1 py-1.5 text-[13.5px] outline-none"
              style={{ color: "var(--text-primary)" }}
            />
            {busy ? (
              <Button size="icon-sm" variant="outline" onClick={stop} aria-label="Stop">
                <Square className="fill-current" />
              </Button>
            ) : (
              <Button size="icon-sm" variant="signal" onClick={send} disabled={!input.trim()}
                aria-label={genMode ? "Generate" : "Send"}>
                {genMode ? <Sparkles /> : <SendHorizonal />}
              </Button>
            )}
          </div>
        </div>
      </div>

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
