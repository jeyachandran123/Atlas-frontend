import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-[var(--duration-base)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-1 focus-visible:ring-offset-canvas",
  {
    variants: {
      variant: {
        default:
          "bg-text-primary text-text-inverse hover:bg-text-secondary shadow-sm hover:shadow-md",
        signal:
          "bg-gradient-to-r from-signal to-violet-500 text-white shadow-sm shadow-signal/25 hover:shadow-md hover:shadow-signal/30 hover:brightness-110 active:brightness-95",
        outline:
          "border border-border-strong bg-transparent text-text-primary hover:bg-surface-raised hover:border-border-strong",
        ghost:
          "bg-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary",
        destructive:
          "bg-remove/10 text-remove hover:bg-remove/15 border border-remove/20 hover:border-remove/30",
        link: "text-signal-glow underline-offset-4 hover:underline hover:text-signal",
        glass:
          "glass border-border-strong text-text-primary hover:bg-surface-overlay",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-7 px-3 text-xs rounded-md",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
