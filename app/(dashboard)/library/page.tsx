"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check, ChevronLeft, ChevronRight, Download, File as FileGlyph, FileSpreadsheet, FileText,
  FileType2, ImageIcon, Library, Loader2, MessageSquare, Search, Sparkles, X,
} from "lucide-react";
import { useLibrary } from "@/lib/hooks/use-library";
import { libraryApi } from "@/lib/api/library";
import { useViewerStore } from "@/lib/stores/viewer-store";
import { LibraryGridSkeleton } from "@/components/ui/skeleton";
import type { LibraryItem, LibraryKind } from "@/types/api";

type Tab = "all" | LibraryKind;

const TABS: Array<{ id: Tab; label: string; Icon: React.ElementType }> = [
  { id: "all", label: "Everything", Icon: Library },
  { id: "image", label: "Images", Icon: ImageIcon },
  { id: "document", label: "Documents", Icon: FileText },
  { id: "created", label: "Created for you", Icon: Sparkles },
];

const FORMATS: Record<string, { color: string; Icon: React.ElementType; label?: string }> = {
  pdf: { color: "#f87171", Icon: FileText },
  xlsx: { color: "#34d399", Icon: FileSpreadsheet, label: "Excel" },
  xlsm: { color: "#34d399", Icon: FileSpreadsheet, label: "Excel" },
  xls: { color: "#34d399", Icon: FileSpreadsheet, label: "Excel" },
  csv: { color: "#2dd4bf", Icon: FileSpreadsheet },
  tsv: { color: "#2dd4bf", Icon: FileSpreadsheet },
  docx: { color: "#60a5fa", Icon: FileType2, label: "Word" },
  md: { color: "#a1a1aa", Icon: FileText, label: "Markdown" },
  txt: { color: "#a1a1aa", Icon: FileText, label: "Text" },
  json: { color: "#fbbf24", Icon: FileGlyph },
};

function formatStyle(format: string) {
  return FORMATS[format.toLowerCase()] ?? { color: "#94a3b8", Icon: FileGlyph };
}

function formatLabel(format: string) {
  return FORMATS[format.toLowerCase()]?.label ?? (format.toUpperCase() || "File");
}

