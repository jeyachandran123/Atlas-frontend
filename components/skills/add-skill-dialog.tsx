"use client";

import { useRef, useState } from "react";
import { FileUp, Github, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { DialogShell, Field } from "@/components/skills/dialog-shell";
import { useCreateSkill, useInstallSkillFromUrl, useUploadSkill } from "@/lib/hooks/use-skills";
import type { SkillDetail } from "@/types/skills";

type Mode = "write" | "upload" | "github";

const MODES: Array<{ id: Mode; label: string; Icon: React.ElementType }> = [
  { id: "write", label: "Write", Icon: PenLine },
  { id: "upload", label: "Upload", Icon: FileUp },
  { id: "github", label: "GitHub", Icon: Github },
];

/** "Review Agent!" → "review-agent": the form the backend accepts as a skill name. */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message) || fallback;

export function AddSkillDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("write");

  function done(skill: SkillDetail) {
    toast.success(`${skill.name} added — type /${skill.slug} in chat to use it.`);
    onOpenChange(false);
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Add a skill"
      description="Skills are instructions that shape how Atlas answers."
    >
      <div role="tablist" aria-label="How to add the skill" className="mb-5 grid grid-cols-3 gap-1.5">
        {MODES.map(({ id, label, Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => setMode(id)}
              className="flex items-center justify-center gap-2 rounded-lg py-2 text-[12.5px] font-medium transition-colors"
              style={active
                ? { background: "var(--accent-subtle)", border: "1px solid var(--accent-border)", color: "var(--accent-glow)" }
                : { background: "var(--surface-2)", border: "1px solid var(--border-default)", color: "var(--text-tertiary)" }}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          );
        })}
      </div>

      {mode === "write" && <WriteForm onDone={done} />}
      {mode === "upload" && <UploadForm onDone={done} />}
      {mode === "github" && <GithubForm onDone={done} />}
    </DialogShell>
  );
}

function WriteForm({ onDone }: { onDone: (skill: SkillDetail) => void }) {
  const create = useCreateSkill();
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [triggers, setTriggers] = useState("");
  const slug = toSlug(displayName);
  const ready = !!slug && description.trim().length > 0 && instructions.trim().length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    create.mutate(
      {
        name: slug,
        display_name: displayName.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        triggers: triggers.split(",").map((t) => t.trim()).filter(Boolean),
      },
      { onSuccess: onDone, onError: (err) => toast.error(errorMessage(err, "Couldn't create the skill")) },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field
        label="Name"
        hint={slug ? <>Use it in chat as <code className="font-mono">/{slug}</code></> : "Letters and numbers; becomes the /command."}
      >
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Release Notes Writer"
          className="dialog-input"
          maxLength={120}
          autoFocus
        />
      </Field>
      <Field label="When should it be used?" hint="Atlas reads this to decide when the skill applies.">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Writes release notes from a list of merged changes."
          className="dialog-input"
          maxLength={1024}
        />
      </Field>
      <Field label="Instructions">
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={"Group changes under Features, Fixes and Breaking changes.\nKeep each line under 100 characters."}
          className="dialog-input min-h-[140px] resize-y font-mono text-[12.5px] leading-relaxed"
        />
      </Field>
      <Field label="Trigger words (optional)" hint="Comma separated. Messages containing these pick the skill automatically.">
        <input
          value={triggers}
          onChange={(e) => setTriggers(e.target.value)}
          placeholder="release notes, changelog"
          className="dialog-input"
        />
      </Field>
      <SubmitButton pending={create.isPending} disabled={!ready} label="Create skill" />
    </form>
  );
}

function UploadForm({ onDone }: { onDone: (skill: SkillDetail) => void }) {
  const upload = useUploadSkill();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    upload.mutate(file, {
      onSuccess: onDone,
      onError: (err) => toast.error(errorMessage(err, "Couldn't upload the skill")),
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex flex-col items-center gap-2 rounded-xl px-4 py-8 text-center transition-colors hover:bg-[var(--surface-2)]"
        style={{ border: "1px dashed var(--border-strong)", background: "var(--surface-1)" }}
      >
        <FileUp className="size-5" style={{ color: "var(--text-tertiary)" }} />
        <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
          {file ? file.name : "Choose a SKILL.md or .zip"}
        </span>
        <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          A .zip needs SKILL.md at its root. Up to 2 MB.
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".md,.zip"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <SubmitButton pending={upload.isPending} disabled={!file} label="Upload skill" />
    </form>
  );
}

function GithubForm({ onDone }: { onDone: (skill: SkillDetail) => void }) {
  const install = useInstallSkillFromUrl();
  const [url, setUrl] = useState("");
  const valid = /^https:\/\//i.test(url.trim());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    install.mutate(url.trim(), {
      onSuccess: onDone,
      onError: (err) => toast.error(errorMessage(err, "Couldn't install from that URL")),
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field
        label="GitHub URL"
        hint="A folder or SKILL.md on GitHub, e.g. github.com/org/repo/tree/main/skills/my-skill"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/…"
          className="dialog-input"
          autoFocus
        />
      </Field>
      <SubmitButton pending={install.isPending} disabled={!valid} label="Install skill" />
    </form>
  );
}

function SubmitButton({ pending, disabled, label }: { pending: boolean; disabled: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="signal-btn mt-1 flex h-10 w-full items-center justify-center gap-2 text-[13.5px] font-semibold"
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {label}
    </button>
  );
}
