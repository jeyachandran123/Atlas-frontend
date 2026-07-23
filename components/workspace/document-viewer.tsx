"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download, FileText, Loader2, Maximize2, Minus, Plus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { workspaceApi } from "@/lib/api/workspace";
import { useViewerStore, type ViewerResource } from "@/lib/stores/viewer-store";

type Kind = "pdf" | "image" | "markdown" | "html" | "text" | "office" | "unknown";

function classify(filename: string, mime: string): Kind {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf" || mime.includes("pdf")) return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext) || mime.startsWith("image/")) return "image";
  if (["md", "markdown"].includes(ext) || mime.includes("markdown")) return "markdown";
  if (["html", "htm"].includes(ext) || mime.includes("html")) return "html";
  if (["txt", "csv", "json", "log", "xml", "yaml", "yml"].includes(ext) || mime.startsWith("text/") || mime.includes("json")) return "text";
  if (["docx", "doc", "xlsx", "xls", "pptx", "ppt"].includes(ext)) return "office";
  return "unknown";
}

export function DocumentViewer() {
  const resource = useViewerStore((s) => s.resource);
  const close = useViewerStore((s) => s.close);

  if (!resource) return null;
  return <ViewerModal resource={resource} onClose={close} />;
}

function ViewerModal({ resource, onClose }: { resource: ViewerResource; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [mime, setMime] = useState("");
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const urlRef = useRef<string | null>(null);

  const kind = useMemo(() => classify(resource.filename, mime), [resource.filename, mime]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    workspaceApi.fetchViewable(resource.kind, resource.id, resource.workspaceId)
      .then(({ blobUrl, mime, text }) => {
        if (cancelled) { URL.revokeObjectURL(blobUrl); return; }
        urlRef.current = blobUrl;
        setBlobUrl(blobUrl);
        setMime(mime);
        setText(text);
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setError(e.message ?? "Could not load"); setLoading(false); } });
    return () => {
      cancelled = true;
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [resource.kind, resource.id, resource.workspaceId]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const download = useCallback(async () => {
    try {
      const { url, filename } =
        resource.kind === "artifact"
          ? await workspaceApi.downloadArtifact(resource.id)
          : await workspaceApi.documentUrl(resource.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || resource.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("Download failed");
    }
  }, [resource]);

  const canZoom = kind === "image";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="flex w-full flex-col overflow-hidden rounded-2xl animate-scale-up"
        style={{
          background: "var(--surface-0)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-xl)",
          maxWidth: fullscreen ? "100%" : "min(1100px, 100%)",
          height: fullscreen ? "100%" : "min(88vh, 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <FileText className="size-4 shrink-0" style={{ color: "var(--text-muted)" }} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}
            title={resource.filename}>
            {resource.title || resource.filename}
          </span>
          {canZoom && (
            <div className="flex items-center gap-0.5">
              <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} aria-label="Zoom out"
                className="rounded-md p-1.5 hover:bg-[var(--surface-3)]" style={{ color: "var(--text-secondary)" }}>
                <Minus className="size-3.5" />
              </button>
              <span className="w-10 text-center text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))} aria-label="Zoom in"
                className="rounded-md p-1.5 hover:bg-[var(--surface-3)]" style={{ color: "var(--text-secondary)" }}>
                <Plus className="size-3.5" />
              </button>
            </div>
          )}
          <button onClick={() => setFullscreen((f) => !f)} aria-label="Toggle fullscreen"
            className="rounded-md p-1.5 hover:bg-[var(--surface-3)]" style={{ color: "var(--text-secondary)" }}>
            <Maximize2 className="size-3.5" />
          </button>
          <Button size="sm" variant="ghost" onClick={download}><Download /> Download</Button>
          <button onClick={onClose} aria-label="Close viewer"
            className="rounded-md p-1.5 hover:bg-[var(--surface-3)]" style={{ color: "var(--text-secondary)" }}>
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-auto" style={{ background: "var(--surface-1)" }}>
          {loading && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          )}
          {error && !loading && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-[13px]" style={{ color: "var(--status-error)" }}>{error}</p>
              <Button size="sm" variant="outline" onClick={download}><Download /> Download instead</Button>
            </div>
          )}
          {!loading && !error && blobUrl && (
            <>
              {kind === "pdf" && (
                <iframe title={resource.filename} src={blobUrl} className="h-full w-full" style={{ border: "none" }} />
              )}
              {kind === "image" && (
                <div className="flex min-h-full items-center justify-center p-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={blobUrl} alt={resource.filename}
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center", maxWidth: "100%", transition: "transform 0.15s" }} />
                </div>
              )}
              {kind === "markdown" && text != null && (
                <div className="mx-auto max-w-3xl px-8 py-6"><MessageMarkdown content={text} /></div>
              )}
              {kind === "text" && text != null && (
                <pre className="whitespace-pre-wrap px-8 py-6 text-[12.5px] leading-relaxed"
                  style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)" }}>{text}</pre>
              )}
              {kind === "html" && text != null && (
                <iframe title={resource.filename} sandbox="" srcDoc={text} className="h-full w-full bg-white" style={{ border: "none" }} />
              )}
              {(kind === "office" || kind === "unknown") && (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6">
                  <FileText className="size-10" style={{ color: "var(--text-muted)" }} />
                  <div>
                    <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>Preview not available</p>
                    <p className="mt-1 max-w-xs text-[12px]" style={{ color: "var(--text-muted)" }}>
                      This file type can&apos;t be previewed in the browser. Download it to view.
                    </p>
                  </div>
                  <Button size="sm" variant="signal" onClick={download}><Download /> Download</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
