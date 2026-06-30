"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
}: {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2 focus-within:border-signal/40 transition-colors">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ask about this codebase, or describe what to build..."
        rows={1}
        className={cn(
          "max-h-[200px] w-full resize-none bg-transparent px-2 py-1.5 text-sm text-text-primary",
          "placeholder:text-text-tertiary focus:outline-none disabled:opacity-50",
        )}
      />
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-text-tertiary">
          <kbd className="rounded bg-surface-overlay px-1 py-0.5 font-mono">Enter</kbd> to send,{" "}
          <kbd className="rounded bg-surface-overlay px-1 py-0.5 font-mono">Shift+Enter</kbd> for newline
        </span>

        {isStreaming ? (
          <Button size="icon" variant="outline" onClick={onStop} aria-label="Stop generating">
            <Square className="size-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon"
            variant="signal"
            onClick={handleSubmit}
            disabled={!value.trim() || disabled}
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
