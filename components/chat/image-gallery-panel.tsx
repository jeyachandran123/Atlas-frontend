"use client";

import { useEffect, useState } from "react";
import { X, ImageIcon } from "lucide-react";
import { useChatStore } from "@/lib/stores/chat-store";
import { useMessages } from "@/lib/hooks/use-chat";
import { getAccessToken } from "@/lib/api/token-store";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";

export function ImageGalleryPanel({ onClose }: { onClose: () => void }) {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const zustandGallery = useChatStore((s) => s.galleryImages);
  const { data: messages = [] } = useMessages(activeConversationId);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [resolvedImages, setResolvedImages] = useState<Array<{ id: string; url: string; name: string }>>([]);

  // Fetch API images with auth
  const apiImageMetas = messages
    .filter((m) => m.images && m.images.length > 0)
    .flatMap((m) => m.images!);

  useEffect(() => {
    if (apiImageMetas.length === 0) {
      setResolvedImages([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      apiImageMetas.map(async (img) => {
        const token = getAccessToken();
        const res = await fetch(`${API_BASE}${img.url}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        return { id: img.id, url: URL.createObjectURL(blob), name: img.filename };
      })
    ).then((results) => {
      if (!cancelled) setResolvedImages(results.filter(Boolean) as Array<{ id: string; url: string; name: string }>);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiImageMetas.length, activeConversationId]);

  // Merge: resolved API images + zustand extras
  const apiIds = new Set(resolvedImages.map((i) => i.id));
  const extraZustand = zustandGallery
    .filter((img) => !apiIds.has(img.id))
    .map((img) => ({ id: img.id, url: img.url, name: img.name }));
  const allImages = [...resolvedImages, ...extraZustand];

  return (
    <>
      {expandedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center cursor-zoom-out"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}

      <div
        className="flex flex-col h-full"
        style={{
          width: "var(--sidebar-width, 248px)",
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div
              className="flex size-7 items-center justify-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)",
                boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
              }}
            >
              <ImageIcon className="size-3.5 text-white" />
            </div>
            <span
              className="text-[14px] font-semibold"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
            >
              Gallery
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded-md transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="px-4 pb-2">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {allImages.length} image{allImages.length !== 1 ? "s" : ""} uploaded
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {allImages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 pt-16">
              <div
                className="flex size-12 items-center justify-center rounded-xl"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)" }}
              >
                <ImageIcon className="size-5" style={{ color: "var(--text-muted)" }} />
              </div>
              <p className="text-[12px] text-center" style={{ color: "var(--text-muted)" }}>
                No images yet.
                <br />
                Upload images in chat to see them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[...allImages].reverse().map((img) => (
                <div
                  key={img.id}
                  className="group relative cursor-zoom-in overflow-hidden rounded-lg transition-transform hover:scale-[1.03]"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-default)",
                    aspectRatio: "1",
                  }}
                  onClick={() => setExpandedImage(img.url)}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="h-full w-full object-cover"
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}
                  >
                    <p className="truncate text-[10px] text-white">{img.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
