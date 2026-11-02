"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, ImageOff, Loader2, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface LightboxImage {
  key: string;
  name: string;
  /** A URL that can be shown straight away — a local preview, a known link. */
  src?: string | null;
  /** How to get one otherwise. Asked for when the image is shown, and ahead of time for its neighbours. */
  resolve?: () => Promise<string>;
  /** A line under the name: when, where from. */
  meta?: string;
  /** One more place to go — the chat an image came from. */
  link?: { label: string; href: string; icon?: React.ElementType };
  download: () => void | Promise<void>;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const STEP = 0.5;
/** Up to this many images, every thumbnail in the strip is fetched up front. */
const PRELOAD_ALL = 12;

const PILL: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
};

/**
 * Full-screen image viewing for the whole app — chat attachments and the
 * Library alike. Rendered into <body>, so no transformed or clipped ancestor
 * can trap it. Wheel, double-click or + / − to zoom and drag to look around;
 * arrows or the strip to move between images; Esc or the backdrop to close.
 */
export function ImageLightbox({
  images, index, onIndex, onClose,
}: {
  images: LightboxImage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const image = images[index];
  const count = images.length;

  const [srcs, setSrcs] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragFrom = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const requested = useRef(new Set<string>());
  const closeRef = useRef<HTMLButtonElement>(null);

  const srcOf = (img: LightboxImage) => img.src ?? srcs[img.key] ?? null;

  // The image on show and its neighbours, so moving between them is instant.
  useEffect(() => {
    const wanted = count <= PRELOAD_ALL ? images.map((_, i) => i) : [index, index + 1, index - 1];
    for (const i of wanted) {
      const img = images[i];
      if (!img || img.src || !img.resolve || requested.current.has(img.key)) continue;
      requested.current.add(img.key);
      img.resolve().then(
        (url) => setSrcs((m) => ({ ...m, [img.key]: url })),
        () => setFailed((m) => ({ ...m, [img.key]: true })),
      );
    }
  }, [images, index, count]);

  // Every image opens fitted to the screen.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setLoaded(false);
  }, [index]);

  const zoomTo = useCallback((z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));
    setZoom(next);
    if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && index < count - 1) onIndex(index + 1);
      else if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      else if (e.key === "+" || e.key === "=") zoomTo(zoom + STEP);
      else if (e.key === "-") zoomTo(zoom - STEP);
      else if (e.key === "0") zoomTo(MIN_ZOOM);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, zoom, onClose, onIndex, zoomTo]);

  // The page behind stays put, and focus returns to where it was on closing.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  if (!image) return null;
  const src = srcOf(image);
  const broken = !!failed[image.key];
  const LinkIcon = image.link?.icon;

  async function download() {
    try {
      await image!.download();
    } catch {
      toast.error("Download failed");
    }
  }

  const iconBtn =
    "flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-30";
  const textBtn =
    "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-medium text-white/90 transition-colors hover:bg-white/15 hover:text-white";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.name}
      className="fixed inset-0 z-[140] flex select-none flex-col animate-fade-in"
      style={{ background: "rgba(4,4,8,0.94)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="relative z-10 flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate text-[13.5px] font-medium text-white" title={image.name}>{image.name}</p>
          {(count > 1 || image.meta) && (
            <p className="truncate text-[11.5px] text-white/55">
              {count > 1 ? `${index + 1} of ${count}` : ""}
              {count > 1 && image.meta ? " · " : ""}
              {image.meta}
            </p>
          )}
        </div>

        <div className="hidden items-center gap-0.5 rounded-full p-1 sm:flex" style={PILL}>
          <button className={iconBtn} onClick={() => zoomTo(zoom - STEP)} disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out" title="Zoom out  ( − )">
            <Minus className="size-4" />
          </button>
          <button onClick={() => zoomTo(MIN_ZOOM)} title="Fit to screen  ( 0 )" aria-label="Fit to screen"
            className="min-w-[3.5rem] rounded-full px-2 py-1.5 text-[12px] tabular-nums text-white/80 transition-colors hover:bg-white/10">
            {Math.round(zoom * 100)}%
          </button>
          <button className={iconBtn} onClick={() => zoomTo(zoom + STEP)} disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in" title="Zoom in  ( + )">
            <Plus className="size-4" />
          </button>
        </div>

        {image.link && (
          <Link href={image.link.href} onClick={onClose} className={cn(textBtn, "hidden sm:flex")} style={PILL}>
            {LinkIcon && <LinkIcon className="size-3.5" />}
            {image.link.label}
          </Link>
        )}
        <button onClick={() => void download()} className={textBtn} style={PILL} aria-label={`Download ${image.name}`}>
          <Download className="size-3.5" />
          <span className="hidden sm:inline">Download</span>
        </button>
        <button ref={closeRef} onClick={onClose} className={iconBtn} style={PILL} aria-label="Close" title="Close  ( Esc )">
          <X className="size-[18px]" />
        </button>
      </div>

      {/* Stage */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4 sm:px-20"
        onWheel={(e) => zoomTo(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))}
      >
        {!loaded && !broken && <Loader2 className="absolute size-7 animate-spin text-white/60" />}

        {broken ? (
          <div className="flex flex-col items-center gap-3 text-center" onClick={(e) => e.stopPropagation()}>
            <ImageOff className="size-9 text-white/45" />
            <p className="text-[13px] text-white/70">This image couldn&apos;t be loaded.</p>
            <button onClick={() => void download()} className={textBtn} style={PILL}>
              <Download className="size-3.5" /> Download instead
            </button>
          </div>
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={image.key}
            src={src}
            alt={image.name}
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed((m) => ({ ...m, [image.key]: true }))}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={() => zoomTo(zoom > MIN_ZOOM ? MIN_ZOOM : 2)}
            onPointerDown={(e) => {
              if (zoom <= MIN_ZOOM) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              dragFrom.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
              setDragging(true);
            }}
            onPointerMove={(e) => {
              const from = dragFrom.current;
              if (from) setPan({ x: from.px + (e.clientX - from.x), y: from.py + (e.clientY - from.y) });
            }}
            onPointerUp={() => { dragFrom.current = null; setDragging(false); }}
            onPointerCancel={() => { dragFrom.current = null; setDragging(false); }}
            className="max-h-full max-w-full rounded-lg object-contain"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: dragging ? "opacity 200ms" : "transform 160ms ease-out, opacity 200ms",
              opacity: loaded ? 1 : 0,
              cursor: zoom > MIN_ZOOM ? (dragging ? "grabbing" : "grab") : "zoom-in",
              touchAction: "none",
              boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
            }}
          />
        ) : null}

        {index > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onIndex(index - 1); }}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 sm:left-6"
            style={PILL}
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        {index < count - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onIndex(index + 1); }}
            aria-label="Next image"
            className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 sm:right-6"
            style={PILL}
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>

      {/* Filmstrip */}
      {count > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-5 pt-1" onClick={(e) => e.stopPropagation()}>
          {images.map((img, i) => {
            const thumb = srcOf(img);
            return (
              <button
                key={img.key}
                onClick={() => onIndex(i)}
                aria-label={`Show ${img.name}`}
                aria-current={i === index}
                className={cn(
                  "relative size-14 shrink-0 overflow-hidden rounded-lg transition-all duration-150",
                  i === index ? "opacity-100 ring-2 ring-white ring-offset-2 ring-offset-black" : "opacity-45 hover:opacity-90",
                )}
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                {thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" draggable={false} className="size-full object-cover" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>,
    document.body,
  );
}
