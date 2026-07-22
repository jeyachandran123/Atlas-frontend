"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileOutput, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GENERATE_STAGE_LABELS, StageIndicator } from "@/components/knowledge/stage-indicator";
import { streamWorkspaceGenerate, workspaceApi } from "@/lib/api/workspace";

const FORMATS: { value: string; label: string }[] = [
  { value: "pdf", label: "PDF" }, { value: "excel", label: "Excel" },
  { value: "word", label: "Word" }, { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" }, { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" },
];

export function GenerateDialog({
  workspaceId,
  conversationId,
  onClose,
}: {
  workspaceId: string;
  conversationId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState("pdf");
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; filename: string; status: string; error: string | null } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  function start() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setResult(null);
    setStages([]);
    setCurrent(null);
    abortRef.current = streamWorkspaceGenerate(
      workspaceId, prompt.trim(), format, conversationId,
      (e) => {
        if (e.event === "stage") {
          setStages((p) => (p.includes(e.data.stage) ? p : [...p, e.data.stage]));
          setCurrent(e.data.stage);
        } else if (e.event === "done") {
          setCurrent(null);
          setResult({ id: e.data.artifact_id, filename: e.data.filename, status: e.data.status, error: e.data.error });
          qc.invalidateQueries({ queryKey: ["workspace-artifacts", workspaceId] });
          qc.invalidateQueries({ queryKey: ["workspace-timeline", workspaceId] });
          qc.invalidateQueries({ queryKey: ["workspace-dashboard", workspaceId] });
        } else if (e.event === "error") {
          setResult({ id: "", filename: "", status: "failed", error: e.data.message });
        }
      },
      () => { setBusy(false); setCurrent(null); },
      () => setBusy(false),
    );
  }

  async function download(id: string) {
    const { url } = await workspaceApi.downloadArtifact(id);
    window.open(url, "_blank");
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl animate-scale-up"
        style={{ background: "var(--surface-overlay)", backdropFilter: "blur(24px)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            <FileOutput className="size-4" /> Generate document
          </h2>
          <button onClick={onClose} aria-label="Close"><X className="size-4" style={{ color: "var(--text-muted)" }} /></button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
            {conversationId
              ? "Grounded in this conversation's documents."
              : "Grounded in all workspace documents."} The AI plans; a deterministic builder renders.
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. Create an executive summary with a pricing table…"
            className="w-full resize-none rounded-lg px-3 py-2 text-[13px] outline-none"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
            disabled={busy}
          />
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFormat(f.value)}
                disabled={busy}
                className="rounded-lg px-2.5 py-1 text-[12px] transition-colors"
                style={{
                  background: format === f.value ? "var(--accent-subtle)" : "var(--surface-1)",
                  border: `1px solid ${format === f.value ? "var(--accent-border)" : "var(--border-subtle)"}`,
                  color: format === f.value ? "var(--accent-bright)" : "var(--text-secondary)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button variant="signal" onClick={start} disabled={busy || !prompt.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <FileOutput />}
            {busy ? "Generating…" : "Generate"}
          </Button>

          {stages.length > 0 && (
            <div className="rounded-xl px-3.5 py-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
              <StageIndicator stages={stages} current={current} labels={GENERATE_STAGE_LABELS} />
            </div>
          )}

          {result && (
            <div className="rounded-xl px-3.5 py-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
              {result.status === "ready" ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge variant="ready" dot>Ready</Badge>
                    <span className="truncate text-[12px]" style={{ color: "var(--text-secondary)" }}>{result.filename}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void download(result.id)}>
                    <Download /> Download
                  </Button>
                </div>
              ) : (
                <p className="text-[12px]" style={{ color: "var(--status-error)" }}>{result.error ?? "Generation failed"}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
