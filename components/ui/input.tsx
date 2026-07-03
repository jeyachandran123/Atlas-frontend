import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg border border-border bg-surface-raised px-3 py-1 text-sm text-text-primary",
        "placeholder:text-text-tertiary",
        "transition-all duration-[var(--duration-base)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 focus-visible:border-signal/50 focus-visible:bg-surface",
        "hover:border-border-strong",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
