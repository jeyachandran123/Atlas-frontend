/**
 * The one place a document's processing status is interpreted.
 *
 * The backend advances a document through
 * `queued → processing → parsed → normalized → knowledge_ready`, and `failed`
 * on either error path. Five separate components each kept their own copy of
 * the active set, and every copy said `["queued", "processing", "retrying"]` —
 * missing `parsed` and `normalized`, and inventing a `retrying` the backend
 * never sets.
 *
 * That misread the pipeline as finished halfway through it. The document list
 * polls only while something is active, so the moment a document reached
 * `parsed` the polling stopped, the badge froze on "Processing…", and the
 * document only appeared as ready after a manual page refresh — which starts a
 * fresh query and reads the real status. Uploading a file and having it never
 * arrive was this, not the pipeline.
 *
 * So the rule is inverted here: a status is active unless it is known to be
 * terminal. A stage added to the pipeline tomorrow keeps the UI polling rather
 * than silently stalling it, which is the failure worth designing against.
 */

/** Statuses after which nothing more will happen without a new request. */
export const TERMINAL_STATUSES = new Set(["knowledge_ready", "failed"]);

/**
 * Statuses meaning the document was never handed to the pipeline. Treated as
 * inactive so an unqueued document cannot hold a poll open forever.
 */
const UNSTARTED_STATUSES = new Set(["", "none", "uploaded"]);

export function isReady(status: string): boolean {
  return status === "knowledge_ready";
}

export function isFailed(status: string): boolean {
  return status === "failed";
}

/** True while the pipeline still owes this document work. */
export function isProcessing(status: string): boolean {
  const s = (status ?? "").toLowerCase();
  return !TERMINAL_STATUSES.has(s) && !UNSTARTED_STATUSES.has(s);
}

/** True if any document in the list is still moving — the polling predicate. */
export function anyProcessing(
  documents: ReadonlyArray<{ processing_status: string }> | undefined,
): boolean {
  return (documents ?? []).some((d) => isProcessing(d.processing_status));
}

/** How long to wait before asking again, or false to stop polling. */
export function pollInterval(
  documents: ReadonlyArray<{ processing_status: string }> | undefined,
): number | false {
  return anyProcessing(documents) ? 3000 : false;
}

/** The word shown to a person, for any status the backend can produce. */
export function statusLabel(status: string): string {
  if (isReady(status)) return "Ready";
  if (isFailed(status)) return "Failed";
  if (isProcessing(status)) return "Processing…";
  return status || "Uploaded";
}
