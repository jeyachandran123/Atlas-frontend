"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImageOff, Maximize2, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import { chatImageKey, useChatImageSrc } from "@/lib/hooks/use-chat-image";

export interface ChatImageItem {
  key: string;
  /** The saved image's id; null while its message is still being sent. */
  id: string | null;
  name: string;
  /** A local preview (object or data URL) of the file just picked — drawn at once. */
  localSrc: string | null;
  width?: number | null;
  height?: number | null;
}

/**
 *   single — one image, drawn at its own proportions
 *   tile   — a square in a grid of several
 *   thumb  — a small square in the edit box, removable
 */
export type ChatImageVariant = "single" | "tile" | "thumb";

const SINGLE = { w: 320, h: 280 };
const TILE_PX = 136;
const THUMB_PX = 64;
const GRID_MAX = 6;

/** The frame a picture is drawn in, and whether the picture fills it. */
function frameFor(item: ChatImageItem, variant: ChatImageVariant, loaded: boolean): {
  style: React.CSSProperties;
  fills: boolean;
} {
  if (variant === "tile") return { style: { width: "100%", aspectRatio: "1 / 1" }, fills: true };
  if (variant === "thumb") return { style: { width: THUMB_PX, height: THUMB_PX }, fills: true };
  if (item.width && item.height) {
    // The saved size gives the exact shape before a byte arrives.
    const scale = Math.min(SINGLE.w / item.width, SINGLE.h / item.height, 1);
    return {
      style: {
        width: Math.max(96, Math.round(item.width * scale)),
        height: Math.max(72, Math.round(item.height * scale)),
        maxWidth: "100%",
      },
      fills: true,
    };
  }
  // No saved size (a local preview, an older upload): a steady box until it loads.
  return { style: loaded ? {} : { width: 240, height: 170 }, fills: false };
}

/**
 * One image in a chat message. Its space is held before the picture arrives,
 * so nothing below it moves when it lands; a shimmer keeps the place and the
 * picture fades in. A file just sent shows from its local preview, with no
 * download at all; a saved one comes from a cached signed link.
 */
export function ChatImage({
  item, variant = "single", onOpen, onRemove, more = 0,
}: {
  item: ChatImageItem;
  variant?: ChatImageVariant;
  onOpen?: () => void;
  onRemove?: () => void;
  /** Images left out after this one — drawn as "+N" over it. */
  more?: number;
}) {
  const queryClient = useQueryClient();
  const remote = useChatImageSrc(item.id, !item.localSrc);
  const src = item.localSrc ?? remote.data ?? null;

  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retried, setRetried] = useState(false);

  const { style: frame, fills } = frameFor(item, variant, loaded);
  const unavailable = failed || remote.isError;
  const openable = !!onOpen && !unavailable;
  const radius = variant === "thumb" ? "rounded-xl" : "rounded-2xl";

  function handleError() {
    // A signed link may have lapsed while the chat sat open: one fresh link, then give up.
    if (!item.localSrc && item.id && !retried) {
      setRetried(true);
      setLoaded(false);
      void queryClient.invalidateQueries({ queryKey: chatImageKey(item.id) });
      return;
    }
    setFailed(true);
  }

  return (
    <div
      className={cn("group/img relative shrink-0 overflow-hidden", radius)}
      style={{
        ...frame,
        maxHeight: variant === "single" ? SINGLE.h : undefined,
        background: "var(--surface-2)",
        border: "1px solid var(--border-default)",
        boxShadow: variant === "thumb" ? undefined : "var(--shadow-sm)",
      }}
    >
      <button
        type="button"
        onClick={openable ? onOpen : undefined}
        disabled={!openable}
        aria-label={`Open ${item.name}`}
        title={item.name}
        className={cn(
          "block size-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-border)]",
          radius,
          openable ? "cursor-zoom-in" : "cursor-default",
        )}
      >
        {!loaded && !unavailable && <Skeleton className="absolute inset-0 rounded-none" />}

        {src && !unavailable && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={item.name}
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={handleError}
            className={cn(
              "block transition-[opacity,transform] duration-300 ease-out",
              openable && "group-hover/img:scale-[1.03]",
            )}
            style={
              fills
                ? { width: "100%", height: "100%", objectFit: "cover", opacity: loaded ? 1 : 0 }
                : {
                    maxWidth: SINGLE.w, maxHeight: SINGLE.h, width: "auto", height: "auto",
                    opacity: loaded ? 1 : 0,
                    ...(loaded ? {} : { position: "absolute", inset: 0 }),
                  }
            }
          />
        )}

        {unavailable && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center text-[11px]"
            style={{ color: "var(--text-muted)" }}>
            <ImageOff className="size-4" />
            {variant !== "thumb" && "Image unavailable"}
          </span>
        )}

        {more > 0 && (
          <span className="absolute inset-0 flex items-center justify-center text-[20px] font-semibold text-white"
            style={{ background: "rgba(0,0,0,0.55)" }}>
            +{more}
          </span>
        )}
      </button>

      {loaded && openable && !more && variant !== "thumb" && (
        <span
          className="pointer-events-none absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg opacity-0 transition-opacity duration-150 group-hover/img:opacity-100"
          style={{ background: "rgba(10,10,18,0.62)", color: "#fff", backdropFilter: "blur(6px)" }}
          aria-hidden
        >
          <Maximize2 className="size-3.5" />
        </span>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.name}`}
          title="Remove"
          className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full text-white transition-transform hover:scale-110"
          style={{ background: "rgba(0,0,0,0.75)" }}
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

/** A message's images: one at its own shape, several as a tidy square grid. */
export function ChatImageGallery({ images, onOpen }: { images: ChatImageItem[]; onOpen: (index: number) => void }) {
  if (images.length === 0) return null;
  if (images.length === 1) return <ChatImage item={images[0]!} onOpen={() => onOpen(0)} />;

  const cols = images.length === 2 || images.length === 4 ? 2 : 3;
  const shown = images.slice(0, GRID_MAX);
  const hidden = images.length - shown.length;
  return (
    <div
      className="inline-grid max-w-full gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, ${TILE_PX}px))` }}
    >
      {shown.map((img, i) => (
        <ChatImage
          key={img.key}
          item={img}
          variant="tile"
          onOpen={() => onOpen(i)}
          more={i === shown.length - 1 ? hidden : 0}
        />
      ))}
    </div>
  );
}
