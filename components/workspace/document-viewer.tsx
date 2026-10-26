"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download, FileSpreadsheet, FileText, ImageIcon, Loader2, Maximize2, Minimize2, Minus, Plus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { viewerApi } from "@/lib/api/viewer";
import { useViewerStore, type ViewerResource } from "@/lib/stores/viewer-store";
import type { FilePreview, PreviewSheet } from "@/types/api";

type Kind = "pdf" | "image" | "markdown" | "html" | "text" | "sheet" | "word" | "office" | "unknown";

/** Generated files carry a format name ("excel") rather than an extension. */
const FORMAT_EXT: Record<string, string> = {
  excel: "xlsx", word: "docx", markdown: "md", csv: "csv", pdf: "pdf", html: "html", json: "json",
};

function extensionOf(r: ViewerResource): string {
  const fromName = r.filename.includes(".") ? (r.filename.split(".").pop() ?? "").toLowerCase() : "";
  if (fromName) return fromName;
  const ext = (r.extension ?? "").toLowerCase().replace(/^\./, "");
  return FORMAT_EXT[ext] ?? ext;
}

function classify(ext: string, mime: string): Kind {
  if (ext === "pdf" || mime.includes("pdf")) return "pdf";
  if (["xlsx", "xlsm", "csv", "tsv"].includes(ext)) return "sheet";
  if (ext === "docx") return "word";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext) || mime.startsWith("image/")) return "image";
  if (["md", "markdown"].includes(ext) || mime.includes("markdown")) return "markdown";
  if (["html", "htm"].includes(ext) || mime.includes("html")) return "html";
  if (["txt", "json", "log", "xml", "yaml", "yml"].includes(ext) || mime.startsWith("text/") || mime.includes("json")) return "text";
  if (["doc", "xls", "pptx", "ppt"].includes(ext)) return "office";
  return "unknown";
}

/**
 * The in-app viewer, for every file in the app — workspace documents, generated
 * files, chat attachments, the Library. PDFs and images show as themselves;
 * spreadsheets as a grid with sheet tabs; Word files as their text and tables.
 */
export function DocumentViewer() {
  const resource = useViewerStore((s) => s.resource);
  const close = useViewerStore((s) => s.close);

  if (!resource) return null;
  return <ViewerModal key={`${resource.kind}:${resource.id}`} resource={resource} onClose={close} />;
}

