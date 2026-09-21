"use client";

import { useState } from "react";
import { Globe, Loader2, ChevronDown } from "lucide-react";
import type { SourceImageOut, WebSourceOut } from "@/types/api";

/**
 * The pages an answer was built from, and — when a picture helps — one or two
 * of them.
 *
 * They sit above the answer because they arrive before the first token: for
 * the seconds the model spends writing, the user already has something real to
 * read and can see where the answer is coming from.
 *
 * The pictures are page previews, not an image search, so any of them may fail
 * to load or turn out to be a logo. Each one hides itself on error rather than
 * leaving a broken box, which means the worst case is one picture instead of
 * two.
 */

function FaviconOrLetter({ source }: { source: WebSourceOut }) {
  const [failed, setFailed] = useState(false);
  if (source.favicon_url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source.favicon_url}
        alt=""
        className="size-4 shrink-0 rounded-sm"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className="flex size-4 shrink-0 items-center justify-center rounded-sm text-[8px] font-bold"
      style={{ background: "var(--surface-3)", color: "var(--text-tertiary)" }}
    >
      {(source.domain || source.title || "?").charAt(0).toUpperCase()}
    </span>
  );
}

function SourceRow({ source }: { source: WebSourceOut }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={source.title || source.url}
      className="group/row flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--surface-2)]"
    >
      <FaviconOrLetter source={source} />
      <span
        className="min-w-0 flex-1 truncate text-[12.5px] transition-colors group-hover/row:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        {source.title || source.url}
      </span>
      <span
        className="hidden shrink-0 text-[11.5px] sm:inline"
        style={{ color: "var(--text-muted)" }}
      >
        {source.domain}
      </span>
    </a>
  );
}

function Picture({ image, wide }: { image: SourceImageOut; wide: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (failed) return null;

  return (
    <a
      href={image.source_url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${image.title}\n${image.source_url}`}
      className={`group/pic relative block shrink-0 overflow-hidden rounded-2xl transition-all duration-200 hover:shadow-lg ${
        wide ? "w-[280px] sm:w-[360px]" : "w-[190px] sm:w-[232px]"
      }`}
      style={{ border: "1px solid var(--border-default)", background: "var(--surface-2)" }}
    >
      {/* A fixed frame, so two pictures of different shapes still line up and
          the answer below them does not jump as each one loads. */}
      <div className="relative aspect-[16/10] w-full">
        {!loaded && <div className="absolute inset-0 animate-pulse" style={{ background: "var(--surface-3)" }} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.title}
          loading="lazy"
          className={`size-full object-cover transition-all duration-300 group-hover/pic:scale-[1.04] ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
        {/* The caption sits on the picture rather than under it, so the row
            keeps one clean edge whatever the titles are. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end p-2.5 pt-8"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0))" }}
        >
          <span className="line-clamp-2 text-[11.5px] font-medium leading-snug text-white/95">
            {image.title}
          </span>
        </div>
      </div>
    </a>
  );
}

export function WebSources({
  sources,
  images = [],
  query,
}: {
  sources: WebSourceOut[];
  images?: SourceImageOut[];
  query?: string | null;
}) {
  // Closed by default. The list is provenance, not the answer — it belongs
  // one click away, so the reply stays the thing you read first. The pictures
  // are different: they are part of understanding the answer, so they sit
  // outside the drawer and stay visible.
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;

  return (
    <div className="mb-3 animate-fade-in-up">
      <button
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex max-w-full items-center gap-2 text-[12.5px] transition-colors"
        style={{ color: "var(--text-tertiary)" }}
      >
        <Globe className="size-3.5 shrink-0" />
        <span className="shrink-0">Searched the web</span>
        {query && (
          <span
            className="max-w-[220px] truncate rounded-md px-1.5 py-0.5 text-[11.5px] font-medium sm:max-w-[320px]"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
          >
            {query}
          </span>
        )}
        {/* Closed by default, so the count is what tells you there is
            something to open. */}
        <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
          {sources.length}
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </button>

      {images.length > 0 && (
        <div className="mb-2.5 flex gap-2.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((image) => (
            // One picture gets the room two would have taken, instead of
            // sitting small against an empty half-row.
            <Picture key={image.url} image={image} wide={images.length === 1} />
          ))}
        </div>
      )}

      {open && (
        <div
          className="overflow-hidden rounded-xl p-1 animate-fade-in"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border-default)" }}
        >
          {sources.map((source, i) => (
            <SourceRow key={source.url + i} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}

/** What the search is doing, while it does it. */
export function SearchStatus({
  stage,
  queries,
  count,
}: {
  stage: "searching" | "reading";
  queries?: string[];
  count?: number;
}) {
  const label =
    stage === "reading"
      ? `Reading ${count ?? 1} ${count === 1 ? "page" : "pages"}`
      : "Searching the web";

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 animate-fade-in-up">
      <span
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
        style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
      >
        <Loader2 className="size-3 animate-spin" />
        {label}
      </span>
      {stage === "searching" &&
        queries?.slice(0, 2).map((q) => (
          <span
            key={q}
            className="max-w-[200px] truncate rounded-full px-2 py-0.5 text-[11px]"
            style={{ background: "var(--surface-2)", color: "var(--text-tertiary)" }}
          >
            {q}
          </span>
        ))}
    </div>
  );
}
