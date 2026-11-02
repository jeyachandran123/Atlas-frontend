"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PromptEntry {
  id: string;
  text: string;
  /** ISO timestamp of when the prompt was sent. */
  time?: string;
}

/** Today's prompts show a time; older ones show a date. */
function formatWhen(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

const LIST_FADE =
  "linear-gradient(to bottom, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%)";

/**
 * A map of the conversation along the right edge of the message area.
 *
 * At rest: a slim track with one tick per prompt, the one being read lit.
 * On hover: a panel listing every prompt with its number and time; click to
 * jump. The component spans the message area's height and nothing more, so
 * however long the list grows the panel stays between the header and the
 * composer instead of running under them.
 */
export function PromptNavigator({
  prompts,
  activeId,
  onJump,
}: {
  prompts: PromptEntry[];
  activeId: string | null;
  onJump: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // A short grace period on leave, so crossing from the rail to the panel
  // does not close it on the way.
  const show = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }, []);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Opening the panel centres the prompt being read in the list.
  useEffect(() => {
    if (!open || !activeId || !listRef.current) return;
    listRef.current
      .querySelector<HTMLElement>(`[data-prompt-id="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: "center" });
  }, [open, activeId]);

  if (prompts.length < 2) return null;

  const dense = prompts.length > 20;
  const activeIndex = prompts.findIndex((p) => p.id === activeId);

  return (
    <div className="pointer-events-none absolute inset-y-4 right-4 z-20 hidden w-[22px] lg:block">
      <div className="relative flex h-full items-center justify-center">
        {/* ── Rail ───────────────────────────────────────────────────── */}
        <nav
          aria-label="Prompts in this conversation"
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
          className="pointer-events-auto flex max-h-full w-[22px] flex-col items-center overflow-hidden rounded-full py-2.5 transition-[background-color,box-shadow,opacity] duration-200"
          style={{
            gap: dense ? 3 : 6,
            background: open ? "var(--surface-2)" : "var(--surface-1)",
            border: "1px solid var(--border-subtle)",
            boxShadow: open ? "var(--shadow-md)" : "none",
            opacity: open ? 1 : 0.85,
          }}
        >
          {prompts.map((p, i) => {
            const active = p.id === activeId;
            return (
              <button
                key={p.id}
                onClick={() => onJump(p.id)}
                aria-label={`Prompt ${i + 1}: ${p.text.slice(0, 60)}`}
                aria-current={active ? "true" : undefined}
                className="group/tick flex h-2 w-full shrink-0 items-center justify-center outline-none"
              >
                <span
                  className={`block h-[2px] rounded-full transition-all duration-300 ease-out ${
                    active
                      ? "w-3 bg-[var(--accent-bright)] shadow-[0_0_6px_var(--accent)]"
                      : "w-2 bg-[var(--border-strong)] group-hover/tick:w-3 group-hover/tick:bg-[var(--text-tertiary)] group-focus-visible/tick:w-3 group-focus-visible/tick:bg-[var(--text-tertiary)]"
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* ── Panel ──────────────────────────────────────────────────── */}
        <div
          role="dialog"
          aria-label="Jump to a prompt"
          aria-hidden={!open}
          onMouseEnter={show}
          onMouseLeave={hide}
          className="absolute right-full top-1/2 mr-3 flex max-h-full w-[304px] flex-col overflow-hidden rounded-2xl transition-[opacity,transform] duration-200 ease-out"
          style={{
            opacity: open ? 1 : 0,
            transform: `translateY(-50%) translateX(${open ? 0 : 6}px) scale(${open ? 1 : 0.98})`,
            transformOrigin: "right center",
            pointerEvents: open ? "auto" : "none",
            background: "var(--surface-overlay, var(--surface-2))",
            backdropFilter: "blur(24px) saturate(1.2)",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          <div className="flex shrink-0 items-center justify-between px-4 pb-2.5 pt-3.5">
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
              Prompts
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10.5px] font-medium tabular-nums"
              style={{ background: "var(--surface-3)", color: "var(--text-tertiary)" }}
            >
              {activeIndex >= 0 ? `${activeIndex + 1} / ${prompts.length}` : prompts.length}
            </span>
          </div>
          <div className="mx-4 h-px shrink-0" style={{ background: "var(--border-subtle)" }} />

          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto px-2 py-2 [scrollbar-width:thin]"
            style={{ maskImage: LIST_FADE, WebkitMaskImage: LIST_FADE }}
          >
            {prompts.map((p, i) => {
              const active = p.id === activeId;
              const when = formatWhen(p.time);
              return (
                <button
                  key={p.id}
                  data-prompt-id={p.id}
                  tabIndex={open ? 0 : -1}
                  onClick={() => { onJump(p.id); setOpen(false); }}
                  className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 hover:bg-[var(--surface-3)]"
                  style={active ? { background: "var(--accent-subtle)" } : undefined}
                >
                  <span
                    className="mt-px flex size-[22px] shrink-0 items-center justify-center rounded-lg text-[10.5px] font-semibold tabular-nums transition-colors duration-150"
                    style={
                      active
                        ? { background: "var(--accent-bright)", color: "#fff" }
                        : { background: "var(--surface-3)", color: "var(--text-tertiary)" }
                    }
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="line-clamp-2 text-[12.5px] leading-[1.45]"
                      style={{ color: active ? "var(--text-primary)" : "var(--text-secondary)" }}
                    >
                      {p.text}
                    </span>
                    {when && (
                      <span className="mt-1 block text-[10.5px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                        {when}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
