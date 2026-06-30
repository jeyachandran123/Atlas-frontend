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
    <div className="mt-3 flex flex-col gap-1.5 border-t border-border-subtle pt-3">
      <span className="text-xs font-medium text-text-tertiary">
        Sources ({citations.length})
      </span>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((citation, i) => (
          <button
            key={`${citation.chunk.file_path}-${citation.chunk.start_line}-${i}`}
            onClick={() => onOpenCitation?.(citation)}
            className="group flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-secondary transition-colors hover:border-signal/40 hover:text-text-primary"
          >
            <FileCode2 className="size-3 text-text-tertiary group-hover:text-signal" />
            <span className="font-mono">{truncatePath(citation.chunk.file_path, 2)}</span>
            <span className="text-text-tertiary">
              :{citation.chunk.start_line}-{citation.chunk.end_line}
            </span>
            <span className="ml-1 rounded bg-surface-overlay px-1 text-[10px] text-text-tertiary">
              {(citation.score * 100).toFixed(0)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
