"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, ChevronDown, Loader2 } from "lucide-react";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { ToolCallIndicator } from "@/components/chat/tool-call-indicator";
import { ChatFileCard } from "@/components/chat/chat-file-card";
import type { ActiveToolCall } from "@/lib/stores/chat-store";
import type { ChatFilePayload } from "@/types/api";

function AtlasAvatar({ streaming }: { streaming?: boolean }) {
  return (
    <div
      className="relative flex size-7 shrink-0 items-center justify-center rounded-lg"
      style={{
        background: "var(--accent-gradient)",
        boxShadow: streaming
          ? "0 0 0 2px var(--accent-border), 0 2px 10px rgba(99,102,241,0.40)"
          : "0 2px 8px rgba(99,102,241,0.28), inset 0 1px 0 rgba(255,255,255,0.12)",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.95" />
        <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
      </svg>
      {streaming && (
        <span
          className="absolute -right-0.5 -top-0.5 size-2 rounded-full animate-signal-pulse"
          style={{ background: "var(--accent-bright)", boxShadow: "0 0 5px var(--accent)" }}
        />
      )}
    </div>
  );
}

/**
 * The model's thinking, live, kept visually apart from the answer.
 *
 * Open while the model is still thinking — that is the part worth watching —
 * and folded to a one-line "Thought for 12s" the moment the answer starts, so
 * the reasoning never pushes the reply off the screen. It can be reopened.
 */
function ReasoningPanel({ reasoning, answering }: { reasoning: string; answering: boolean }) {
  const [open, setOpen] = useState(true);
  const startedAt = useRef<number>(Date.now());
  const [seconds, setSeconds] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Fold once, when the answer begins. A later manual reopen is respected.
  useEffect(() => {
    if (answering && seconds === null) {
      setSeconds(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
      setOpen(false);
    }
  }, [answering, seconds]);

  // Follow the newest thought while it is streaming.
  useEffect(() => {
    if (open && !answering && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [reasoning, open, answering]);

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium"
        style={{ color: "var(--text-tertiary)" }}
        aria-expanded={open}
      >
        <Brain
          className={`size-3.5 ${answering ? "" : "animate-signal-pulse"}`}
          style={{ color: "var(--accent-bright)" }}
        />
        {answering && seconds !== null ? `Thought for ${seconds}s` : "Thinking…"}
        <ChevronDown
          className="ml-auto size-3.5 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && (
        <div
          ref={bodyRef}
          className="max-h-56 overflow-y-auto whitespace-pre-wrap px-3 pb-3 text-[12px] leading-relaxed"
          style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}
        >
          {reasoning}
        </div>
      )}
    </div>
  );
}

export function StreamingMessageBubble({
  content, activeToolCall, reasoning = "", fileStage = null, file = null, interrupted = null,
}: {
  content: string;
  activeToolCall: ActiveToolCall | null;
  /** The model's thinking for this message, when thinking is on. */
  reasoning?: string;
  /** Set while a file is being made. */
  fileStage?: string | null;
  /** The file this turn made — shown at once, with its overview streaming below. */
  file?: ChatFilePayload | null;
  /**
   * Set when the reply ended early (stopped, or failed part-way): what was
   * already written stays readable, marked as unfinished, instead of vanishing.
   */
  interrupted?: string | null;
}) {
  if (interrupted) {
    return (
      <div className="flex gap-3 animate-fade-in">
        <AtlasAvatar />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <MessageMarkdown content={content} />
          <p className="text-[12.5px] italic" style={{ color: "var(--text-tertiary)" }}>
            {interrupted}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-in-up">
      <AtlasAvatar streaming />

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <ToolCallIndicator call={activeToolCall} />

        {reasoning && <ReasoningPanel reasoning={reasoning} answering={!!content} />}

        {fileStage && !content && !file && <FileStageRow stage={fileStage} />}

        {file && <ChatFileCard data={file} />}

        {file && !content && file.status === "ready" && <FileStageRow stage="summarising" />}

        {content ? (
          <div className="assistant-content">
            <MessageMarkdown content={content} />
            <span
              className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-0.5 rounded-full animate-cursor"
              style={{ background: "var(--accent)" }}
            />
          </div>
        ) : !activeToolCall && !reasoning && !fileStage && !file ? (
          <div className="flex items-center gap-2.5 py-1" role="status" aria-label="UnityWorks is thinking">
            <div className="flex items-center gap-1.5">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1.5 rounded-full animate-typing-dot"
                  style={{ background: "var(--accent)", animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <span
              className="text-[12px] font-medium animate-fade-in"
              style={{ color: "var(--text-tertiary)", letterSpacing: "-0.01em" }}
            >
              Thinking…
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const FILE_STAGE_LABELS: Record<string, string> = {
  planning: "Planning the content",
  verifying: "Checking every row against your request",
  shaping_content: "Shaping the content",
  building_file: "Building the file",
  storing: "Saving your file",
  inspecting_document: "Reading your spreadsheet",
  writing_code: "Writing the code",
  fixing_code: "Fixing the code",
  running_code: "Running it",
  validating: "Checking the result",
  done: "Finishing up",
  summarising: "Reading the file back to summarise it",
};

/** One line saying what the file being made is doing — the wait means something. */
function FileStageRow({ stage }: { stage: string }) {
  const label = FILE_STAGE_LABELS[stage] ?? "Working on your file";
  return (
    <div
      role="status"
      className="flex w-fit items-center gap-2.5 rounded-xl px-3.5 py-2.5 animate-fade-in"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}
    >
      <Loader2 className="size-3.5 animate-spin" style={{ color: "var(--accent-bright)" }} />
      <span className="text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}…
      </span>
    </div>
  );
}
