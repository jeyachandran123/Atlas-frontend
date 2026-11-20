"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Captions, CaptionsOff, Mic, MicOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Orb, type OrbState } from "@/components/chat/voice-agent/orb";
import { chatKeys } from "@/lib/hooks/use-chat";
import { useChatStore } from "@/lib/stores/chat-store";
import { useVoiceStore, type VoicePhase, type VoiceProblem } from "@/lib/stores/voice-store";
import { endVoiceSession, startVoiceSession, toggleMute, voiceLevels } from "@/lib/voice/session";
import { useVoiceConfig } from "@/components/chat/voice-agent/voice-button";

const STATUS: Record<VoicePhase, string> = {
  closed: "",
  connecting: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  searching: "Searching the web",
  speaking: "Speaking",
  reconnecting: "Reconnecting",
  ended: "",
  failed: "",
};

const PROBLEMS: Record<VoiceProblem, { title: string; detail: string; retry: boolean }> = {
  "microphone-blocked": {
    title: "Atlas can't hear you",
    detail: "Your browser is blocking the microphone. Allow it in this site's settings, then try again.",
    retry: true,
  },
  "microphone-missing": {
    title: "No microphone found",
    detail: "Connect a microphone, then try again.",
    retry: true,
  },
  "microphone-lost": {
    title: "The microphone disconnected",
    detail: "What you said so far is saved in the chat. Reconnect it to carry on.",
    retry: true,
  },
  "insecure-page": {
    title: "Voice needs a secure connection",
    detail: "Browsers only allow the microphone on https. This page is on http, so open it over https to talk to Atlas.",
    retry: false,
  },
  "not-configured": {
    title: "Voice isn't set up here",
    detail: "This deployment has no voice service configured. Typing still works as usual.",
    retry: false,
  },
  busy: {
    title: "Voice is busy right now",
    detail: "The voice service has hit its limit for the moment. Give it a minute, then try again.",
    retry: true,
  },
  "connect-failed": {
    title: "Couldn't connect",
    detail: "Check your connection, then try again. Your chat hasn't changed.",
    retry: true,
  },
  "connection-lost": {
    title: "The connection dropped",
    detail: "What you said so far is saved in the chat.",
    retry: true,
  },
};

/** About three lines at the caption's width. */
const CAPTION_FILLS_BOX = 165;

function orbState(phase: VoicePhase, muted: boolean): OrbState {
  if (phase === "ended" || phase === "closed") return "ended";
  if (phase === "failed") return "muted";
  if (phase === "connecting" || phase === "reconnecting") return phase;
  if (phase === "thinking" || phase === "speaking") return phase;
  if (phase === "searching") return "thinking";
  return muted ? "muted" : "listening";
}

function ControlButton({
  label, active, onClick, children, buttonRef,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className="voice-control"
      data-active={active || undefined}
    >
      {children}
    </button>
  );
}

