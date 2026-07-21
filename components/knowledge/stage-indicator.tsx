"use client";

import { Check, Loader2 } from "lucide-react";

/** Human labels for the backend's live pipeline stage events — the answer to
 *  "show what is actually going on" instead of a generic Thinking…. */
export const ASK_STAGE_LABELS: Record<string, string> = {
  understanding_question: "Understanding your question",
  searching_knowledge: "Searching your documents",
  ranking_sources: "Ranking sources",
  reading_documents: "Reading matched passages",
  preparing_prompt: "Assembling context",
  generating_answer: "Generating answer",
};

export const GENERATE_STAGE_LABELS: Record<string, string> = {
  planning: "AI is planning the document",
  shaping_content: "Shaping the content",
  building_file: "Building the file",
  storing: "Uploading to storage",
};

export function StageIndicator({
  stages,
  current,
  labels,
}: {
  stages: string[];          // stages seen so far, in order
  current: string | null;    // the one still running (last seen)
  labels: Record<string, string>;
}) {
  if (stages.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 py-1" role="status" aria-live="polite">
      {stages.map((stage) => {
        const active = stage === current;
        return (
          <div key={stage} className="flex items-center gap-2 text-[12px]">
            {active ? (
              <Loader2 className="size-3 animate-spin" style={{ color: "var(--signal)" }} />
            ) : (
              <Check className="size-3" style={{ color: "var(--status-ready)" }} />
            )}
            <span
              style={{
                color: active ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: active ? 500 : 400,
              }}
            >
              {labels[stage] ?? stage.replace(/_/g, " ")}
              {active ? "…" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
