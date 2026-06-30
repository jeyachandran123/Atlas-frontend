"use client";

import { Bug, FileSearch2, Sparkles, TestTube2, ShieldCheck, BookOpen } from "lucide-react";

const QUICK_ACTIONS = [
  { label: "Explain", icon: BookOpen, template: "Explain how " },
  { label: "Find", icon: FileSearch2, template: "Where is " },
  { label: "Fix", icon: Bug, template: "Fix this error: " },
  { label: "Generate", icon: Sparkles, template: "Generate " },
  { label: "Test", icon: TestTube2, template: "Write tests for " },
  { label: "Review", icon: ShieldCheck, template: "Review " },
];

export function QuickActions({ onPick }: { onPick: (template: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {QUICK_ACTIONS.map(({ label, icon: Icon, template }) => (
        <button
          key={label}
          onClick={() => onPick(template)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-signal/30 hover:text-text-primary"
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
