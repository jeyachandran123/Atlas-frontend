"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

/**
 * App-standard tooltip. Wrap subtrees that use tooltips in <TooltipProvider>
 * once (e.g. the dashboard shell), then:
 *
 *   <Tooltip content="Re-index" side="bottom"><button …/></Tooltip>
 */
export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  side = "top",
  shortcut,
  children,
}: {
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  shortcut?: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Root delayDuration={350}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[70] flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium animate-scale-up"
          style={{
            background: "var(--surface-overlay)",
            backdropFilter: "blur(16px)",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
            color: "var(--text-primary)",
          }}
        >
          {content}
          {shortcut && <kbd className="kbd">{shortcut}</kbd>}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