function formatBytes(n: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function groupOf(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= today) return "Today";
  if (t >= today - 86_400_000) return "Yesterday";
  if (t >= today - 6 * 86_400_000) return "Earlier this week";
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return "Earlier this month";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

async function saveItem(item: LibraryItem) {
  const { url, filename, revoke } = await libraryApi.download(item);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * The Library — every image and document shared in chat, and every file
 * UnityWorks made, across all conversations. Files stay where they already
 * live (S3); previews and downloads are short-lived signed links.
 */
export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [viewer, setViewer] = useState<number | null>(null);
  const openFile = useViewerStore((s) => s.open);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useLibrary(tab, debounced);

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const counts = data?.pages[0]?.counts;
  const images = useMemo(() => items.filter((i) => i.kind === "image"), [items]);

  const groups = useMemo(() => {
    const out: Array<{ label: string; items: LibraryItem[] }> = [];
    for (const item of items) {
      const label = groupOf(item.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [items]);

  // Load the next page as the end of the grid comes into view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const everything = counts ? counts.image + counts.document + counts.created : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="page-header">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--accent-gradient)", boxShadow: "0 4px 16px rgba(99,102,241,0.30)" }}
              >
                <Library className="size-[18px] text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[19px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  Library
                </h1>
                <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                  Everything you&apos;ve shared with UnityWorks, and everything it made for you — kept safe in your cloud storage.
                </p>
              </div>
            </div>
            {counts && (
              <div className="flex gap-2">
                <Stat label="Images" value={counts.image} />
                <Stat label="Documents" value={counts.document} />
                <Stat label="Created" value={counts.created} />
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div
              role="tablist"
              aria-label="Filter the library"
              className="flex flex-wrap gap-1 rounded-xl p-1"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border-default)" }}
            >
              {TABS.map(({ id, label, Icon }) => {
                const active = tab === id;
                const n = !counts ? null : id === "all" ? everything : counts[id];
                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(id)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors"
                    style={active
                      ? { background: "var(--accent-subtle)", color: "var(--accent-bright)", boxShadow: "inset 0 0 0 1px var(--accent-border)" }
                      : { color: "var(--text-tertiary)" }}
                  >
                    <Icon className="size-3.5" />
                    {label}
                    {n !== null && <span className="text-[11px] tabular-nums opacity-70">{n}</span>}
                  </button>
                );
              })}
            </div>
            <label
              className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border-default)" }}
            >
              <Search className="size-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name…"
                aria-label="Search the library"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" className="icon-btn size-5">
                  <X className="size-3" />
                </button>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 pb-12 pt-2">
          {isLoading ? (
            <LibraryGridSkeleton />
          ) : isError ? (
            <Notice
              title="Couldn't load your library"
              body="Check your connection and try again."
              action={<button onClick={() => void refetch()} className="ghost-btn px-3 py-1.5 text-[12.5px] font-medium">Try again</button>}
            />
          ) : items.length === 0 ? (
            <EmptyState tab={tab} query={debounced} />
          ) : (
            <div className="flex flex-col gap-8">
              {groups.map((group) => (
                <section key={group.label}>
                  <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {group.label}
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                    {group.items.map((item) =>
                      item.kind === "image" ? (
                        <ImageTile
                          key={`image-${item.id}`}
                          item={item}
                          onOpen={() => setViewer(images.findIndex((x) => x.id === item.id))}
                        />
                      ) : (
                        <FileTile
                          key={`${item.kind}-${item.id}`}
                          item={item}
                          onOpen={() => openFile({
                            kind: item.kind === "created" ? "artifact" : "chat_document",
                            id: item.id,
                            title: item.name,
                            filename: item.filename,
                            extension: item.format,
                          })}
                        />
                      ),
                    )}
                  </div>
                </section>
              ))}
              <div ref={sentinel} className="flex justify-center py-4">
                {isFetchingNextPage && <Loader2 className="size-4 animate-spin" style={{ color: "var(--text-muted)" }} />}
              </div>
            </div>
          )}
        </div>
      </div>

      {viewer !== null && images[viewer] && (
        <Lightbox items={images} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}

// ── Tiles ─────────────────────────────────────────────────────────────────

/** A preview for an image: its signed link, or its bytes through the API. */
function useImageSrc(item: LibraryItem): string | null {
  const [fetched, setFetched] = useState<string | null>(null);
  useEffect(() => {
    if (item.preview_url) return;
    let url: string | null = null;
    let cancelled = false;
    libraryApi
      .imageBlobUrl(item.id)
      .then((u) => {
        if (cancelled) URL.revokeObjectURL(u);
        else {
          url = u;
          setFetched(u);
        }
      })
      .catch(() => setFetched(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.id, item.preview_url]);
  return item.preview_url ?? fetched;
}

const TILE_STYLE: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
};

function ImageTile({ item, onOpen }: { item: LibraryItem; onOpen: () => void }) {
  const src = useImageSrc(item);
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={TILE_STYLE}>
      <button onClick={onOpen} aria-label={`Open ${item.name}`} className="block w-full cursor-zoom-in">
        <div className="aspect-[4/3] w-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={item.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ImageIcon className="size-6 animate-pulse" style={{ color: "var(--text-muted)" }} />
            </div>
          )}
        </div>
      </button>
      <TileFooter item={item} />
      <TileActions item={item} />
    </div>
  );
}

function FileTile({ item, onOpen }: { item: LibraryItem; onOpen: () => void }) {
  const s = formatStyle(item.format);
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={TILE_STYLE}>
      <button
        onClick={onOpen}
        aria-label={`Open ${item.name}`}
        className="relative flex aspect-[4/3] w-full cursor-pointer items-center justify-center"
        style={{ background: `linear-gradient(145deg, ${s.color}24, ${s.color}08)` }}
      >
        <div
          className="flex size-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105"
          style={{ background: `${s.color}1f`, border: `1px solid ${s.color}40` }}
        >
          <s.Icon className="size-7" style={{ color: s.color }} />
        </div>
        <span
          className="absolute left-3 top-3 rounded-md px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: `${s.color}26`, color: s.color }}
        >
          {formatLabel(item.format)}
        </span>
        {item.kind === "created" && (
          <span
            className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: "var(--accent-subtle)", color: "var(--accent-bright)", border: "1px solid var(--accent-border)" }}
          >
            <Sparkles className="size-2.5" /> Created
          </span>
        )}
      </button>
      <TileFooter item={item} />
      <TileActions item={item} />
    </div>
  );
}

