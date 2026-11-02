"use client";

import { cn } from "@/lib/utils/cn";

/** An on/off switch. Controlled: the caller owns `checked`. */
export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Read by screen readers; the switch has no visible text of its own. */
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        // Rows that open on click must not open when the switch is used.
        e.stopPropagation();
        onCheckedChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full outline-none transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      style={{
        background: checked ? "var(--accent-bright)" : "var(--surface-3)",
        border: `1px solid ${checked ? "var(--accent-border)" : "var(--border-default)"}`,
      }}
    >
      <span
        className="block size-3.5 rounded-full bg-white shadow transition-transform duration-150"
        style={{ transform: checked ? "translateX(17px)" : "translateX(2px)" }}
      />
    </button>
  );
}
