"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileOutput, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GENERATE_STAGE_LABELS, StageIndicator } from "@/components/knowledge/stage-indicator";
import { knowledgeApi, streamGenerate } from "@/lib/api/knowledge";

const FORMAT_LABELS: Record<string, string> = {
  excel: "Excel (.xlsx)", pdf: "PDF (.pdf)", word: "Word (.docx)",
  csv: "CSV (.csv)", json: "JSON (.json)", markdown: "Markdown (.md)", html: "HTML (.html)",
};

export function GeneratePanel({
  documentId,
  onClose,
}: {
  documentId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState("pdf");
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<string[]>([]);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; filename: string; status: string; error: string | null } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: formatsData } = useQuery({
    queryKey: ["generation-formats"],
    queryFn: () => knowledgeApi.supportedFormats(),
    staleTime: Infinity,
  });
  const formats = formatsData?.formats ?? Object.keys(FORMAT_LABELS);

  const { data: history = [] } = useQuery({
    queryKey: ["generations"],
    queryFn: () => knowledgeApi.listGenerations(),
  });

  useEffect(() => () => abortRef.current?.abort(), []);

  function start() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setResult(null);
    setStages([]);
    setCurrentStage(null);
    abortRef.current = streamGenerate(
      prompt.trim(), format, documentId,
      (e) => {
        if (e.event === "stage") {
          const s = e.data.stage;
          setStages((prev) => (prev.includes(s) ? prev : [...prev, s]));
          setCurrentStage(s);
        } else if (e.event === "done") {
          setCurrentStage(null);
          setResult({
            id: e.data.artifact_id, filename: e.data.filename,
            status: e.data.status, error: e.data.error,
          });
          qc.invalidateQueries({ queryKey: ["generations"] });
        } else if (e.event === "error") {
          setCurrentStage(null);
          setResult({ id: "", filename: "", status: "failed", error: e.data.message });
        }
      },
      () => { setBusy(false); setCurrentStage(null); },
      () => { setBusy(false); },
    );
  }

  async function download(artifactId: string) {
    const { url } = await knowledgeApi.downloadUrl(artifactId);
    window.open(url, "_blank");
  }

  return (
    <div
      className="flex h-full w-[340px] shrink-0 flex-col overflow-y-auto"
      style={{ borderLeft: "1px solid var(--border-subtle)", background: "var(--sidebar-bg)" }}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
          <FileOutput className="size-4" /> Generate document
        </h2>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close generate panel">
          <X />
        </Button>
      </div>
      <p className="px-4 pb-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
        The AI plans the content from your knowledge base; a deterministic builder renders the file.
      </p>

      <div className="flex flex-col gap-2.5 px-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="e.g. Create a pricing overview with a table of all plans…"
          className="w-full resize-none rounded-lg px-3 py-2 text-[12.5px] outline-none"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          }}
          disabled={busy}
        />
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          disabled={busy}
          className="w-full rounded-lg px-3 py-2 text-[12.5px] outline-none"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          {formats.map((f) => (
            <option key={f} value={f}>{FORMAT_LABELS[f] ?? f}</option>
          ))}
        </select>
        <Button variant="signal" onClick={start} disabled={busy || !prompt.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : <FileOutput />}
          {busy ? "Generating…" : "Generate"}
        </Button>

        {stages.length > 0 && (
          <div className="rounded-xl px-3.5 py-3"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
            <StageIndicator stages={stages} current={currentStage} labels={GENERATE_STAGE_LABELS} />
          </div>
        )}

        {result && (
          <div className="rounded-xl px-3.5 py-3"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
            {result.status === "ready" ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="ready" dot>Ready</Badge>
                  <span className="truncate text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    {result.filename}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => void download(result.id)}>
                  <Download /> Download
                </Button>
              </>
            ) : (
              <p className="text-[12px]" style={{ color: "var(--status-error)" }}>
                {result.error ?? "Generation failed"}
              </p>
            )}
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-5 px-4 pb-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}>
            Recent
          </h3>
          <div className="flex flex-col gap-1">
            {history.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                style={{ border: "1px solid var(--border-subtle)" }}>
                <span className="min-w-0 flex-1 truncate text-[11.5px]"
                  style={{ color: "var(--text-secondary)" }} title={a.title || a.filename}>
                  {a.filename || a.title || a.format}
                </span>
                {a.status === "ready" ? (
                  <button onClick={() => void download(a.id)} aria-label={`Download ${a.filename}`}
                    className="shrink-0">
                    <Download className="size-3.5" style={{ color: "var(--signal)" }} />
                  </button>
                ) : (
                  <Badge variant={a.status === "failed" ? "error" : "pending"}>{a.status}</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
