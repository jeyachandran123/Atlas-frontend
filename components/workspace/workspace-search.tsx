"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, MessageSquare, Search, Sparkles, X } from "lucide-react";
import { workspaceApi } from "@/lib/api/workspace";
import { useViewerStore } from "@/lib/stores/viewer-store";
import type { WorkspaceSearchResults } from "@/types/workspace";

export function WorkspaceSearch({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const openViewer = useViewerStore((s) => s.open);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<WorkspaceSearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await workspaceApi.search(workspaceId, q.trim());
        setResults(res.results);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q, workspaceId]);

  function goConversation(conversationId: string) {
    router.push(`/w/${workspaceId}/c/${conversationId}`);
    onClose();
  }

  function viewDocument(id: string, filename: string) {
    openViewer({ kind: "document", id, workspaceId, title: filename, filename });
    onClose();
  }

  function viewArtifact(id: string, title: string, filename: string, format: string) {
    openViewer({ kind: "artifact", id, workspaceId, title: title || filename, filename, extension: format });
    onClose();
  }

  const hasResults =
    results &&
    (results.documents.length ||
      results.conversations.length ||
      results.turns.length ||
      results.artifacts.length ||
      results.chunks.length);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl animate-scale-up"
        style={{
          background: "var(--surface-overlay)",
          backdropFilter: "blur(24px)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <Search className="size-4 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search documents, conversations, artifacts, knowledge…"
            className="flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {loading && <Loader2 className="size-4 animate-spin" style={{ color: "var(--text-muted)" }} />}
          <button onClick={onClose} aria-label="Close search"><X className="size-4" style={{ color: "var(--text-muted)" }} /></button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {q.trim().length >= 2 && !loading && !hasResults && (
            <p className="px-3 py-6 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
              No matches for “{q}”.
            </p>
          )}

          {results?.chunks.map((chunk, i) => (
            <div key={`chunk-${i}`} className="rounded-lg px-3 py-2" style={{ color: "var(--text-secondary)" }}>
              <div className="mb-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}>
                <FileText className="size-3" /> Knowledge match · {(chunk.score * 100).toFixed(0)}%
              </div>
              <p className="text-[12.5px]">{chunk.snippet}</p>
            </div>
          ))}

          {results?.turns.map((turn) => (
            <button
              key={turn.turn_id}
              onClick={() => goConversation(turn.conversation_id)}
              className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--surface-3)]"
            >
              <MessageSquare className="mt-0.5 size-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {turn.question}
                </div>
                <div className="truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                  in {turn.conversation_title}
                </div>
              </div>
            </button>
          ))}

          {results?.conversations.map((conv) => (
            <button
              key={conv.conversation_id}
              onClick={() => goConversation(conv.conversation_id)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--surface-3)]"
            >
              <MessageSquare className="size-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              <span className="truncate text-[12.5px]" style={{ color: "var(--text-primary)" }}>{conv.title}</span>
            </button>
          ))}

          {results?.documents.map((doc) => (
            <button key={doc.id} onClick={() => viewDocument(doc.id, doc.filename)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--surface-3)]">
              <FileText className="size-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              <span className="truncate text-[12.5px]" style={{ color: "var(--text-primary)" }}>{doc.filename}</span>
            </button>
          ))}

          {results?.artifacts.map((a) => (
            <button key={a.id} onClick={() => viewArtifact(a.id, a.title, a.filename, a.format)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--surface-3)]">
              <Sparkles className="size-4 shrink-0" style={{ color: "var(--text-muted)" }} />
              <span className="truncate text-[12.5px]" style={{ color: "var(--text-primary)" }}>{a.title || a.filename}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
