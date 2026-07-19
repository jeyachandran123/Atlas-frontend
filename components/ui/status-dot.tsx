import { cn } from "@/lib/utils/cn";

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "accent";

const TONE_COLOR: Record<StatusTone, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  neutral: "var(--text-muted)",
  accent: "var(--accent-bright)",
};

/**
 * Semantic status indicator dot. `pulse` adds the live glow used for
 * in-progress states (indexing, streaming).
 */
export function StatusDot({
  tone,
  pulse = false,
  className,
}: {
  tone: StatusTone;
  pulse?: boolean;
  className?: string;
}) {
  const color = TONE_COLOR[tone];
  return (
    <span
      aria-hidden
      className={cn("inline-block size-1.5 shrink-0 rounded-full", className)}
      style={{
        background: color,
        boxShadow: pulse ? `0 0 6px ${color}` : undefined,
        animation: pulse ? "pulse-glow 2s ease-in-out infinite" : undefined,
      }}
    />
  );
}
