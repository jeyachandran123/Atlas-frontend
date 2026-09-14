"use client";

import {
  FileSpreadsheet,
  FileSearch2,
  Sigma,
  GitCompareArrows,
  Sparkles,
  ScanText,
} from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * The workspace's new-conversation screen.
 *
 * Deliberately the same shape as the coding assistant's: the two surfaces are
 * one product, and a user who has seen one already knows how to start here.
 * What differs is only what the cards offer, because the thing in front of
 * them is a set of documents rather than a repository.
 */

const ACTIONS = [
  {
    label: "Summarise",
    icon: ScanText,
    template: "Read this document and tell me what it is",
    hint: "What is this, in short",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.10)",
    border: "rgba(99,102,241,0.20)",
  },
  {
    label: "Find a detail",
    icon: FileSearch2,
    template: "What does the document say about ",
    hint: "Answered with citations",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.10)",
    border: "rgba(96,165,250,0.20)",
  },
  {
    label: "Count or total",
    icon: Sigma,
    template: "How many ",
    hint: "Computed over every row",
    color: "#34d399",
    bg: "rgba(52,211,153,0.10)",
    border: "rgba(52,211,153,0.20)",
  },
  {
    label: "Compare",
    icon: GitCompareArrows,
    template: "Compare ",
    hint: "Across your documents",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.20)",
  },
  {
    label: "Filter rows",
    icon: FileSpreadsheet,
    template: "Keep only the rows where ",
    hint: "Into a new spreadsheet",
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.20)",
  },
  {
    label: "Generate a file",
    icon: Sparkles,
    template: "Create a report of ",
    hint: "Excel, Word, PDF, CSV",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.10)",
    border: "rgba(167,139,250,0.20)",
  },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function WorkspaceHero({
  onPick,
  documentCount,
}: {
  onPick: (template: string) => void;
  documentCount: number;
}) {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.full_name?.split(" ")[0];

  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-[640px]">
        {/* Hero */}
        <div className="mb-10 flex flex-col items-center text-center animate-fade-up">
          <div className="relative mb-7">
            <div
              className="absolute inset-0 rounded-3xl blur-2xl"
              style={{
                background: "var(--accent-gradient)",
                transform: "scale(1.7)",
                opacity: 0.26,
              }}
            />
            <div
              className="relative flex h-[64px] w-[64px] items-center justify-center rounded-[20px]"
              style={{
                background: "var(--accent-gradient)",
                boxShadow:
                  "0 0 0 1px var(--accent-border), 0 12px 40px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <div
                className="absolute inset-0 rounded-[20px]"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,0.14) 0%, transparent 50%)",
                }}
              />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="relative z-10">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.95" />
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
              </svg>
            </div>
          </div>

          <h1
            className="text-[30px] font-semibold"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.035em", lineHeight: 1.15 }}
          >
            {firstName ? `${greeting()}, ${firstName}` : greeting()}
          </h1>
          <p
            className="mt-3 max-w-[440px] text-[14px] leading-relaxed"
            style={{ color: "var(--text-tertiary)" }}
          >
            {documentCount > 0
              ? `Ask me anything about your ${documentCount} document${
                  documentCount === 1 ? "" : "s"
                } — I read them, compute over them, and generate new files from them.`
              : "Attach a document to begin — I read Excel, PDF, Word, CSV and scans, answer with citations, and generate new files. Or just say hello."}
          </p>
        </div>

        {/* Quick actions */}
        <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {ACTIONS.map(({ label, icon: Icon, template, hint, color, bg, border }, i) => (
              <button
                key={label}
                onClick={() => onPick(template)}
                className="quick-action group relative flex items-center gap-3 rounded-xl px-4 py-3 text-left animate-fade-in-up"
                style={
                  {
                    animationDelay: `${i * 35}ms`,
                    "--qa-bg": bg,
                    "--qa-border": border,
                    "--qa-glow": bg,
                  } as React.CSSProperties
                }
              >
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  <Icon className="size-4" style={{ color }} />
                </div>
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
                <div
                  className="shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0.5"
                  style={{ color }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
