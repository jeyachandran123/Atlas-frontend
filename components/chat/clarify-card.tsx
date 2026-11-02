"use client";

import { useState } from "react";
import { ArrowLeft, Check, CornerDownLeft, PencilLine, Sparkles, Wand2 } from "lucide-react";

export interface ClarifyOption {
  label: string;
  description?: string;
}
export interface ClarifyQuestion {
  question: string;
  options: ClarifyOption[];
}
export interface ClarifyPayload {
  intro?: string;
  questions: ClarifyQuestion[];
  format?: string;
}

/** What was picked for one question: an option's index, or what was typed under "Other". */
type Answer = { choice: number; text: string } | null;

const FILE_LABEL: Record<string, string> = {
  pdf: "PDF",
  excel: "Excel file",
  csv: "CSV file",
  word: "Word document",
  markdown: "Markdown file",
};

const CARD_STYLE: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  boxShadow: "var(--shadow-sm)",
};

/**
 * Questions before a file is built — asked one at a time.
 *
 * Each question gets its own moment: pick an option and the next one comes
 * in, while the answered ones fold into a trail above that can be reopened.
 * The last step shows every answer together before anything is built,
 * because a file is minutes of work and a wrong answer should cost a click,
 * not a rebuild. The first option of each question is the recommended one;
 * "Other" takes free text. Number keys pick options.
 *
 * Only the newest card is live. An older one stays readable but inert:
 * answering a question the conversation has moved past would build a file
 * nobody asked for any more.
 */
