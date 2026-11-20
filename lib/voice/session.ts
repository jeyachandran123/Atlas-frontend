/**
 * One voice conversation, from the tap to the saved transcript. A module rather
 * than a hook because audio callbacks fire far faster than React should re-render;
 * the screen only reads the small state it shows from `useVoiceStore`.
 */

import { toast } from "sonner";
import { voiceApi } from "@/lib/api/voice";
import { useVoiceStore, type VoiceProblem } from "@/lib/stores/voice-store";
import { LiveClient, type ToolCall } from "@/lib/voice/live-client";
import { MicrophoneBlockedError, MicrophoneMissingError, pcmLevel, VoiceAudio } from "@/lib/voice/audio";
import { ApiError, type VoiceConfig, type VoiceTurn } from "@/types/api";

const TICK_MS = 100;
/** A pause this long after someone's words, with a quiet microphone, means Atlas is up. */
const THINKING_AFTER_MS = 650;
const QUIET_MIC_LEVEL = 0.06;
/** Show "Reconnecting" only if a reconnect takes long enough for anyone to notice. */
const RECONNECT_NOTICE_MS = 800;
const RECONNECT_ATTEMPTS = 3;
const SAVE_ATTEMPTS = 4;
const CAPTION_CHARS = 260;
/** Words said before the connection is up are held, not lost: 5 s of 40 ms chunks. */
const HELD_AUDIO_CHUNKS = 125;
/**
 * While Atlas speaks, quieter microphone audio than this is sent as silence, so a
 * laptop's own speakers can't interrupt it: echo cancellation leaves a residue, and
 * in the owner's first real session replies kept cutting off after a word or two.
 * A person talking over Atlas close to the mic is well above this. Not yet tuned on
 * real speakers: speech RMS typically runs about 0.02–0.2. Raise it if Atlas still
 * cuts itself off; lower it if talking over Atlas stops working.
 */
const BARGE_IN_LEVEL = 0.04;

interface Active {
  audio: VoiceAudio;
  live: LiveClient;
  startConversationId: string | null;
  conversationId: string;
  config: VoiceConfig;
  startedAt: number;
  lastActivity: number;
  lastInputAt: number;
  resumeHandle: string | null;
  wantsResume: boolean;
  minting: boolean;
  reconnectAttempts: number;
  reconnectNotice: ReturnType<typeof setTimeout> | null;
  /** Microphone audio waiting for the connection. */
  heldAudio: ArrayBuffer[];
  /** The turn in progress. */
  userText: string;
  atlasText: string;
  turnComplete: boolean;
  /** Tool calls the model is waiting on, by id. */
  pendingTools: Set<string>;
  /** Finished turns not yet confirmed saved. */
  unsaved: VoiceTurn[];
  saving: boolean;
  tick: ReturnType<typeof setInterval>;
}

let active: Active | null = null;

const store = () => useVoiceStore.getState();

export function voiceLevels(): { mic: number; output: number } {
  if (!active) return { mic: 0, output: 0 };
  return { mic: store().muted ? 0 : active.audio.micLevel(), output: active.audio.outputLevel() };
}

function caption(text: string): string {
  // The caption box fades its top edge, so older words leave without an ellipsis.
  return text.length > CAPTION_CHARS ? text.slice(-CAPTION_CHARS).replace(/^\S*\s/, "") : text;
}

/** What was heard before an interruption, ending on a whole word. */
function heardPart(text: string, share: number): string {
  if (share >= 0.98) return text;
  const cut = Math.floor(text.length * share);
  const space = text.lastIndexOf(" ", cut);
  return text.slice(0, space > 0 ? space : cut).trim();
}

/* ── Saving ─────────────────────────────────────────────────────────── */

function commitTurn(session: Active, atlasText: string): void {
  const turns: VoiceTurn[] = [];
  if (session.userText.trim()) turns.push({ id: crypto.randomUUID(), role: "user", text: session.userText.trim() });
  if (atlasText.trim()) turns.push({ id: crypto.randomUUID(), role: "assistant", text: atlasText.trim() });
  session.userText = "";
  session.atlasText = "";
  session.turnComplete = false;
  session.audio.resetTurn();
  if (turns.length === 0) return;
  session.unsaved.push(...turns);
  void drainSaves(session);
}

/** The session is stopping mid-turn: keep what was said and what was actually heard. */
function commitInProgress(session: Active): void {
  const heard = session.audio.isPlaying ? session.audio.heardShare : 1;
  commitTurn(session, heardPart(session.atlasText, heard));
}

async function drainSaves(session: Active): Promise<void> {
  if (session.saving) return;
  session.saving = true;
  let failures = 0;
  while (session.unsaved.length > 0) {
    const batch = session.unsaved.slice();
    try {
      await voiceApi.saveTurns(session.conversationId, batch);
      session.unsaved.splice(0, batch.length);
      store().patch({ savedConversationId: session.conversationId, saveCount: store().saveCount + 1 });
      failures = 0;
    } catch {
      if (++failures >= SAVE_ATTEMPTS) {
        toast.error("Some of that conversation couldn't be saved to the chat.");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** failures));
    }
  }
  session.saving = false;
}

