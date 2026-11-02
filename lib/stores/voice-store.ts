import { create } from "zustand";

export type VoicePhase =
  | "closed"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "reconnecting"
  | "ended"
  | "failed";

export type VoiceProblem =
  | "microphone-blocked"
  | "microphone-missing"
  | "microphone-lost"
  | "not-configured"
  | "busy"
  | "connect-failed"
  | "connection-lost";

/** Why a session finished on its own, to tell the person afterwards. */
export type VoiceEndNote = "idle" | "time-limit" | null;

interface VoiceState {
  phase: VoicePhase;
  muted: boolean;
  captionsOn: boolean;
  caption: string;
  captionFrom: "you" | "atlas";
  problem: VoiceProblem | null;
  endNote: VoiceEndNote;
  /** Centre of the button that opened the screen: the reveal grows from here. */
  origin: { x: number; y: number };
  /** The chat the session's turns were saved to, when any were. */
  savedConversationId: string | null;
  /** Goes up with each confirmed save, including ones that land after the screen closes. */
  saveCount: number;

  patch: (next: Partial<Omit<VoiceState, "patch" | "toggleCaptions" | "reset">>) => void;
  toggleCaptions: () => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  phase: "closed",
  muted: false,
  captionsOn: true,
  caption: "",
  captionFrom: "atlas",
  problem: null,
  endNote: null,
  origin: { x: 0, y: 0 },
  savedConversationId: null,
  saveCount: 0,

  patch: (next) => set(next),
  toggleCaptions: () => set((s) => ({ captionsOn: !s.captionsOn })),
  reset: () =>
    set({ phase: "closed", muted: false, caption: "", problem: null, endNote: null }),
}));
