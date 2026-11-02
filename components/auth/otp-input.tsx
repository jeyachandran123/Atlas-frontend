"use client";

import { useRef } from "react";

/**
 * One box per digit. Typing moves forward, Backspace moves back, and pasting
 * a whole code — or letting the phone fill it from the email — fills every
 * box at once.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function focus(i: number) {
    refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();
  }

  function fill(from: number, text: string) {
    const typed = text.replace(/\D/g, "");
    if (!typed) return;
    const next = digits.slice();
    let i = from;
    for (const ch of typed) {
      if (i >= length) break;
      next[i++] = ch;
    }
    onChange(next.join("").slice(0, length));
    focus(i);
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = digits.slice();
      if (next[i]) {
        next[i] = "";
      } else if (i > 0) {
        next[i - 1] = "";
        focus(i - 1);
      }
      onChange(next.join(""));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    }
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={length}
          onChange={(e) => fill(i, e.target.value.slice(-1) || e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            fill(0, e.clipboardData.getData("text"));
          }}
          onKeyDown={(e) => onKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className="auth-input h-12 w-full min-w-0 text-center text-[20px] font-semibold tabular-nums"
          style={invalid ? { borderColor: "var(--danger-border)" } : undefined}
        />
      ))}
    </div>
  );
}