/* ── The session ────────────────────────────────────────────────────── */

function handlers(session: Active) {
  return {
    onReady: () => {
      session.reconnectAttempts = 0;
      session.wantsResume = false;
      if (session.reconnectNotice) clearTimeout(session.reconnectNotice);
      session.reconnectNotice = null;
      const { phase } = store();
      if (phase === "connecting" || phase === "reconnecting") store().patch({ phase: "listening" });
      for (const pcm of session.heldAudio) session.live.sendAudio(pcm);
      session.heldAudio = [];
    },
    onAudio: (pcm: ArrayBuffer) => {
      session.lastActivity = Date.now();
      session.audio.play(pcm);
      if (store().phase !== "speaking") store().patch({ phase: "speaking" });
    },
    onInputText: (text: string) => {
      // A person talking over the end of Atlas's turn starts the next turn's words.
      if (session.turnComplete) commitTurn(session, session.atlasText);
      session.userText += text;
      session.lastInputAt = session.lastActivity = Date.now();
      store().patch({
        caption: caption(session.userText.trim()),
        captionFrom: "you",
        ...(store().phase === "thinking" ? { phase: "listening" as const } : {}),
      });
    },
    onOutputText: (text: string) => {
      session.atlasText += text;
      store().patch({ caption: caption(session.atlasText.trim()), captionFrom: "atlas" });
    },
    onInterrupted: () => {
      // Save only what was heard, so the record matches the conversation.
      const heard = heardPart(session.atlasText, session.audio.heardShare);
      session.audio.flush();
      commitTurn(session, heard);
      store().patch({ phase: "listening", caption: "" });
    },
    onTurnComplete: () => {
      // Asking for a tool ends a turn, but the answer arrives in the next one:
      // the person's question and the reply are still one exchange.
      if (session.pendingTools.size > 0) return;
      session.turnComplete = true;
    },
    onToolCall: (calls: ToolCall[]) => {
      session.lastActivity = Date.now();
      for (const call of calls) {
        session.pendingTools.add(call.id);
        void runTool(session, call);
      }
      store().patch({ phase: "searching" });
    },
    onToolCancelled: (ids: string[]) => {
      for (const id of ids) session.pendingTools.delete(id);
      if (session.pendingTools.size === 0 && store().phase === "searching") store().patch({ phase: "listening" });
    },
    onResumeHandle: (handle: string) => {
      session.resumeHandle = handle;
    },
    onGoAway: () => {
      session.wantsResume = true;
    },
    onClosed: () => {
      void reconnect(session);
    },
  };
}

const NO_SEARCH = { found: false, note: "The search couldn't run. Tell them you couldn't check this right now." };

async function runTool(session: Active, call: ToolCall): Promise<void> {
  const query = typeof call.args.query === "string" ? call.args.query.trim() : "";
  let result: Record<string, unknown> = NO_SEARCH;
  if (call.name === "web_search" && query) {
    try {
      result = { ...(await voiceApi.search(query)) };
    } catch {
      result = NO_SEARCH;
    }
  }
  // Cancelled, reconnected or ended while searching: nobody is waiting for this.
  if (active !== session || !session.pendingTools.delete(call.id)) return;
  session.lastActivity = Date.now();
  session.live.sendToolResponse(call, result);
  if (session.pendingTools.size === 0 && store().phase === "searching") store().patch({ phase: "thinking" });
}

async function connect(session: Active, resumeHandle?: string): Promise<void> {
  const live = await voiceApi.session(session.startConversationId, resumeHandle);
  if (active !== session) return;
  // A call made on the old connection can't be answered on the new one.
  session.pendingTools.clear();
  session.live.close();
  session.live = new LiveClient(handlers(session));
  session.live.connect(live.websocket_url, live.token, live.model);
}

async function reconnect(session: Active): Promise<void> {
  if (active !== session || session.minting) return;
  const starting = store().phase === "connecting";
  // Each failed try counts, including a socket that opens and drops at once;
  // only a session that actually came back resets this.
  if (!session.resumeHandle || session.reconnectAttempts >= RECONNECT_ATTEMPTS) {
    fail(starting ? "connect-failed" : "connection-lost");
    return;
  }
  session.reconnectAttempts++;
  session.wantsResume = false;
  session.reconnectNotice ??= setTimeout(() => {
    if (active === session) store().patch({ phase: "reconnecting" });
  }, RECONNECT_NOTICE_MS);
  session.minting = true;
  try {
    await connect(session, session.resumeHandle);
    session.minting = false;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 600 * 2 ** session.reconnectAttempts));
    session.minting = false;
    void reconnect(session);
  }
}

