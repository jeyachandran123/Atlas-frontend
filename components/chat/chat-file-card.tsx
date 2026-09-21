"use client";

import { useState } from "react";
import { AlertTriangle, Check, Download, Eye, FileSpreadsheet, FileText, FileType2, Loader2 } from "lucide-react";
import { knowledgeApi } from "@/lib/api/knowledge";
import { useViewerStore } from "@/lib/stores/viewer-store";
import type { ChatFilePayload } from "@/types/api";

export type { ChatFilePayload };

const FORMATS: Record<string, { label: string; color: string; Icon: typeof FileText }> = {
  pdf: { label: "PDF", color: "#f87171", Icon: FileText },
  excel: { label: "Excel", color: "#34d399", Icon: FileSpreadsheet },
  csv: { label: "CSV", color: "#2dd4bf", Icon: FileSpreadsheet },
  word: { label: "Word", color: "#60a5fa", Icon: FileType2 },
  markdown: { label: "Markdown", color: "#a1a1aa", Icon: FileText },
};

const SOURCE_NOTE: Record<string, string> = {
  attachment: "Built from your attached file",
  conversation: "Built from this conversation",
  knowledge: "Built from general knowledge — check key facts before relying on it",
};

function formatBytes(n?: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** A file the assistant made, as a message: what it is, where it came from, and a download. */
export function ChatFileCard({ data }: { data: ChatFilePayload }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const openViewer = useViewerStore((s) => s.open);
  const fmt = FORMATS[(data.format ?? "").toLowerCase()] ?? FORMATS.pdf!;

  function view() {
    if (!data.artifact_id) return;
    openViewer({
      kind: "artifact",
      id: data.artifact_id,
      title: data.title || data.filename || "Your file",
      filename: data.filename || "",
      extension: data.format ?? undefined,
    });
  }
  const failed = data.status !== "ready";

  async function download() {
    if (!data.artifact_id || state === "busy") return;
    setState("busy");
    try {
      const { url, filename } = await knowledgeApi.downloadUrl(data.artifact_id);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || data.filename || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setState("done");
      window.setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
    }
  }

  if (failed) {
    return (
      <div
        className="flex items-start gap-3 rounded-2xl px-4 py-3.5 animate-fade-in-up"
        style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)" }}
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: "var(--danger)" }} />
        <div className="min-w-0">
          <p className="text-[13px] font-medium" style={{ color: "var(--danger)" }}>
            I couldn&apos;t create the {fmt.label} file
          </p>
          {data.error && (
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>{data.error}</p>
          )}
        </div>
      </div>
    );
  }

  const meta = [data.filename, formatBytes(data.size_bytes)].filter(Boolean).join(" · ");
  const note = data.based_on
    ? `Built from ${data.based_on}`
    : SOURCE_NOTE[(data.source ?? "").toLowerCase()];

  return (
    // One row on a wide screen. On a phone the icon, the two buttons and their
    // gaps take ~267px of ~340px, leaving ~70px for the text — which is why the
    // source note wrapped one word per line. Below `sm` the buttons drop to
    // their own full-width row instead.
    <div
      className="group flex w-full max-w-[560px] flex-col gap-3 rounded-2xl p-3.5 transition-all duration-200 animate-fade-in-up hover:shadow-lg sm:flex-row sm:items-center sm:gap-3.5"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${fmt.color}1a`, border: `1px solid ${fmt.color}33` }}
        >
          <fmt.Icon className="size-5" style={{ color: fmt.color }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>
              {data.title || data.filename || "Your file"}
            </p>
            <span
              className="shrink-0 rounded-md px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
              style={{ background: `${fmt.color}1a`, color: fmt.color }}
            >
              {fmt.label}
            </span>
          </div>
          {meta && (
            <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>{meta}</p>
          )}
          {note && (
            <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>{note}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={view}
          disabled={!data.artifact_id}
          className="ghost-btn flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[12.5px] font-medium sm:flex-none"
        >
          <Eye className="size-3.5" /> View
        </button>
        <button
          onClick={() => void download()}
          disabled={!data.artifact_id || state === "busy"}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium text-white transition-all duration-150 disabled:opacity-60 sm:flex-none"
          style={{ background: "var(--accent-gradient)", boxShadow: "0 4px 14px rgba(99,102,241,0.28)" }}
        >
          {state === "busy" ? <Loader2 className="size-3.5 animate-spin" />
            : state === "done" ? <Check className="size-3.5" />
            : <Download className="size-3.5" />}
          {state === "error" ? "Retry" : state === "done" ? "Saved" : "Download"}
        </button>
      </div>
    </div>
  );
}
