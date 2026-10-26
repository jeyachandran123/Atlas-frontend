"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Code2, FilePlus2, FileSpreadsheet, FileText, ListChecks, PenLine } from "lucide-react";
import { useRepos } from "@/lib/hooks/use-repos";
import type { AgentMode } from "@/types/api";

/** What a card hands the prompt box: a template with [blanks], maybe files, and the mode to use. */
export interface QuickStart {
  text: string;
  files?: File[];
  mode: AgentMode;
}

interface Card {
  label: string;
  hint: string;
  icon: React.ElementType;
  text: string;
  mode: AgentMode;
  /** Ask for a file first, of this kind. */
  pick?: "document" | "spreadsheet";
  /** Needs an indexed repository to mean anything. */
  needsRepo?: boolean;
  color: string;
}

const DOCUMENT_ACCEPT = ".pdf,.docx,.txt,.md";
const SPREADSHEET_ACCEPT = ".xlsx,.xlsm,.csv,.tsv";

/**
 * Where to start — one card per thing UnityWorks does well. A card never
 * sends anything: it fills the prompt box with a template whose [blanks] the
 * user completes (Tab jumps between them), attaching a file first when the
 * task needs one, and switching to the mode the task runs best in.
 */
const CARDS: Card[] = [
  {
    label: "Ask about a document",
    hint: "Summaries, answers, key points",
    icon: FileText,
    pick: "document",
    mode: "auto",
    text: "Summarise the key points of this document, and tell me [anything specific you want to know].",
    color: "#6366f1",
  },
  {
    label: "Analyse a spreadsheet",
    hint: "Totals, trends, filters",
    icon: FileSpreadsheet,
    pick: "spreadsheet",
    mode: "auto",
    text: "What is the total [amount column] for each [category column]?",
    color: "#34d399",
  },
  {
    label: "Create a PDF or Excel",
    hint: "Reports and tables, made for you",
    icon: FilePlus2,
    mode: "auto",
    text: "Create [an Excel sheet / a PDF report] of [topic], with [the columns or sections you want].",
    color: "#60a5fa",
  },
  {
    label: "Work on your code",
    hint: "Explain, fix, review or test",
    icon: Code2,
    mode: "code",
    needsRepo: true,
    text: "In my code, [explain / fix / review / write tests for] [the feature, file or error].",
    color: "#f87171",
  },
  {
    label: "Plan something",
    hint: "Steps, timeline and risks",
    icon: ListChecks,
    mode: "planning",
    text: "Help me plan [your goal] — the steps, a rough timeline, and the risks to watch.",
    color: "#a78bfa",
  },
  {
    label: "Write or rewrite",
    hint: "Emails, docs, clearer wording",
    icon: PenLine,
    mode: "auto",
    text: "Rewrite this to sound [more professional / simpler / friendlier]: [paste your text]",
    color: "#fbbf24",
  },
];

export function QuickActions({ onPick }: { onPick: (start: QuickStart) => void }) {
  const router = useRouter();
  const { data: repos } = useRepos();
  // Unknown while loading: assume a repository, rather than flash "connect one".
  // "stale" is still searchable — only behind the latest commits.
  const hasRepo = repos === undefined || repos.some((r) => r.index_status === "ready" || r.index_status === "stale");

  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Card | null>(null);

  function choose(card: Card) {
    if (card.needsRepo && !hasRepo) {
      router.push("/repos");
      return;
    }
    if (card.pick) {
      // The picker has to open inside this click, so the card owns it.
      pendingRef.current = card;
      const el = fileRef.current;
      if (!el) return;
      el.accept = card.pick === "spreadsheet" ? SPREADSHEET_ACCEPT : DOCUMENT_ACCEPT;
      el.value = "";
      el.click();
      return;
    }
    onPick({ text: card.text, mode: card.mode });
  }

  function onFiles(files: FileList | null) {
    const card = pendingRef.current;
    pendingRef.current = null;
    const picked = Array.from(files ?? []);
    if (!card || picked.length === 0) return; // cancelled — nothing to start
    onPick({ text: card.text, files: picked, mode: card.mode });
  }

  return (
    <>
      <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {CARDS.map((card, i) => {
          const blocked = card.needsRepo && !hasRepo;
          const { icon: Icon, color } = card;
          const bg = `${color}1a`;
          const border = `${color}33`;
          return (
            <button
              key={card.label}
              onClick={() => choose(card)}
              title={blocked ? "Connect a repository first — opens Knowledge" : undefined}
              className="quick-action group relative flex items-center gap-3 rounded-xl px-4 py-3 text-left animate-fade-in-up"
              style={{
                animationDelay: `${i * 35}ms`,
                "--qa-bg": bg,
                "--qa-border": border,
                "--qa-glow": `${color}29`,
              } as React.CSSProperties}
            >
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
                style={{ background: bg, border: `1px solid ${border}` }}
              >
                <Icon className="size-4" style={{ color }} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                  {card.label}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
                  {blocked ? "Connect a repository first" : card.hint}
                </p>
              </div>

              <div
                className="shrink-0 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                style={{ color }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