function onTick(session: Active): void {
  const now = Date.now();
  const state = store();

  if (session.turnComplete && !session.audio.isPlaying) {
    commitTurn(session, session.atlasText);
    if (state.phase === "speaking" || state.phase === "thinking") store().patch({ phase: "listening" });
    // Google is ending this connection; a gap between turns is the time to move.
    if (session.wantsResume) void reconnect(session);
  }

  if (
    state.phase === "listening" &&
    session.userText &&
    now - session.lastInputAt > THINKING_AFTER_MS &&
    session.audio.micLevel() < QUIET_MIC_LEVEL
  ) {
    store().patch({ phase: "thinking" });
  }

  if (now - session.startedAt > session.config.max_session_seconds * 1000) {
    endVoiceSession("time-limit");
  } else if (
    now - session.lastActivity > session.config.idle_timeout_seconds * 1000 &&
    !session.audio.isPlaying
  ) {
    endVoiceSession("idle");
  }
}

function problemFor(error: unknown): VoiceProblem {
  if (error instanceof MicrophoneBlockedError) return "microphone-blocked";
  if (error instanceof MicrophoneMissingError) return "microphone-missing";
  if (error instanceof ApiError) {
    if (error.status === 503) return "not-configured";
    if (error.status === 429) return "busy";
  }
  return "connect-failed";
}

function teardown(session: Active): void {
  clearInterval(session.tick);
  if (session.reconnectNotice) clearTimeout(session.reconnectNotice);
  window.removeEventListener("pagehide", onPageHide);
  session.live.close();
  session.audio.close();
  active = null;
}

/** Stop talking and show a plain problem. What was already said stays saved. */
function fail(problem: VoiceProblem): void {
  const session = active;
  if (!session) return;
  commitInProgress(session);
  teardown(session);
  store().patch({ phase: "failed", problem, caption: "" });
}

function onPageHide(): void {
  const session = active;
  if (!session) return;
  commitInProgress(session);
  if (session.unsaved.length > 0) voiceApi.saveTurnsOnExit(session.conversationId, session.unsaved);
  session.unsaved = [];
  teardown(session);
}

/**
 * Start talking. Call directly from the tap: browsers allow audio only from a
 * person's own action, so nothing async may come before the audio is created.
 */
export async function startVoiceSession(
  conversationId: string | null,
  config: VoiceConfig,
  origin?: { x: number; y: number },
): Promise<void> {
  if (active) return;
  // Browsers offer the microphone only to https and localhost, so on a plain http
  // address (a phone on the office wifi, say) nothing below this line can work.
  if (!window.isSecureContext) {
    store().reset();
    store().patch({ phase: "failed", problem: "insecure-page", ...(origin ? { origin } : {}) });
    return;
  }
  const audio = new VoiceAudio();
  const now = Date.now();
  const session: Active = {
    audio,
    live: new LiveClient({} as never),
    startConversationId: conversationId,
    // A new chat picks its id up front, so a retried first save can't make two chats.
    conversationId: conversationId ?? crypto.randomUUID(),
    config,
    startedAt: now,
    lastActivity: now,
    lastInputAt: 0,
    resumeHandle: null,
    wantsResume: false,
    minting: false,
    reconnectAttempts: 0,
    reconnectNotice: null,
    heldAudio: [],
    userText: "",
    atlasText: "",
    turnComplete: false,
    pendingTools: new Set(),
    unsaved: [],
    saving: false,
    tick: setInterval(() => onTick(session), TICK_MS),
  };
  active = session;
  window.addEventListener("pagehide", onPageHide);
  store().reset();
  store().patch({ phase: "connecting", ...(origin ? { origin } : {}) });

  try {
    await audio.startMicrophone(
      (pcm) => {
        if (active !== session) return;
        if (session.live.isReady) {
          const talkingOver = !audio.isPlaying || pcmLevel(pcm) >= BARGE_IN_LEVEL;
          session.live.sendAudio(talkingOver ? pcm : new ArrayBuffer(pcm.byteLength));
        } else {
          session.heldAudio.push(pcm);
          if (session.heldAudio.length > HELD_AUDIO_CHUNKS) session.heldAudio.shift();
        }
      },
      () => fail("microphone-lost"),
    );
    if (active !== session) return;
    await connect(session);
  } catch (error) {
    if (active !== session) return;
    teardown(session);
    store().patch({ phase: "failed", problem: problemFor(error) });
  }
}

export function toggleMute(): void {
  const session = active;
  if (!session) return;
  const muted = !store().muted;
  session.audio.setMuted(muted);
  if (muted) session.live.endAudioStream();
  store().patch({ muted });
}

/** Finish: keep every word already spoken, release the microphone, close the screen. */
export function endVoiceSession(note: "idle" | "time-limit" | null = null): void {
  const session = active;
  if (!session && store().phase === "closed") return;
  if (session) {
    commitInProgress(session);
    const unsaved = session;
    teardown(session);
    void drainSaves(unsaved);
  }
  store().patch({ phase: "ended", endNote: note ?? store().endNote, caption: "" });
}
