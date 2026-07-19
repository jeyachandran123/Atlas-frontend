"use client";

import { useRef, useState, useEffect, type KeyboardEvent } from "react";
import { ArrowUp, Square, Plus, ChevronDown, Check, Paperclip, Camera, X, FileText, Image } from "lucide-react";
import { useChatStore } from "@/lib/stores/chat-store";
import { RepoSelector } from "@/components/layout/repo-selector";

/* ── Agent definitions ─────────────────────────────────────────── */
const AGENTS = [
  {
    id: "auto",
    label: "Auto",
    description: "General assistant",
    dot: "#818cf8",
  },
  {
    id: "code",
    label: "Code",
    description: "Full coding assistant with repo search & tools",
    dot: "#34d399",
  },
  {
    id: "business",
    label: "Business",
    description: "Hotel, ERP, POS & stock management specialist",
    dot: "#fbbf24",
  },
] as const;

type AgentId = (typeof AGENTS)[number]["id"];

/* ── Attached file type ────────────────────────────────────────── */
interface AttachedFile {
  id: string;
  file: File;
  preview?: string; // data URL for images
}

/* ── Main component ────────────────────────────────────────────── */
export function ChatInput({
  onSend, onStop, isStreaming, disabled,
}: {
  onSend: (message: string, files?: File[], agentId?: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const agent = useChatStore((s) => s.agentMode);
  const setAgent = useChatStore((s) => s.setAgentMode);
  const [agentOpen, setAgentOpen] = useState(false);
  const [switchedTo, setSwitchedTo] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);

  const hasContent = value.trim().length > 0 || attachedFiles.length > 0;
  const selectedAgent = AGENTS.find((a) => a.id === agent)!;

  /* Close dropdowns on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (agentRef.current && !agentRef.current.contains(e.target as Node)) setAgentOpen(false);
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) setAttachOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Keyboard shortcut Ctrl+U for file upload */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "u") {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    }
    document.addEventListener("keydown", handler as unknown as EventListener);
    return () => document.removeEventListener("keydown", handler as unknown as EventListener);
  }, []);

  /* Paste images from clipboard */
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        const dt = new DataTransfer();
        imageFiles.forEach((f) => dt.items.add(f));
        handleFiles(dt.files);
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  function switchAgent(id: AgentId) {
    setAgent(id);
    setAgentOpen(false);
    const label = AGENTS.find((a) => a.id === id)!.label;
    setSwitchedTo(label);
    setTimeout(() => setSwitchedTo(null), 2000);
  }

  function submit() {
    const t = value.trim();
    if ((!t && attachedFiles.length === 0) || isStreaming) return;
    onSend(t, attachedFiles.map((f) => f.file), agent);
    setValue("");
    setAttachedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  function onTextInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const id = `${file.name}-${Date.now()}-${Math.random()}`;
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setAttachedFiles((prev) => [...prev, { id, file, preview: ev.target?.result as string }]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachedFiles((prev) => [...prev, { id, file }]);
      }
    });
    setAttachOpen(false);
  }

  function removeFile(id: string) {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  /* Drag-and-drop */
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }

  return (
    <div
      className="relative transition-all duration-200"
      style={{
        background: "var(--surface-1)",
        border: isStreaming
          ? "1px solid var(--accent-border)"
          : hasContent
          ? "1px solid var(--border-strong)"
          : "1px solid var(--border-default)",
        borderRadius: "18px",
        boxShadow: isStreaming
          ? `0 0 0 3px var(--accent-subtle), var(--shadow-lg)`
          : hasContent
          ? "var(--shadow-lg)"
          : "var(--shadow-md)",
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Streaming bar */}
      {isStreaming && (
        <div
          className="absolute inset-x-0 top-0 h-[2px] rounded-t-[18px] animate-signal-pulse"
          style={{
            background: "linear-gradient(90deg, transparent 0%, var(--accent) 30%, #7c3aed 70%, transparent 100%)",
          }}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.docx,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.cs,.cpp,.c,.html,.css,.yaml,.yml,.toml,.sh"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {attachedFiles.map((af) => (
            <FileChip key={af.id} af={af} onRemove={() => removeFile(af.id)} />
          ))}
        </div>
      )}

      {/* Mode switch toast */}
      {switchedTo && (
        <div
          className="flex items-center gap-2 px-4 pt-3 pb-1 text-[12px] animate-fade-in"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{
              background: AGENTS.find((a) => a.label === switchedTo)?.dot,
              boxShadow: `0 0 4px ${AGENTS.find((a) => a.label === switchedTo)?.dot}`,
            }}
          />
          Switched to <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{switchedTo} mode</span>
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onTextInput}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={
          agent === "business" ? "Ask about hotel management, ERP, POS, inventory…" :
          agent === "code"     ? "Ask anything about your codebase…" :
          "Ask me anything — coding, history, business, pop culture…"
        }
        rows={1}
        className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[14px] leading-relaxed focus:outline-none disabled:opacity-40"
        style={{
          color: "var(--text-primary)",
          maxHeight: "200px",
          fontFamily: "var(--font-sans)",
          letterSpacing: "-0.01em",
        }}
      />

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-3 pb-3 pt-1">

        {/* Left — attach + agent + repo (code mode) */}
        <div className="flex items-center gap-1">

          {/* Attach dropdown */}
          <div ref={attachRef} className="relative">
            <button
              onClick={() => { setAttachOpen((o) => !o); setAgentOpen(false); }}
              className="flex size-8 items-center justify-center rounded-lg transition-all duration-150"
              style={{
                background: attachOpen ? "var(--surface-3)" : "transparent",
                color: attachOpen ? "var(--text-primary)" : "var(--text-tertiary)",
                border: "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                if (!attachOpen) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)";
                }
              }}
              title="Add files or photos (Ctrl+U)"
            >
              <Plus className="size-[18px]" />
            </button>

            {/* Attach menu */}
            {attachOpen && (
              <div
                className="absolute bottom-full left-0 mb-2 w-[260px] overflow-hidden rounded-xl animate-scale-up"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-strong)",
                  boxShadow: "var(--shadow-xl)",
                  transformOrigin: "bottom left",
                }}
              >
                <AttachMenuItem
                  icon={<Paperclip className="size-4" />}
                  label="Add files or photos"
                  shortcut="Ctrl+U"
                  onClick={() => fileInputRef.current?.click()}
                />
                <AttachMenuItem
                  icon={<Camera className="size-4" />}
                  label="Take a screenshot"
                  onClick={() => {
                    // placeholder — screenshot capture hook goes here
                    setAttachOpen(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Agent selector */}
          <div ref={agentRef} className="relative">
            <button
              onClick={() => { setAgentOpen((o) => !o); setAttachOpen(false); }}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150"
              style={{
                background: agentOpen ? "var(--surface-3)" : "transparent",
                color: "var(--text-secondary)",
                border: "1px solid transparent",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                if (!agentOpen) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                }
              }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: selectedAgent.dot, boxShadow: `0 0 4px ${selectedAgent.dot}` }}
              />
              {selectedAgent.label}
              <ChevronDown
                className="size-3 transition-transform duration-150"
                style={{ transform: agentOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>

            {/* Agent dropdown */}
            {agentOpen && (
              <div
                className="absolute bottom-full left-0 mb-2 w-[220px] overflow-hidden rounded-xl animate-scale-up"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-strong)",
                  boxShadow: "var(--shadow-xl)",
                  transformOrigin: "bottom left",
                }}
              >
                <div className="p-1.5">
                  {AGENTS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => switchAgent(a.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-100"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)";
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                      }}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: a.dot, boxShadow: `0 0 5px ${a.dot}` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                          {a.label}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {a.description}
                        </p>
                      </div>
                      {agent === a.id && (
                        <Check className="size-3.5 shrink-0" style={{ color: "var(--accent-bright)" }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Repo selector — code mode only, after agent selector */}
          {agent === "code" && (
            <>
              <span className="mx-1 h-3.5 w-px" style={{ background: "var(--border-default)" }} />
              <RepoSelector />
            </>
          )}
        </div>

        {/* Right — send / stop */}
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <button
              onClick={onStop}
              className="flex size-8 items-center justify-center rounded-xl transition-all duration-150"
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!hasContent || disabled}
              className="flex size-8 items-center justify-center rounded-xl transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-25"
              style={hasContent && !disabled ? {
                background: "linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)",
                boxShadow: "var(--shadow-accent-sm), inset 0 1px 0 rgba(255,255,255,0.15)",
                color: "#fff",
              } : {
                background: "var(--surface-3)",
                border: "1px solid var(--border-default)",
                color: "var(--text-muted)",
              }}
              onMouseEnter={(e) => {
                if (hasContent && !disabled) {
                  (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.10)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.filter = "";
                (e.currentTarget as HTMLButtonElement).style.transform = "";
              }}
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Attach menu item ───────────────────────────────────────────── */
function AttachMenuItem({
  icon, label, shortcut, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-100"
      style={{ color: "var(--text-secondary)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
      }}
    >
      <span style={{ color: "var(--text-tertiary)" }}>{icon}</span>
      <span className="flex-1 text-[13px] font-medium">{label}</span>
      {shortcut && (
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{shortcut}</span>
      )}
    </button>
  );
}

/* ── File chip ──────────────────────────────────────────────────── */
function FileChip({ af, onRemove }: { af: AttachedFile; onRemove: () => void }) {
  const isImage = af.file.type.startsWith("image/");
  const sizeLabel = af.file.size < 1024 * 1024
    ? `${Math.round(af.file.size / 1024)}KB`
    : `${(af.file.size / (1024 * 1024)).toFixed(1)}MB`;

  return (
    <div
      className="group relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition-all"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border-default)",
        maxWidth: "180px",
      }}
    >
      {isImage && af.preview ? (
        <img
          src={af.preview}
          alt={af.file.name}
          className="size-5 rounded object-cover shrink-0"
        />
      ) : (
        <span style={{ color: "var(--accent-bright)" }}>
          {isImage ? <Image className="size-4 shrink-0" /> : <FileText className="size-4 shrink-0" />}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-medium" style={{ color: "var(--text-primary)" }}>
          {af.file.name}
        </p>
        <p style={{ color: "var(--text-muted)" }}>{sizeLabel}</p>
      </div>
      <button
        onClick={onRemove}
        className="ml-1 flex size-4 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: "var(--surface-4)", color: "var(--text-secondary)" }}
      >
        <X className="size-2.5" />
      </button>
    </div>
  );
}