function Screen() {
  const phase = useVoiceStore((s) => s.phase);
  const muted = useVoiceStore((s) => s.muted);
  const captionsOn = useVoiceStore((s) => s.captionsOn);
  const captionText = useVoiceStore((s) => s.caption);
  const captionFrom = useVoiceStore((s) => s.captionFrom);
  const problem = useVoiceStore((s) => s.problem);
  const origin = useVoiceStore((s) => s.origin);
  const { data: config } = useVoiceConfig();
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstControlRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    firstControlRef.current?.focus();
    const opener = openerRef;
    return () => { if (opener.current instanceof HTMLElement) opener.current.focus(); };
  }, []);

  const failed = phase === "failed";
  const close = () => endVoiceSession();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); endVoiceSession(); return; }
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!focusable?.length) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "m" || event.key === "M") toggleMute();
      if (event.key === "c" || event.key === "C") useVoiceStore.getState().toggleCaptions();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const radius = typeof window === "undefined"
    ? 2400
    : Math.hypot(
        Math.max(origin.x, window.innerWidth - origin.x),
        Math.max(origin.y, window.innerHeight - origin.y),
      ) + 8;
  const at = `at ${origin.x}px ${origin.y}px`;
  const status = muted && phase === "listening" ? "Muted" : STATUS[phase];
  const issue = problem ? PROBLEMS[problem] : null;

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Voice conversation with Atlas"
      className="voice-screen"
      initial={reduceMotion ? { opacity: 0 } : { clipPath: `circle(16px ${at})` }}
      animate={reduceMotion ? { opacity: 1 } : { clipPath: `circle(${radius}px ${at})` }}
      exit={reduceMotion ? { opacity: 0 } : { clipPath: `circle(16px ${at})` }}
      transition={{ duration: reduceMotion ? 0.15 : 0.62, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="voice-stage">
        <div className="voice-glow" aria-hidden="true" />
        <Orb state={orbState(phase, muted)} levels={voiceLevels} className="voice-orb" />
      </div>

      <div className="voice-words">
        <div className="voice-status" role="status" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={status}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {status}
            </motion.span>
          </AnimatePresence>
        </div>
        {issue ? (
          <div className="voice-problem">
            <p className="voice-problem-title">{issue.title}</p>
            <p>{issue.detail}</p>
          </div>
        ) : (
          <div className="voice-caption" data-from={captionFrom} data-long={captionText.length > CAPTION_FILLS_BOX || undefined} aria-hidden={!captionsOn}>
            {captionsOn && <p>{captionText}</p>}
          </div>
        )}
      </div>

      <div className={failed ? "voice-dock voice-dock-plain" : "voice-dock"}>
        {failed ? (
          <>
            {issue?.retry && config && (
              <button
                ref={firstControlRef}
                type="button"
                className="voice-action"
                onClick={() => void startVoiceSession(useChatStore.getState().activeConversationId, config)}
              >
                Try again
              </button>
            )}
            <button
              ref={issue?.retry ? undefined : firstControlRef}
              type="button"
              className="voice-action voice-action-quiet"
              onClick={close}
            >
              Back to chat
            </button>
          </>
        ) : (
          <>
            <ControlButton
              buttonRef={firstControlRef}
              label={muted ? "Unmute microphone" : "Mute microphone"}
              active={muted}
              onClick={toggleMute}
            >
              {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </ControlButton>
            <ControlButton
              label={captionsOn ? "Hide captions" : "Show captions"}
              onClick={() => useVoiceStore.getState().toggleCaptions()}
            >
              {captionsOn ? <Captions className="size-5" /> : <CaptionsOff className="size-5" />}
            </ControlButton>
            <span className="voice-dock-rule" aria-hidden="true" />
            <button type="button" className="voice-end" aria-label="End conversation" title="End conversation" onClick={close}>
              <X className="size-[18px]" />
              End
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

/** Mounted once beside the chat. Shows the screen while a session is open. */
export function VoiceOverlay() {
  const phase = useVoiceStore((s) => s.phase);
  const saveCount = useVoiceStore((s) => s.saveCount);
  const savedConversationId = useVoiceStore((s) => s.savedConversationId);
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const open = phase !== "closed" && phase !== "ended";

  // Each save updates the chat behind the screen, even one landing after it closes.
  useEffect(() => {
    if (saveCount === 0 || !savedConversationId) return;
    const chat = useChatStore.getState();
    if (chat.activeConversationId !== savedConversationId) chat.setActiveConversation(savedConversationId);
    void queryClient.invalidateQueries({ queryKey: chatKeys.messages(savedConversationId) });
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }, [saveCount, savedConversationId, queryClient]);

  useEffect(() => {
    if (phase !== "ended") return;
    const { endNote, reset } = useVoiceStore.getState();
    if (endNote === "idle") toast("Voice ended after 5 minutes of silence.");
    if (endNote === "time-limit") toast("Voice ended at the 30 minute limit.");
    reset();
  }, [phase]);

  // Leaving the chat page must not leave a live microphone behind.
  useEffect(() => {
    setMounted(true);
    return () => endVoiceSession();
  }, []);

  if (!mounted) return null;
  return createPortal(<AnimatePresence>{open && <Screen key="voice" />}</AnimatePresence>, document.body);
}
