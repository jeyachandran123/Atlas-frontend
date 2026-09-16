"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import {
  BookMarked, ChevronDown, Download, Layers, Loader2, Menu, MoreHorizontal,
  PanelRight, Pencil, ShieldAlert, ShieldCheck, Sparkles,
  SquareStack, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ChatMessagesSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import {
  ASK_STAGE_LABELS, GENERATE_STAGE_LABELS, StageIndicator,
} from "@/components/knowledge/stage-indicator";
import { BookmarkButton } from "@/components/workspace/bookmark-button";
import { GeneratedDocumentCard } from "@/components/workspace/generated-document-card";
import { MessageActions } from "@/components/workspace/message-actions";
import { WorkspaceComposer } from "@/components/workspace/workspace-composer";
import { WorkspaceHero } from "@/components/workspace/workspace-hero";
import {
  streamWorkspaceAsk, streamWorkspaceDocumentTask, streamWorkspaceGenerate, workspaceApi,
} from "@/lib/api/workspace";
import { useDeleteConversation, useWorkspaces } from "@/lib/hooks/use-workspace";
import { useOperationsStore } from "@/lib/stores/operations-store";
import { useUIStore } from "@/lib/stores/ui-store";
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
  /** Set when the instruction was a question rather than a request for a file. */
  answer?: string;
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
  // Both workspace columns fold away on a small screen; these reopen them.
  const setNavOpen = useUIStore((s) => s.setWorkspaceNavOpen);
  const setContextOpen = useUIStore((s) => s.setWorkspaceContextOpen);
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
  // Bumped whenever a quick action fills the composer, so the caret lands
  // where the user is about to type instead of leaving them to click.
  const [focusSeq, setFocusSeq] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef<string | null>(null);
  const scrolledHashRef = useRef<string | null>(null);

  // Full restore payload — the single source for initial hydration.
  const { data: restore, isLoading: restoring } = useQuery({
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
  /**
   * Transform the document that is in scope, rather than authoring a new one.
   *
   * Generate builds a document from a prompt through a content model capped at
   * 2000 rows and 50 columns - it cannot express "expand this 1251-row,
   * 77-column sheet". When a single document is selected the request is almost
   * always about that document, so it goes to the task engine instead: the
   * real file, real column names, code run over every row.
   */
  const runDocumentTask = useCallback(
    async (instruction: string, fmt: string, documentId: string) => {
      const key = `gen-live-${Date.now()}`;
      setBusy(true);
      setItems((prev) => [...prev, {
        kind: "gen", key, createdAt: Date.now(), prompt: instruction, format: fmt,
        status: "running", stages: [], current: null, artifact: null, error: null,
      }]);
      let settled = false;

      abortRef.current = streamWorkspaceDocumentTask(
        workspaceId, documentId, instruction, fmt || null, conversationId,
        (e) => {
          if (e.event === "stage") {
            patchGen(key, (g) => ({
              stages: g.stages.includes(e.data.stage) ? g.stages : [...g.stages, e.data.stage],
              current: e.data.stage,
            }));
          } else if (e.event === "done") {
            settled = true;
            if (e.data.kind === "answer") {
              // The instruction was a question; the answer is the deliverable.
              patchGen(key, {
                status: "ready", current: null, error: null,
                artifact: null, answer: e.data.answer ?? "",
              });
            } else {
              patchGen(key, {
                status: "ready",
                current: null,
                error: null,
                artifact: {
                  id: e.data.artifact_id!, title: e.data.filename ?? "Result",
                  filename: e.data.filename ?? "result",
                  format: (e.data.filename ?? "").split(".").pop() ?? fmt,
                  status: "ready", prompt: instruction,
                  size_bytes: e.data.size_bytes ?? 0, grounded: true, error: null,
                  conversation_id: conversationId, created_at: new Date().toISOString(),
                },
              });
            }
            syncWorkspace();
            qc.invalidateQueries({ queryKey: ["workspace-restore", workspaceId, conversationId] });
          } else if (e.event === "error") {
            settled = true;
            patchGen(key, { status: "failed", current: null, error: e.data.message });
          }
        },
        () => {
          setBusy(false);
          if (!settled) patchGen(key, { status: "failed", current: null, error: "The task failed" });
        },
        () => {
          setBusy(false);
          if (!settled) patchGen(key, { status: "cancelled", current: null });
          syncWorkspace();
        },
      );
    },
    [workspaceId, conversationId, qc, patchGen, syncWorkspace],
  );

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
    if (genMode) {
      const scoped = restore?.documents ?? [];
      if (scoped.length === 1) void runDocumentTask(text, format, scoped[0]!.id);
      else void generate(text, format);
    } else void ask(text);
  }, [input, busy, genMode, format, generate, runDocumentTask, ask, restore]);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

  /** Ask the same question again — a fresh turn, not an edit of the old one. */
  const retryAsk = useCallback((question: string) => {
    if (busy) return;
    void ask(question);
  }, [busy, ask]);

  /**
   * Remove a message from this view.
   *
   * Local only, and deliberately so: the turn stays in the conversation's
   * stored history, which is what the platform's audit trail and the grounded
   * memory window both read. This clears the clutter in front of the user
   * without quietly rewriting the record — a reload brings it back, which is
   * the honest behaviour for something labelled "remove from this view".
   */
  const dropItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }, []);

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
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open workspace menu"
          className="icon-btn size-9 shrink-0 rounded-lg md:hidden"
        >
          <Menu className="size-[18px]" />
        </button>
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

          {/* Inline where there is room. Four labelled controls need roughly
              370px, and a phone has about 390px in total — so below sm they
              collapse into the single menu underneath. */}
          <div className="hidden items-center gap-1.5 sm:flex">
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

          {/* The same actions, one tap away, on a narrow screen. */}
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="Conversation actions" className="sm:hidden">
                <MoreHorizontal />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content align="end" sideOffset={6}
                className="z-50 w-52 overflow-hidden rounded-xl p-1.5 animate-scale-up"
                style={{ background: "var(--surface-overlay)", backdropFilter: "blur(24px)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-xl)" }}>
                <Dropdown.Item disabled={saving || !hasHistory} onSelect={saveAsKnowledge}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--surface-3)] data-[disabled]:opacity-40"
                  style={{ color: "var(--text-primary)" }}>
                  <BookMarked className="size-3.5" /> Save as knowledge
                </Dropdown.Item>
                {([["markdown", "Export Markdown"], ["pdf", "Export PDF"], ["word", "Export Word"]] as const).map(([fmt, label]) => (
                  <Dropdown.Item key={fmt} disabled={!hasHistory} onSelect={() => exportAs(fmt)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--surface-3)] data-[disabled]:opacity-40"
                    style={{ color: "var(--text-primary)" }}>
                    <Download className="size-3.5" /> {label}
                  </Dropdown.Item>
                ))}
                <Dropdown.Item onSelect={() => setDeleteOpen(true)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--danger-bg)]"
                  style={{ color: "var(--status-error)" }}>
                  <Trash2 className="size-3.5" /> Delete conversation
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>

          {/* The context column folds away below lg; this opens it as a sheet. */}
          <Button size="icon-sm" variant="ghost" onClick={() => setContextOpen(true)}
            aria-label="Open workspace context" className="lg:hidden">
            <PanelRight />
          </Button>
        </div>
      </div>

      {/* Compact retrieval-scope cue. */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] sm:px-6" style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
        {retrievalMode === "all" ? (
          <><Layers className="size-3" /> Using all documents</>
        ) : (
          <><SquareStack className="size-3" /> Using {contextCount} selected document{contextCount === 1 ? "" : "s"}</>
        )}
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {restoring && !hasHistory ? (
          // The history is on its way — not the empty "start a conversation" hero.
          <div className="mx-auto max-w-2xl">
            <ChatMessagesSkeleton />
          </div>
        ) : !hasHistory ? (
          // The hero replaces the thread rather than sitting above it, so it
          // can centre in the space instead of pushing an empty list around.
          <WorkspaceHero
            documentCount={contextCount}
            onPick={(template) => {
              setInput(template);
              setFocusSeq((n) => n + 1);
            }}
          />
        ) : (
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {items.map((item, i) => {
            const isLast = i === items.length - 1;
            if (item.kind === "ask") {
              return (
                <div key={item.key} className="group flex flex-col gap-3">
                  <div className="flex flex-col items-end gap-1 self-end" style={{ maxWidth: "85%" }}>
                    <div className="rounded-2xl rounded-br-md px-4 py-2.5 text-[13.5px]"
                      style={{ background: "var(--surface-3)", color: "var(--text-primary)" }}>
                      {item.question}
                    </div>
                    <MessageActions
                      text={item.question}
                      onRetry={busy ? undefined : () => retryAsk(item.question)}
                      onDelete={() => dropItem(item.key)}
                    />
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
                          <MessageActions
                            text={item.answer}
                            onRetry={busy ? undefined : () => retryAsk(item.question)}
                            className="ml-auto"
                          />
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
                {item.status === "ready" && !item.artifact && item.answer && (
                  // The instruction turned out to be a question - the number
                  // computed over every row is the result, and there is no file.
                  <div className="rounded-2xl rounded-bl-md px-4 py-3 text-[13px] whitespace-pre-wrap" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", maxWidth: "95%" }}>
                    {item.answer}
                  </div>
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
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer — the single entry point for chat AND generation */}
      <div className="px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
        <div className="mx-auto max-w-2xl">
          <WorkspaceComposer
            value={input}
            onChange={setInput}
            onSend={send}
            onStop={stop}
            onAttach={attachDocuments}
            busy={busy}
            uploading={uploading}
            genMode={genMode}
            onToggleGen={() => setGenMode((v) => !v)}
            format={format}
            formatLabel={formatLabel}
            formats={GEN_FORMATS}
            onFormatChange={setFormat}
            autoFocus={focusSeq > 0}
          />
          <p className="mt-2.5 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
            UnityWorks can make mistakes. Verify important information.
          </p>
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
