import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
  {
    variants: {
      variant: {
        default:   "bg-surface-overlay text-text-secondary border border-border",
        signal:    "bg-signal/12 text-signal-glow border border-signal/20",
        ready:     "bg-status-ready/10 text-status-ready border border-status-ready/20",
        indexing:  "bg-status-indexing/10 text-status-indexing border border-status-indexing/20",
        error:     "bg-status-error/10 text-status-error border border-status-error/20",
        pending:   "bg-surface-overlay text-text-tertiary border border-border",
        info:      "bg-info/10 text-info border border-info/20",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
