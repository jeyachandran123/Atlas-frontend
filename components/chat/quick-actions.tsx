"use client";

import { Bug, FileSearch2, TestTube2, ShieldCheck, BookOpen, Wand2 } from "lucide-react";

const ACTIONS = [
  {
    label: "Explain code",
    icon: BookOpen,
    template: "Explain how ",
    hint: "Deep technical walkthrough",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.10)",
    border: "rgba(99,102,241,0.20)",
    glow: "rgba(99,102,241,0.18)",
  },
  {
    label: "Find something",
    icon: FileSearch2,
    template: "Where is ",
    hint: "Semantic code search",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.10)",
    border: "rgba(96,165,250,0.20)",
    glow: "rgba(96,165,250,0.16)",
  },
  {
    label: "Fix a bug",
    icon: Bug,
    template: "Fix this error: ",
    hint: "Root cause analysis",
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.20)",
    glow: "rgba(248,113,113,0.16)",
  },
  {
    label: "Build a feature",
    icon: Wand2,
    template: "Build ",
    hint: "Full implementation",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.10)",
    border: "rgba(167,139,250,0.20)",
    glow: "rgba(167,139,250,0.16)",
  },
  {
    label: "Write tests",
    icon: TestTube2,
    template: "Write tests for ",
    hint: "Comprehensive test suite",
    color: "#34d399",
    bg: "rgba(52,211,153,0.10)",
    border: "rgba(52,211,153,0.20)",
    glow: "rgba(52,211,153,0.16)",
  },
  {
    label: "Review code",
    icon: ShieldCheck,
    template: "Review ",
    hint: "Security & quality audit",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.20)",
    glow: "rgba(251,191,36,0.16)",
  },
];

export function QuickActions({ onPick }: { onPick: (template: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {ACTIONS.map(({ label, icon: Icon, template, hint, color, bg, border, glow }, i) => (
        <button
          key={label}
          onClick={() => onPick(template)}
          className="group relative flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200 animate-fade-in-up"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-default)",
            animationDelay: `${i * 35}ms`,
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = bg;
            el.style.borderColor = border;
            el.style.transform = "translateY(-2px)";
            el.style.boxShadow = `0 8px 24px ${glow}, var(--shadow-md)`;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "var(--surface-1)";
            el.style.borderColor = "var(--border-default)";
            el.style.transform = "";
            el.style.boxShadow = "";
          }}
        >
          {/* Icon */}
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
            style={{ background: bg, border: `1px solid ${border}` }}
          >
            <Icon className="size-4" style={{ color }} />
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p
              className="text-[13px] font-medium leading-snug"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
            >
              {label}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
              {hint}
            </p>
          </div>

          {/* Arrow */}
          <div
            className="shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0.5"
            style={{ color }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
      ))}
    </div>
  );
}
