"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * App-standard confirmation dialog — replaces window.confirm() everywhere.
 * Controlled: the caller owns `open` and runs the destructive action in
 * `onConfirm`; pass `pending` while the mutation is in flight.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-[400px] -translate-x-1/2 -translate-y-1/2 animate-scale-up px-4 outline-none"
        >
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow-2xl)",
            }}
          >
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, var(--danger), transparent)", opacity: 0.5 }}
            />
            <div className="flex flex-col gap-5 p-6">
              <div className="flex items-start gap-3.5">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)" }}
                >
                  <AlertTriangle className="size-4.5" style={{ color: "var(--danger)" }} />
                </div>
                <div className="min-w-0">
                  <Dialog.Title
                    className="text-[15px] font-semibold"
                    style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
                  >
                    {title}
                  </Dialog.Title>
                  <Dialog.Description
                    className="mt-1 text-[13px] leading-relaxed"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {description}
                  </Dialog.Description>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button
                    disabled={pending}
                    className="ghost-btn px-4 py-2 text-[13px] font-medium"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={onConfirm}
                  disabled={pending}
                  autoFocus
                  className="danger-btn flex items-center gap-2 px-4 py-2 text-[13px] font-semibold"
                >
                  {pending && <Loader2 className="size-3.5 animate-spin" />}
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
