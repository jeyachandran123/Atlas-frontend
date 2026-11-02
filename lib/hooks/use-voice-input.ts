"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* The Web Speech API is not in TypeScript's DOM library; this is the part used here. */
interface SpeechAlternative { transcript: string }
interface SpeechResult { readonly isFinal: boolean; readonly length: number; [index: number]: SpeechAlternative }
interface SpeechResultList { readonly length: number; [index: number]: SpeechResult }
interface SpeechResultEvent extends Event { readonly results: SpeechResultList }
interface SpeechErrorEvent extends Event { readonly error: string }
interface Recognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceError = "not-allowed" | "audio-capture" | "network" | "unsupported" | "no-speech" | "other";

/** This long without a word and dictation stops by itself. */
const SILENCE_STOP_MS = 12_000;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Dictation into the prompt box, through the browser's own speech recognition
 * (Chrome, Edge, Safari). Words arrive as they are spoken: `onTranscript`
 * gets everything heard this session, settled and still-changing together.
 *
 * Browsers end a recognition run on their own — after a pause, or a minute —
 * so a session is a chain of runs, restarted until the user stops or has been
 * silent for SILENCE_STOP_MS. The voice level for the meter is kept in a ref:
 * it changes sixty times a second and must not re-render the prompt box.
 */
export function useVoiceInput({ onTranscript, onError, lang }: {
  onTranscript: (text: string) => void;
  onError?: (error: VoiceError) => void;
  lang?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  /** 0..1 — how loud the microphone is right now. */
  const levelRef = useRef(0);

  const recRef = useRef<Recognition | null>(null);
  const wantedRef = useRef(false);
  const settledRef = useRef("");
  const lastHeardRef = useRef(0);
  const meterRef = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number } | null>(null);
  const handlers = useRef({ onTranscript, onError, lang });

  useEffect(() => {
    handlers.current = { onTranscript, onError, lang };
  });

  // Decided on the client only, so the server render and the first client render agree.
  useEffect(() => {
    setSupported(recognitionCtor() !== null);
  }, []);

  const stopMeter = useCallback(() => {
    const meter = meterRef.current;
    meterRef.current = null;
    levelRef.current = 0;
    if (!meter) return;
    cancelAnimationFrame(meter.raf);
    meter.stream.getTracks().forEach((t) => t.stop());
    void meter.ctx.close();
  }, []);

  // The level meter is decoration: if the microphone cannot be opened for it,
  // recognition carries on without it.
  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!wantedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) {
          const x = (v - 128) / 128;
          sum += x * x;
        }
        levelRef.current = Math.min(1, Math.sqrt(sum / samples.length) * 5);
        if (meterRef.current) meterRef.current.raf = requestAnimationFrame(tick);
      };
      meterRef.current = { stream, ctx, raf: requestAnimationFrame(tick) };
    } catch {
      /* no meter — nothing else depends on it */
    }
  }, []);

  const finish = useCallback((heardNothing: boolean) => {
    wantedRef.current = false;
    recRef.current = null;
    setListening(false);
    setStartedAt(null);
    stopMeter();
    if (heardNothing) handlers.current.onError?.("no-speech");
  }, [stopMeter]);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      handlers.current.onError?.("unsupported");
      return;
    }
    if (wantedRef.current) return;
    wantedRef.current = true;
    settledRef.current = "";
    lastHeardRef.current = Date.now();
    setListening(true);
    setStartedAt(Date.now());
    void startMeter();

    const run = () => {
      const rec = new Ctor();
      rec.lang = handlers.current.lang || navigator.language || "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      let settledThisRun = "";

      rec.onresult = (e) => {
        let settled = "";
        let changing = "";
        for (let i = 0; i < e.results.length; i++) {
          const result = e.results[i]!;
          const words = result[0]?.transcript ?? "";
          if (result.isFinal) settled += ` ${words}`;
          else changing += ` ${words}`;
        }
        settledThisRun = tidy(settled);
        lastHeardRef.current = Date.now();
        handlers.current.onTranscript(tidy(`${settledRef.current} ${settled} ${changing}`));
      };

      rec.onerror = (e) => {
        // Silence and our own stop are not failures: the run ends and onend decides.
        if (e.error === "no-speech" || e.error === "aborted") return;
        wantedRef.current = false;
        handlers.current.onError?.(
          e.error === "not-allowed" || e.error === "service-not-allowed" ? "not-allowed"
            : e.error === "audio-capture" ? "audio-capture"
            : e.error === "network" ? "network"
            : "other",
        );
      };

      rec.onend = () => {
        settledRef.current = tidy(`${settledRef.current} ${settledThisRun}`);
        const silentTooLong = Date.now() - lastHeardRef.current > SILENCE_STOP_MS;
        if (wantedRef.current && !silentTooLong) {
          try {
            run(); // the browser paused on its own: carry on listening
            return;
          } catch {
            /* could not restart — end the session below */
          }
        }
        finish(wantedRef.current && silentTooLong && !settledRef.current);
      };

      recRef.current = rec;
      rec.start();
    };

    try {
      run();
    } catch {
      finish(false);
      handlers.current.onError?.("other");
    }
  }, [finish, startMeter]);

  /** Stop listening. Words still being settled arrive before it ends. */
  const stop = useCallback(() => {
    wantedRef.current = false;
    if (recRef.current) recRef.current.stop();
    else finish(false);
  }, [finish]);

  useEffect(() => () => {
    wantedRef.current = false;
    recRef.current?.abort();
    stopMeter();
  }, [stopMeter]);

  return { supported, listening, startedAt, levelRef, start, stop };
}