function ViewerModal({ resource, onClose }: { resource: ViewerResource; onClose: () => void }) {
  const ext = useMemo(() => extensionOf(resource), [resource]);
  // Spreadsheets and Word files are read on the server; everything else is the file itself.
  const planned = useMemo(() => classify(ext, ""), [ext]);
  const usesPreview = planned === "sheet" || planned === "word";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [mime, setMime] = useState("");
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const urlRef = useRef<string | null>(null);

  const kind = usesPreview ? planned : classify(ext, mime);

  useEffect(() => {
    let cancelled = false;
    const load = usesPreview
      ? viewerApi.preview(resource).then((p) => {
          if (!cancelled) setPreview(p);
        })
      : viewerApi.content(resource).then(({ blobUrl, mime, text, owned }) => {
          if (cancelled) { if (owned) URL.revokeObjectURL(blobUrl); return; }
          // Only a URL made for this viewer is released with it; a signed link
          // or a chat's own preview is not ours to revoke.
          if (owned) urlRef.current = blobUrl;
          setBlobUrl(blobUrl);
          setMime(mime);
          setText(text);
        });
    load
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [resource, usesPreview]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const download = useCallback(async () => {
    try {
      const { url, filename, revoke } = await viewerApi.download(resource);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || resource.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (revoke) window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      toast.error("Download failed");
    }
  }, [resource]);

  const canZoom = kind === "image";
  const HeaderIcon = kind === "sheet" ? FileSpreadsheet : kind === "image" ? ImageIcon : FileText;
  const unavailable = !loading && !error && (
    kind === "office" || kind === "unknown"
    || (usesPreview && (preview?.type === "unsupported" || preview?.type === "too_large"))
  );

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 animate-fade-in sm:p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="flex w-full flex-col overflow-hidden rounded-2xl animate-scale-up"
        style={{
          background: "var(--surface-0)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-xl)",
          maxWidth: fullscreen ? "100%" : "min(1180px, 100%)",
          // dvh, not vh: on a phone the address bar shrinks the visible
          // viewport, and 88vh would put the footer under it.
          height: fullscreen ? "100%" : "min(88dvh, 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-1 px-2 py-2 sm:gap-2 sm:px-4 sm:py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <HeaderIcon className="size-4 shrink-0" style={{ color: kind === "sheet" ? "#34d399" : "var(--text-muted)" }} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}
            title={resource.filename}>
            {resource.title || resource.filename}
          </span>
          {/* Zooming is a pointer affordance; a phone pinch-zooms the content
              itself, so these only take room the filename needs. */}
          {canZoom && (
            <div className="hidden items-center gap-0.5 sm:flex">
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
          <button onClick={() => setFullscreen((f) => !f)} aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            className="rounded-md p-1.5 hover:bg-[var(--surface-3)]" style={{ color: "var(--text-secondary)" }}>
            {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
          <Button size="sm" variant="ghost" onClick={download} aria-label="Download">
            <Download /> <span className="hidden sm:inline">Download</span>
          </Button>
          <button onClick={onClose} aria-label="Close viewer"
            className="rounded-md p-1.5 hover:bg-[var(--surface-3)]" style={{ color: "var(--text-secondary)" }}>
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="relative min-h-0 flex-1 overflow-auto" style={{ background: "var(--surface-1)" }}>
          {loading && (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin" style={{ color: "var(--text-muted)" }} />
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                {usesPreview ? "Opening the file…" : "Loading…"}
              </p>
            </div>
          )}
          {error && !loading && (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center sm:px-6">
              <p className="text-[13px]" style={{ color: "var(--status-error)" }}>{error}</p>
              <Button size="sm" variant="outline" onClick={download}><Download /> Download instead</Button>
            </div>
          )}

          {!loading && !error && preview?.type === "table" && kind === "sheet" && (
            <SheetView key={resource.id} sheets={preview.sheets} sheetCount={preview.sheet_count} />
          )}
          {!loading && !error && preview?.type === "document" && kind === "word" && (
            <WordView preview={preview} />
          )}

          {!loading && !error && blobUrl && (
            <>
              {kind === "pdf" && (
                <iframe title={resource.filename} src={blobUrl} className="h-full w-full" style={{ border: "none" }} />
              )}
              {kind === "image" && (
                // At 100% the whole picture fits the window; zoom enlarges from there.
                <div className="flex h-full items-center justify-center p-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={blobUrl} alt={resource.filename} decoding="async"
                    className="rounded-lg"
                    style={{
                      transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.15s",
                      maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                      boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
                    }} />
                </div>
              )}
              {kind === "markdown" && text != null && (
                <div className="mx-auto max-w-3xl px-4 py-5 sm:px-8 sm:py-6"><MessageMarkdown content={text} /></div>
              )}
              {kind === "text" && text != null && (
                <pre className="whitespace-pre-wrap px-4 py-5 text-[12.5px] leading-relaxed sm:px-8 sm:py-6"
                  style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono, monospace)" }}>{text}</pre>
              )}
              {kind === "html" && text != null && (
                <iframe title={resource.filename} sandbox="" srcDoc={text} className="h-full w-full bg-white" style={{ border: "none" }} />
              )}
            </>
          )}

          {unavailable && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center sm:px-6">
              <FileText className="size-10" style={{ color: "var(--text-muted)" }} />
              <div>
                <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>Preview not available</p>
                <p className="mt-1 max-w-xs text-[12px]" style={{ color: "var(--text-muted)" }}>
                  {preview?.type === "too_large"
                    ? `This file is larger than ${preview.max_mb} MB — download it to open it.`
                    : "This file type can't be previewed in the browser. Download it to view."}
                </p>
              </div>
              <Button size="sm" variant="signal" onClick={download}><Download /> Download</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Spreadsheets ──────────────────────────────────────────────────────────

function columnName(index: number): string {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    name = String.fromCharCode(65 + m) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

const NUMERIC = /^-?[\d,]*\.?\d+%?$/;
/** Every row is exactly this tall, so the rows on screen can be worked out from the scroll position. */
const ROW_H = 33;
const ROW_NUMBER_W = 56;
/** Rows drawn beyond the visible ones, so fast scrolling never shows a gap. */
const OVERSCAN = 14;

/** Column widths from the longest value in each column (sampled), within sensible bounds. */
function columnWidths(rows: string[][], cols: number): number[] {
  const longest = new Array<number>(cols).fill(0);
  const sample = rows.length > 500 ? rows.slice(0, 500) : rows;
  for (const row of sample) {
    for (let c = 0; c < cols; c++) {
      const len = (row[c] ?? "").length;
      if (len > longest[c]!) longest[c] = len;
    }
  }
  return longest.map((len) => Math.min(360, Math.max(88, Math.round(len * 7.4) + 28)));
}

/**
 * A sheet the way a spreadsheet shows it: lettered columns, numbered rows, tabs below.
 *
 * All rows are here, but only the ones on screen are drawn — a sheet of 3,000
 * rows by 77 columns would otherwise be a quarter of a million cells in the page.
 * Columns have fixed widths so nothing shifts as rows come and go.
 */
function SheetView({ sheets, sheetCount }: { sheets: PreviewSheet[]; sheetCount: number }) {
  const [active, setActive] = useState(0);
  const sheet = sheets[active] ?? sheets[0];
  const rows = useMemo(() => sheet?.rows ?? [], [sheet]);
  const cols = useMemo(() => {
    let widest = 1;
    for (const r of rows) if (r.length > widest) widest = r.length;
    return widest;
  }, [rows]);
  const widths = useMemo(() => columnWidths(rows, cols), [rows, cols]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewport(el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  function onScroll() {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setScrollTop(scrollRef.current?.scrollTop ?? 0);
    });
  }

  function selectSheet(i: number) {
    setActive(i);
    setScrollTop(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }

  if (!sheet) {
    return (
      <div className="flex h-full items-center justify-center text-[13px]" style={{ color: "var(--text-muted)" }}>
        This workbook has no sheets.
      </div>
    );
  }

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewport) / ROW_H) + OVERSCAN);
  const tableWidth = ROW_NUMBER_W + widths.reduce((a, b) => a + b, 0);

  const headCell: React.CSSProperties = {
    background: "var(--surface-2)",
    color: "var(--text-muted)",
    borderRight: "1px solid var(--border-subtle)",
    borderBottom: "1px solid var(--border-default)",
  };
  const bodyCell: React.CSSProperties = {
    height: ROW_H,
    borderRight: "1px solid var(--border-subtle)",
    borderBottom: "1px solid var(--border-subtle)",
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] sm:px-6" style={{ color: "var(--text-muted)" }}>This sheet is empty.</p>
        ) : (
          <table
            className="border-separate border-spacing-0 text-[12.5px]"
            style={{ color: "var(--text-primary)", tableLayout: "fixed", width: tableWidth }}
          >
            <colgroup>
              <col style={{ width: ROW_NUMBER_W }} />
              {widths.map((w, c) => <col key={c} style={{ width: w }} />)}
            </colgroup>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 px-2 py-1.5" style={headCell} />
                {widths.map((_, c) => (
                  <th key={c} className="sticky top-0 z-10 px-2.5 py-1.5 text-center text-[11px] font-medium" style={headCell}>
                    {columnName(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {start > 0 && (
                <tr aria-hidden style={{ height: start * ROW_H }}><td colSpan={cols + 1} /></tr>
              )}
              {rows.slice(start, end).map((row, i) => {
                const r = start + i;
                return (
                  <tr key={r} className="hover:[&>td]:bg-[var(--surface-2)]">
                    <th
                      className="sticky left-0 z-10 px-2 text-right text-[11px] font-medium tabular-nums"
                      style={{ ...headCell, height: ROW_H }}
                    >
                      {r + 1}
                    </th>
                    {widths.map((_, c) => {
                      const value = row[c] ?? "";
                      const numeric = value !== "" && NUMERIC.test(value);
                      return (
                        <td
                          key={c}
                          title={value.length > 40 ? value : undefined}
                          className={`truncate px-2.5 ${numeric ? "text-right tabular-nums" : ""} ${r === 0 ? "font-medium" : ""}`}
                          style={bodyCell}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {end < rows.length && (
                <tr aria-hidden style={{ height: (rows.length - end) * ROW_H }}><td colSpan={cols + 1} /></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Tabs and size, where a spreadsheet keeps them */}
      <div
        className="flex shrink-0 items-center gap-3 px-2 py-1.5"
        style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-0)" }}
      >
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Sheets">
          {sheets.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              role="tab"
              aria-selected={i === active}
              onClick={() => selectSheet(i)}
              className="shrink-0 rounded-md px-3 py-1 text-[12px] font-medium transition-colors"
              style={i === active
                ? { background: "var(--accent-subtle)", color: "var(--accent-bright)", boxShadow: "inset 0 0 0 1px var(--accent-border)" }
                : { color: "var(--text-tertiary)" }}
            >
              {s.name}
            </button>
          ))}
          {sheetCount > sheets.length && (
            <span className="shrink-0 px-2 py-1 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
              +{sheetCount - sheets.length} more — download to see them
            </span>
          )}
        </div>
        <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: "var(--text-muted)" }}>
          {sheet.total_rows.toLocaleString()} rows × {sheet.total_cols.toLocaleString()} columns
          {sheet.truncated && ` · showing the first ${sheet.rows.length.toLocaleString()} — download for the rest`}
        </span>
      </div>
    </div>
  );
}

// ── Word ──────────────────────────────────────────────────────────────────

function WordView({ preview }: { preview: Extract<FilePreview, { type: "document" }> }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8 md:px-12">
      {preview.blocks.length === 0 && preview.tables.length === 0 && (
        <p className="text-center text-[13px]" style={{ color: "var(--text-muted)" }}>This document has no text.</p>
      )}
      {preview.blocks.map((b, i) =>
        b.kind === "heading" ? (
          <h2 key={i} className="mb-2 mt-6 text-[18px] font-semibold first:mt-0"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
            {b.text}
          </h2>
        ) : (
          <p key={i} className="mb-3 whitespace-pre-wrap text-[14px] leading-7" style={{ color: "var(--text-secondary)" }}>
            {b.text}
          </p>
        ),
      )}
      {preview.tables.map((t, i) => (
        <div key={i} className="my-5 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border-default)" }}>
          <table className="w-full border-collapse text-[13px]" style={{ color: "var(--text-primary)" }}>
            <tbody>
              {t.rows.map((row, r) => (
                <tr key={r} style={{ background: r === 0 ? "var(--surface-2)" : undefined }}>
                  {row.map((cell, c) => (
                    <td key={c} className={`px-3 py-2 align-top ${r === 0 ? "font-semibold" : ""}`}
                      style={{ borderBottom: "1px solid var(--border-subtle)", borderRight: "1px solid var(--border-subtle)" }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {preview.truncated && (
        <p className="mt-6 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
          The rest of this document is in the download.
        </p>
      )}
    </article>
  );
}
