"use client";

import { FileCode2 } from "lucide-react";
import { truncatePath } from "@/lib/utils/format";
import type { SearchResult } from "@/types/api";

/**
 * Renders the source citations for a grounded answer (FE-CHAT-02).
 * Every citation shows the file path, line range, and a relevance score
 * so the developer can judge whether to trust the answer at a glance —
 * this is what separates "grounded in your code" from "plausible-sounding."
 */
export function CitationsPanel({
  citations,
  onOpenCitation,
}: {
  citations: SearchResult[];
  onOpenCitation?: (citation: SearchResult) => void;
}) {
  if (citations.length === 0) return null;

  return (
    <div
      className="mt-3 flex flex-col gap-2 pt-3"
      style={{ borderTop: "1px solid var(--border-subtle)" }}
    >
      <span
        className="text-[10px] font-semibold uppercase"
        style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
      >
        Sources · {citations.length}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((citation, i) => {
          const score = Math.round(citation.score * 100);
          const scoreColor =
            score >= 80 ? "var(--success)" : score >= 60 ? "var(--accent-bright)" : "var(--text-tertiary)";
          return (
            <button
              key={`${citation.chunk.file_path}-${citation.chunk.start_line}-${i}`}
              onClick={() => onOpenCitation?.(citation)}
              className="chip-interactive group flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px]"
              title={`${citation.chunk.file_path}:${citation.chunk.start_line}–${citation.chunk.end_line}`}
            >
              <FileCode2
                className="size-3 shrink-0 transition-colors"
                style={{ color: "var(--accent-bright)" }}
              />
              <span className="font-mono">{truncatePath(citation.chunk.file_path, 2)}</span>
              <span style={{ color: "var(--text-muted)" }}>
                :{citation.chunk.start_line}–{citation.chunk.end_line}
              </span>
              <span
                className="ml-0.5 rounded px-1 font-mono text-[10px] font-medium"
                style={{ background: "var(--surface-3)", color: scoreColor }}
              >
                {score}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
