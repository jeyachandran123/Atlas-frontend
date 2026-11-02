"use client";

/**
 * BrainMeta — surfaces the Cognitive OS's governance metadata on an assistant reply.
 *
 * Drop-in and side-effect-free: it renders nothing unless the turn was handled by the
 * brain (`brain === true`). Feed it the fields from the SSE `done` event.
 *
 *   <BrainMeta brain={m.brain} decision={m.decision} escalated={m.escalated}
 *              confidence={m.confidence} intent={m.intent} />
 */

export interface BrainMetaProps {
  brain?: boolean;
  decision?: string;
  authorized?: boolean;
  escalated?: boolean;
  confidence?: number; // 0..1
  intent?: string;
}

function confidenceLabel(c: number): { text: string; className: string } {
  if (c >= 0.75) return { text: "high confidence", className: "text-emerald-600 dark:text-emerald-400" };
  if (c >= 0.5) return { text: "moderate confidence", className: "text-amber-600 dark:text-amber-400" };
  return { text: "low confidence", className: "text-rose-600 dark:text-rose-400" };
}

export function BrainMeta({ brain, decision, escalated, confidence, intent }: BrainMetaProps) {
  if (!brain) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-300/60 bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-300">
        🧠 Cognitive OS
      </span>

      {typeof confidence === "number" && !escalated && (
        <span className={`inline-flex items-center gap-1 ${confidenceLabel(confidence).className}`}>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-current/20">
            <span className="block h-full rounded-full bg-current" style={{ width: `${Math.round(confidence * 100)}%` }} />
          </span>
          {confidenceLabel(confidence).text} · {Math.round(confidence * 100)}%
        </span>
      )}

      {decision && !escalated && (
        <span className="text-muted-foreground">decision: {decision}</span>
      )}

      {intent && intent !== "general" && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">intent: {intent}</span>
      )}

      {escalated && (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-50 px-2 py-0.5 font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300">
          ⏸ Held for your review — this looked high-stakes, so it wasn’t acted on automatically.
        </span>
      )}
    </div>
  );
}
