"use client";

import { ArrowDown } from "lucide-react";

/**
 * "Take me back to the latest message" — shown only once the reader has left it.
 *
 * Sits just above the composer, where the eye already is. When new content
 * arrives while the reader is scrolled up (a reply streaming in), a pulsing dot
 * says so without pulling them away from what they were reading.
 */
export function ScrollToBottomButton({
  visible,
  hasNew,
  onClick,
}: {
  visible: boolean;
  hasNew: boolean;
  onClick: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-14 z-10 flex justify-center">
      <button
        onClick={onClick}
        aria-label="Scroll to the latest message"
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        className="relative flex size-9 items-center justify-center rounded-full transition-all duration-300 ease-out hover:brightness-125"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.85)",
          pointerEvents: visible ? "auto" : "none",
          background: "var(--surface-2)",
          border: "1px solid var(--border-strong)",
          boxShadow: hasNew
            ? "0 0 0 3px var(--accent-subtle), var(--shadow-lg)"
            : "var(--shadow-lg)",
          color: "var(--text-primary)",
          backdropFilter: "blur(12px)",
        }}
      >
        <ArrowDown className={`size-4 ${hasNew ? "animate-bounce" : ""}`} />
        {hasNew && (
          <span
            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full animate-signal-pulse"
            style={{ background: "var(--accent-bright)", boxShadow: "0 0 6px var(--accent)" }}
          />
        )}
      </button>
    </div>
  );
}
