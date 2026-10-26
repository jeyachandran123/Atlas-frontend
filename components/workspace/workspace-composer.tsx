"use client";

import { useEffect, useRef } from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import {
  ChevronDown,
  Loader2,
  Paperclip,
  SendHorizonal,
  Sparkles,
  Square,
} from "lucide-react";
import { useVoiceInput } from "@/lib/hooks/use-voice-input";
import { ListeningStrip, VOICE_MESSAGES, VoiceButton } from "@/components/chat/voice-input";

/**
 * The workspace composer, wearing the chat module's clothes.
 *
 * The coding assistant's input is the one people already use, and the two
 * surfaces looking like two products was the complaint. So the shell is the
 * same — the 18px radius, the accent ring and the travelling bar while a turn
 * is running — and only what sits inside it differs, because this composer
 * also has to attach documents and switch into generation.
 */
export function WorkspaceComposer({
  value,
  onChange,
  onSend,
  onStop,
  onAttach,
  busy,
  uploading,
  genMode,
  onToggleGen,
  format,
  formatLabel,
  formats,
  onFormatChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onAttach: (files: FileList | null) => void;
  busy: boolean;
  uploading: boolean;
  genMode: boolean;
  onToggleGen: () => void;
  format: string;
  formatLabel: (v: string) => string;
  formats: { value: string; label: string }[];
  onFormatChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const hasContent = value.trim().length > 0;

  /* ── Voice dictation — the same microphone as the chat module ─── */
  // What was in the box when dictation began; the words heard are added after it.
  const voiceBaseRef = useRef("");
  // False once the user types or sends: late words must not overwrite that.
  const dictatingRef = useRef(false);
  const voice = useVoiceInput({
    onTranscript: (heard) => {
      if (!dictatingRef.current) return;
      const base = voiceBaseRef.current;
      onChange(heard ? (base ? `${base} ${heard}` : heard) : base);
    },
    onError: (kind) => {
      if (kind === "no-speech") toast(VOICE_MESSAGES[kind]);
      else toast.error(VOICE_MESSAGES[kind]);
    },
  });
  const { listening, stop: stopVoice } = voice;

  function toggleVoice() {
    if (listening) { stopVoice(); return; }
    if (!voice.supported) { toast.error(VOICE_MESSAGES.unsupported); return; }
    voiceBaseRef.current = value.trimEnd();
    dictatingRef.current = true;
    voice.start();
    textareaRef.current?.focus();
  }

  /** Typing or sending takes over from dictation: keep what is there, stop listening. */
  function endDictation() {
    if (!listening) return;
    dictatingRef.current = false;
    stopVoice();
  }

  function send() {
    endDictation();
    onSend();
  }

  // Esc stops dictation wherever focus is.
  useEffect(() => {
    if (!listening) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") stopVoice(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [listening, stopVoice]);

  // A turn starting ends dictation.
  useEffect(() => {
    if (busy && listening) {
      dictatingRef.current = false;
      stopVoice();
    }
  }, [busy, listening, stopVoice]);

  // Grow with the text, to a ceiling. A composer that scrolls at three lines
  // makes people write in a box the size of a search field. While dictating,
  // the newest words stay in view.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    if (listening) el.scrollTop = el.scrollHeight;
  }, [value, listening]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    onAttach(e.dataTransfer.files);
  }

  return (
    <div
      className="relative transition-all duration-200"
      style={{
        background: "var(--surface-1)",
        border: busy
          ? "1px solid var(--accent-border)"
          : listening
          ? "1px solid rgba(239,68,68,0.55)"
          : genMode
          ? "1px solid var(--accent-border)"
          : hasContent
          ? "1px solid var(--border-strong)"
          : "1px solid var(--border-default)",
        borderRadius: "18px",
        boxShadow: busy
          ? "0 0 0 3px var(--accent-subtle), var(--shadow-lg)"
          : listening
          ? "0 0 0 3px rgba(239,68,68,0.14), var(--shadow-lg)"
          : hasContent
          ? "var(--shadow-lg)"
          : "var(--shadow-md)",
      }}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* The turn is running — same signal the chat module uses. */}
      {busy && (
        <div
          className="absolute inset-x-0 top-0 h-[2px] rounded-t-[18px] animate-signal-pulse"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, var(--accent) 30%, #7c3aed 70%, transparent 100%)",
          }}
        />
      )}

      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => onAttach(e.target.files)}
      />

      {/* Dictation in progress */}
      {listening && voice.startedAt !== null && (
        <ListeningStrip levelRef={voice.levelRef} startedAt={voice.startedAt} />
      )}

      {/* Text */}
      <div className="px-4 pt-3.5">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { endDictation(); onChange(e.target.value); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (hasContent && !busy) send();
            }
          }}
          rows={1}
          placeholder={
            listening
              ? "Listening… start speaking"
              : genMode
              ? `Describe the ${formatLabel(format)} to generate…`
              : "Ask about your documents — or just say hello…"
          }
          className="composer-input max-h-[200px] w-full resize-none bg-transparent leading-relaxed outline-none placeholder:opacity-60"
          style={{ color: "var(--text-primary)" }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5 px-3 pb-3 pt-2">
        <button
          onClick={() => fileInput.current?.click()}
          disabled={uploading || busy}
          aria-label="Attach document"
          className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-3)] disabled:opacity-50"
          style={{ color: "var(--text-muted)" }}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Paperclip className="size-4" />
          )}
        </button>

        <button
          onClick={onToggleGen}
          disabled={busy}
          aria-pressed={genMode}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50"
          style={{
            background: genMode ? "var(--accent-subtle)" : "transparent",
            border: `1px solid ${genMode ? "var(--accent-border)" : "var(--border-subtle)"}`,
            color: genMode ? "var(--accent-bright)" : "var(--text-secondary)",
          }}
        >
          <Sparkles className="size-3.5" /> <span className="hidden sm:inline">Generate</span>
        </button>

        {genMode && (
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <button
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50"
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                }}
              >
                {formatLabel(format)} <ChevronDown className="size-3" />
              </button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content
                align="start"
                sideOffset={6}
                className="z-50 w-36 overflow-hidden rounded-xl p-1.5 animate-scale-up"
                style={{
                  background: "var(--surface-overlay)",
                  backdropFilter: "blur(24px)",
                  border: "1px solid var(--border-strong)",
                  boxShadow: "var(--shadow-xl)",
                }}
              >
                {formats.map((f) => (
                  <Dropdown.Item
                    key={f.value}
                    onSelect={() => onFormatChange(f.value)}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--surface-3)]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {f.label}
                    {format === f.value && (
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: "var(--accent-bright)" }}
                      />
                    )}
                  </Dropdown.Item>
                ))}
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
        )}

        <div className="ml-auto flex items-center gap-2">
          {!busy && (
            <VoiceButton
              supported={voice.supported}
              listening={listening}
              disabled={uploading}
              onToggle={toggleVoice}
            />
          )}
          {busy ? (
            <button
              onClick={onStop}
              aria-label="Stop"
              className="flex size-8 items-center justify-center rounded-full transition-colors"
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
              }}
            >
              <Square className="size-3 fill-current" />
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!hasContent}
              aria-label={genMode ? "Generate" : "Send"}
              className="flex size-8 items-center justify-center rounded-full transition-all duration-150 disabled:cursor-not-allowed"
              style={{
                background: hasContent ? "var(--accent-gradient)" : "var(--surface-3)",
                color: hasContent ? "#fff" : "var(--text-muted)",
                boxShadow: hasContent ? "0 4px 14px rgba(99,102,241,0.35)" : "none",
              }}
            >
              {genMode ? <Sparkles className="size-4" /> : <SendHorizonal className="size-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