export function ClarifyCard({
  data,
  interactive,
  onSubmit,
}: {
  data: ClarifyPayload;
  interactive: boolean;
  onSubmit?: (text: string) => void;
}) {
  const questions = data.questions ?? [];
  const total = questions.length;
  const [answers, setAnswers] = useState<Answer[]>(() => questions.map(() => null));
  const [step, setStep] = useState(0);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherDraft, setOtherDraft] = useState("");
  const [sent, setSent] = useState(false);

  const live = interactive && !sent && !!onSubmit;
  const reviewing = step >= total;
  const fileLabel = FILE_LABEL[(data.format ?? "").toLowerCase()] ?? "file";

  function valueOf(qi: number): string {
    const a = answers[qi];
    const q = questions[qi];
    if (!a || !q) return "";
    return a.choice < q.options.length ? q.options[a.choice]!.label : a.text;
  }

  function choose(qi: number, choice: number, text = "") {
    if (!live) return;
    const next = answers.map((a, i) => (i === qi ? { choice, text } : a));
    setAnswers(next);
    setOtherOpen(false);
    setOtherDraft("");
    const later = next.findIndex((a, i) => i > qi && !a);
    const anyOpen = next.findIndex((a) => !a);
    const target = later !== -1 ? later : anyOpen !== -1 ? anyOpen : total;
    // A beat to see the choice land before the next question comes in.
    window.setTimeout(() => setStep(target), 170);
  }

  function reopen(qi: number) {
    if (!live) return;
    const a = answers[qi];
    const q = questions[qi];
    const typed = !!a && !!q && a.choice >= q.options.length;
    setOtherOpen(typed);
    setOtherDraft(typed ? a!.text : "");
    setStep(qi);
  }

  function submit() {
    if (!live || answers.some((a) => !a)) return;
    const lines = questions.map((q, i) => `${i + 1}. ${q.question} → ${valueOf(i)}`);
    setSent(true);
    onSubmit?.(`Here are my choices:\n${lines.join("\n")}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!live || reviewing || otherOpen) return;
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const q = questions[step];
    const n = Number(e.key);
    if (!q || !Number.isInteger(n) || n < 1) return;
    if (n <= q.options.length) {
      e.preventDefault();
      choose(step, n - 1);
    } else if (n === q.options.length + 1) {
      e.preventDefault();
      setOtherOpen(true);
    }
  }

  // ── Answered just now, or a card the conversation has moved past ─────────
  if (!live) {
    return (
      <div className="w-full overflow-hidden rounded-2xl animate-fade-in-up" style={CARD_STYLE}>
        <Header
          intro={data.intro}
          sub={sent
            ? `Got it — building your ${fileLabel}.`
            : `Asked ${total} question${total === 1 ? "" : "s"} before building the ${fileLabel}.`}
          done={sent}
        />
        <ol className="flex flex-col gap-1.5 px-4 pb-4">
          {questions.map((q, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 rounded-xl px-3 py-2"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
            >
              <StepDot n={i + 1} done={sent} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
                  {q.question}
                </span>
                {sent && (
                  <span className="mt-0.5 block text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {valueOf(i)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const q = questions[step];

  return (
    <div
      className="w-full overflow-hidden rounded-2xl animate-fade-in-up focus:outline-none"
      style={CARD_STYLE}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <Header
        intro={data.intro}
        sub={reviewing ? "Check your answers, then build." : "Pick one — the next question follows."}
        badge={reviewing ? "Review" : `${step + 1} of ${total}`}
      />

      {/* Progress */}
      <div className="flex gap-1 px-4 pb-3" aria-hidden>
        {questions.map((_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-colors duration-300"
            style={{
              background: answers[i]
                ? "var(--accent-bright)"
                : i === step
                ? "var(--accent-border)"
                : "var(--border-subtle)",
            }}
          />
        ))}
      </div>

      {/* Trail — what has been answered so far, each reopenable */}
      {!reviewing && answers.some(Boolean) && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-1">
          {questions.map((qq, i) =>
            answers[i] && i !== step ? (
              <button
                key={i}
                onClick={() => reopen(i)}
                title={`Change: ${qq.question}`}
                className="flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:bg-[var(--surface-3)]"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                <Check className="size-3 shrink-0" style={{ color: "var(--accent-bright)" }} />
                <span className="truncate">{valueOf(i)}</span>
              </button>
            ) : null,
          )}
        </div>
      )}

      {/* The current step */}
      <div key={step} className="px-4 pb-4 pt-2 animate-fade-in-up">
        {reviewing ? (
          <>
            <p className="mb-3 text-[14.5px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
              Ready to build your {fileLabel}
            </p>
            <ol className="flex flex-col gap-1.5">
              {questions.map((qq, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl px-3.5 py-2.5"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
                >
                  <StepDot n={i + 1} done />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
                      {qq.question}
                    </span>
                    <span className="mt-0.5 block text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {valueOf(i)}
                    </span>
                  </span>
                  <button
                    onClick={() => reopen(i)}
                    className="ghost-btn shrink-0 px-2 py-1 text-[11.5px] font-medium"
                  >
                    Change
                  </button>
                </li>
              ))}
            </ol>
          </>
        ) : q ? (
          <>
            <p
              className="mb-3 text-[15px] font-semibold leading-snug"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
            >
              {q.question}
            </p>
            <div role="radiogroup" aria-label={q.question} className="flex flex-col gap-1.5">
              {q.options.map((opt, oi) => (
                <OptionRow
                  key={oi}
                  index={oi + 1}
                  selected={!otherOpen && answers[step]?.choice === oi}
                  recommended={oi === 0}
                  label={opt.label}
                  description={opt.description}
                  onClick={() => choose(step, oi)}
                />
              ))}
              <OptionRow
                index={q.options.length + 1}
                selected={otherOpen || answers[step]?.choice === q.options.length}
                label="Other"
                description="Type your own answer"
                icon={<PencilLine className="size-3.5" />}
                onClick={() => setOtherOpen(true)}
              />
              {otherOpen && (
                <div
                  className="mt-0.5 flex items-center gap-2 rounded-xl py-1.5 pl-3.5 pr-1.5 animate-fade-in"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--accent-border)" }}
                >
                  <input
                    autoFocus
                    value={otherDraft}
                    onChange={(e) => setOtherDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && otherDraft.trim()) {
                        e.preventDefault();
                        choose(step, q.options.length, otherDraft.trim());
                      } else if (e.key === "Escape") {
                        setOtherOpen(false);
                      }
                    }}
                    placeholder="Type your answer…"
                    className="min-w-0 flex-1 bg-transparent py-1 text-[13px] outline-none"
                    style={{ color: "var(--text-primary)" }}
                  />
                  <button
                    onClick={() => choose(step, q.options.length, otherDraft.trim())}
                    disabled={!otherDraft.trim()}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
                    style={{ background: "var(--accent-gradient)" }}
                  >
                    Next <CornerDownLeft className="size-3" />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5"
        style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-2)" }}
      >
        {step > 0 ? (
          <button
            onClick={() => reopen(Math.min(step, total) - 1)}
            className="ghost-btn flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium"
          >
            <ArrowLeft className="size-3.5" /> Back
          </button>
        ) : (
          <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
            Or type your answer in the box below.
          </span>
        )}
        {reviewing ? (
          <button
            onClick={submit}
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-transform duration-150 hover:-translate-y-px"
            style={{ background: "var(--accent-gradient)", boxShadow: "0 4px 16px rgba(99,102,241,0.34)" }}
          >
            <Wand2 className="size-3.5" /> Build my {fileLabel}
          </button>
        ) : (
          q && (
            <span className="hidden text-[11px] sm:inline" style={{ color: "var(--text-muted)" }}>
              Press 1–{q.options.length + 1} to choose
            </span>
          )
        )}
      </div>
    </div>
  );
}

function Header({ intro, sub, badge, done }: { intro?: string; sub: string; badge?: string; done?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-4 pb-3 pt-4">
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
      >
        {done ? (
          <Check className="size-4" style={{ color: "var(--accent-bright)" }} />
        ) : (
          <Sparkles className="size-4" style={{ color: "var(--accent-bright)" }} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
          {intro || "A few quick choices so the file comes out right"}
        </p>
        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>{sub}</p>
      </div>
      {badge && (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)", color: "var(--text-tertiary)" }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function StepDot({ n, done }: { n: number; done?: boolean }) {
  return (
    <span
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold tabular-nums"
      style={{
        background: done ? "var(--accent-subtle)" : "var(--surface-3)",
        color: done ? "var(--accent-bright)" : "var(--text-muted)",
      }}
    >
      {n}
    </span>
  );
}

function OptionRow({
  index, selected, recommended, label, description, icon, onClick,
}: {
  index: number;
  selected: boolean;
  recommended?: boolean;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className="group/opt flex w-full items-start gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all duration-150 hover:bg-[var(--surface-3)]"
      style={{
        background: selected ? "var(--accent-subtle)" : "var(--surface-2)",
        border: `1px solid ${selected ? "var(--accent-border)" : "var(--border-subtle)"}`,
      }}
    >
      <span
        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full transition-colors"
        style={{
          border: `1.5px solid ${selected ? "var(--accent-bright)" : "var(--border-strong)"}`,
          background: selected ? "var(--accent-bright)" : "transparent",
        }}
      >
        {selected && <Check className="size-2.5 text-white" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
            {icon}
            {label}
          </span>
          {recommended && (
            <span
              className="rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
              style={{ background: "var(--accent-subtle)", color: "var(--accent-bright)", border: "1px solid var(--accent-border)" }}
            >
              Recommended
            </span>
          )}
        </span>
        {description && (
          <span className="mt-0.5 block text-[12px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
            {description}
          </span>
        )}
      </span>
      <span
        className="mt-0.5 shrink-0 rounded-md px-1.5 py-px text-[10.5px] tabular-nums opacity-60 transition-opacity group-hover/opt:opacity-100"
        style={{ border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
        aria-hidden
      >
        {index}
      </span>
    </button>
  );
}
