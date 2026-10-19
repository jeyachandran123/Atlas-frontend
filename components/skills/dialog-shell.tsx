"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/** The app's standard dialog frame (as in Connect repository), for the skills dialogs. */
export function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  width = 520,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
        />
        <Dialog.Content
          // Radix links the description itself; without one, say so explicitly.
          {...(description ? {} : { "aria-describedby": undefined })}
          className="fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 animate-scale-up px-4 outline-none"
          style={{ maxWidth: width + 32 }}
        >
          <div
            className="relative flex max-h-[85dvh] flex-col overflow-hidden rounded-2xl"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow-2xl)",
            }}
          >
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }}
            />
            <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
              <div className="min-w-0">
                <Dialog.Title
                  className="text-[16px] font-semibold"
                  style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
                >
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-0.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close
                aria-label="Close dialog"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-3)]"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 overflow-y-auto px-6 pb-6">{children}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}
