"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { VoiceError } from "@/lib/hooks/use-voice-input";

const RECORDING = "#ef4444";

/** What to tell the user when dictation cannot start or stops by itself. */
export const VOICE_MESSAGES: Record<VoiceError, string> = {
  "not-allowed": "Microphone access is blocked. Allow it from the icon in the address bar, then try again.",
  "audio-capture": "No microphone was found. Check that one is connected and try again.",
  network: "Voice input couldn't reach the browser's speech service. Brave blocks it — please use Chrome, Edge or Safari.",
  unsupported: "Voice input isn't available in this browser. Please use Chrome, Edge or Safari.",
  "no-speech": "Didn't catch anything — try again a little closer to the microphone.",
  other: "Voice input stopped unexpectedly. Please try again.",
};

/** The microphone in the prompt box: dictate, and stop. */
export function VoiceButton({
  supported, listening, disabled, onToggle,
}: {
  supported: boolean;
  listening: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const label = listening
    ? "Stop dictation  ( Esc )"
    : supported
    ? "Dictate — speak instead of typing"
    : "Voice input isn't available in this browser";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={listening ? "Stop dictation" : "Start dictation"}
      aria-pressed={listening}
      title={label}
      className={cn(
        "relative flex size-8 items-center justify-center rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        !listening && "icon-btn",
      )}
      style={listening ? { background: RECORDING, color: "#fff", boxShadow: "0 0 0 3px rgba(239,68,68,0.18)" } : undefined}
    >
      {listening && (
        <span className="absolute inset-0 animate-ping rounded-xl" style={{ background: "rgba(239,68,68,0.35)" }} aria-hidden />
      )}
      {listening
        ? <Square className="relative size-3 fill-current" />
        : <Mic className="size-[17px]" style={{ opacity: supported ? 1 : 0.6 }} />}
    </button>
  );
}

/** The strip above the text while dictating: live dot, voice level, time, how to stop. */
export function ListeningStrip({ levelRef, startedAt }: { levelRef: RefObject<number>; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div
      className="flex items-center gap-3 px-5 pt-3 text-[12px] animate-fade-in"
      style={{ color: "var(--text-secondary)" }}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: RECORDING }} />
        <span className="relative inline-flex size-2 rounded-full" style={{ background: RECORDING }} />
      </span>
      <span className="font-medium">Listening…</span>
      <LevelBars levelRef={levelRef} />
      <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>{clock}</span>
      <span className="ml-auto flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
        <kbd className="kbd">Esc</kbd> to stop
      </span>
    </div>
  );
}

const BAR_WEIGHTS = [0.55, 0.85, 1, 0.8, 0.6, 0.9, 0.7];

/**
 * Bars that follow the voice. Drawn straight onto the elements from an
 * animation frame — the level changes sixty times a second, far too often to
 * go through React state.
 */
function LevelBars({ levelRef }: { levelRef: RefObject<number> }) {
  const bars = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      // A little breathing even in silence, so the strip never looks frozen.
      const level = Math.max(levelRef.current ?? 0, 0.08);
      const t = performance.now() / 1000;
      bars.current.forEach((el, i) => {
        if (!el) return;
        const wobble = 0.6 + 0.4 * Math.sin(t * 9 + i * 1.3);
        el.style.height = `${3 + Math.min(1, level) * 13 * BAR_WEIGHTS[i]! * wobble}px`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <span className="flex h-4 items-center gap-[3px]" aria-hidden>
      {BAR_WEIGHTS.map((_, i) => (
        <span
          key={i}
          ref={(el) => { bars.current[i] = el; }}
          className="w-[3px] rounded-full"
          style={{ height: 3, background: "var(--accent-bright)", transition: "height 80ms linear" }}
        />
      ))}
    </span>
  );
}
