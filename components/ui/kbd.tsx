import { cn } from "@/lib/utils/cn";

/** Keyboard-shortcut hint chip. Renders the `.kbd` design-system style. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("kbd", className)}>{children}</kbd>;
}
