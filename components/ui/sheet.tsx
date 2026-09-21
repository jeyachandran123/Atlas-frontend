"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils/cn";

type Side = "left" | "bottom";

/**
 * A panel that slides in over the page — the one drawer in the app.
 *
 * `left` is navigation that cannot sit beside the page on a small screen;
 * `bottom` is a panel that belongs at thumb height. Radix Dialog brings the
 * focus trap, escape-to-close and scroll lock, so nothing here reimplements
 * them. The overlay matches ConfirmDialog and the command palette exactly, so
 * every dimmed surface in the app looks like the same surface.
 */
export function Sheet({
  open,
  onOpenChange,
  side = "left",
  title,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: Side;
  /** Named for screen readers; the panel's own header carries it visually. */
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const bottom = side === "bottom";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden outline-none",
            bottom
              ? "animate-sheet-up inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl"
              : "animate-drawer-in inset-y-0 left-0 w-[86vw] max-w-[320px]",
            className,
          )}
          style={{
            background: "var(--sidebar-bg)",
            ...(bottom
              ? { borderTop: "1px solid var(--border-strong)", boxShadow: "var(--shadow-2xl)" }
              : { borderRight: "1px solid var(--border-subtle)" }),
          }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>

          {/* The grab handle reads as "this came up from the bottom, drag or
              tap away to dismiss" without spending a row on a header. */}
          {bottom && (
            <div className="flex shrink-0 justify-center pb-1 pt-2.5">
              <span
                className="h-1 w-9 rounded-full"
                style={{ background: "var(--border-strong)" }}
              />
            </div>
          )}

          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