function TileFooter({ item }: { item: LibraryItem }) {
  const meta = [
    formatBytes(item.size_bytes),
    item.page_count ? `${item.page_count} page${item.page_count === 1 ? "" : "s"}` : null,
    item.width && item.height ? `${item.width}×${item.height}` : null,
    timeAgo(item.created_at),
  ].filter(Boolean).join(" · ");
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
      <p className="truncate text-[12.5px] font-medium" style={{ color: "var(--text-primary)" }} title={item.name}>
        {item.name}
      </p>
      <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{meta}</p>
      <p className="flex min-w-0 items-center gap-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        {item.conversation_title ? (
          <>
            <MessageSquare className="size-3 shrink-0" />
            <span className="truncate">{item.conversation_title}</span>
          </>
        ) : item.kind === "created" ? (
          <>
            <Sparkles className="size-3 shrink-0" />
            <span className="truncate">Made with UnityWorks</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

function TileActions({ item }: { item: LibraryItem }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function onDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (state === "busy") return;
    setState("busy");
    try {
      await saveItem(item);
      setState("done");
      window.setTimeout(() => setState("idle"), 1500);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2500);
    }
  }

  const btn =
    "pointer-events-auto flex size-8 items-center justify-center rounded-lg text-white backdrop-blur-md transition-transform duration-150 hover:scale-105";
  const btnStyle: React.CSSProperties = { background: "rgba(10,10,18,0.62)", border: "1px solid rgba(255,255,255,0.14)" };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-[4/3] items-end justify-end gap-1.5 p-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
      {item.conversation_id && (
        <Link href={`/chat/${item.conversation_id}`} title="Open the chat" aria-label="Open the chat" className={btn} style={btnStyle}>
          <MessageSquare className="size-3.5" />
        </Link>
      )}
      <button onClick={(e) => void onDownload(e)} title="Download" aria-label={`Download ${item.name}`} className={btn} style={btnStyle}>
        {state === "busy" ? <Loader2 className="size-3.5 animate-spin" />
          : state === "done" ? <Check className="size-3.5" />
          : state === "error" ? <X className="size-3.5" />
          : <Download className="size-3.5" />}
      </button>
    </div>
  );
}

// ── Viewer ────────────────────────────────────────────────────────────────

function Lightbox({
  items, index, onIndex, onClose,
}: {
  items: LibraryItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const item = items[index]!;
  const src = useImageSrc(item);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
      else if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndex]);

  const btn = "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-white/15";
  const btnStyle: React.CSSProperties = { background: "rgba(255,255,255,0.08)" };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col animate-fade-in"
      style={{ background: "rgba(5,5,10,0.92)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-white">{item.name}</p>
          <p className="text-[11px] text-white/60">
            {index + 1} of {items.length} · {timeAgo(item.created_at)}
            {item.conversation_title ? ` · ${item.conversation_title}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.conversation_id && (
            <Link href={`/chat/${item.conversation_id}`} className={btn} style={btnStyle}>
              <MessageSquare className="size-3.5" /> Open chat
            </Link>
          )}
          <button onClick={() => void saveItem(item)} className={btn} style={btnStyle}>
            <Download className="size-3.5" /> Download
          </button>
          <button onClick={onClose} aria-label="Close" className={btn} style={btnStyle}>
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 pb-8">
        {index > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onIndex(index - 1); }}
            aria-label="Previous image"
            className="absolute left-4 flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
            style={btnStyle}
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.name}
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <Loader2 className="size-6 animate-spin text-white/70" />
        )}
        {index < items.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onIndex(index + 1); }}
            aria-label="Next image"
            className="absolute right-4 flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
            style={btnStyle}
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── States ────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[72px] rounded-xl px-3 py-1.5 text-center" style={{ background: "var(--surface-1)", border: "1px solid var(--border-default)" }}>
      <p className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

const EMPTY: Record<Tab, { title: string; body: string }> = {
  all: {
    title: "Your library is empty",
    body: "Attach an image or a document in chat, or ask UnityWorks to create a PDF or a spreadsheet — it will all appear here.",
  },
  image: { title: "No images yet", body: "Images you attach in chat will appear here." },
  document: { title: "No documents yet", body: "PDFs, Word files and spreadsheets you attach in chat will appear here." },
  created: {
    title: "Nothing created yet",
    body: "Ask in chat — “Create an Excel of…”, or “Make a PDF of this document” — and the file will be kept here.",
  },
};

function EmptyState({ tab, query }: { tab: Tab; query: string }) {
  if (query) {
    return <Notice title={`No matches for “${query}”`} body="Try a different name, or another filter." />;
  }
  const copy = EMPTY[tab];
  return (
    <Notice
      title={copy.title}
      body={copy.body}
      action={
        <Link
          href="/chat"
          className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-medium text-white"
          style={{ background: "var(--accent-gradient)", boxShadow: "0 4px 14px rgba(99,102,241,0.28)" }}
        >
          <MessageSquare className="size-3.5" /> Start a chat
        </Link>
      }
    />
  );
}

function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 pt-24 text-center animate-fade-in-up">
      <div
        className="flex size-14 items-center justify-center rounded-2xl"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)" }}
      >
        <Library className="size-6" style={{ color: "var(--text-muted)" }} />
      </div>
      <p className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
      <p className="max-w-[380px] text-[12.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>{body}</p>
      {action}
    </div>
  );
}
