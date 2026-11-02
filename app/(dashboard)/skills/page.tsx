"use client";

import { useDeferredValue, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AddSkillDialog } from "@/components/skills/add-skill-dialog";
import { SkillDetailDialog } from "@/components/skills/skill-detail-dialog";
import { SkillRow } from "@/components/skills/skill-row";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { KeyRowsSkeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useDeleteSkill, useSaveSkillPreferences, useSkillPreferences, useSkills, useToggleSkill,
} from "@/lib/hooks/use-skills";
import { ApiError } from "@/types/api";
import type { Skill } from "@/types/skills";

const CARD_STYLE = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  boxShadow: "var(--shadow-sm)",
} as const;

/** Customize → Skills: what shapes Atlas's answers, and when. */
export default function SkillsPage() {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  const { data, isLoading, error } = useSkills(q);
  const toggle = useToggleSkill();
  const remove = useDeleteSkill();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Skill | null>(null);

  // 404 = ENABLE_SKILLS is off on the server.
  if (error instanceof ApiError && error.status === 404) {
    return (
      <Shell onAdd={null}>
        <Empty text="Skills are turned off on this server. Set ENABLE_SKILLS=true in the backend's .env and restart it." />
      </Shell>
    );
  }

  function onToggle(skill: Skill, enabled: boolean) {
    toggle.mutate(
      { id: skill.id, enabled },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't change the skill") },
    );
  }

  function confirmRemove() {
    if (!removing) return;
    remove.mutate(removing.id, {
      onSuccess: () => { toast.success(`${removing.name} removed`); setRemoving(null); },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't remove the skill"),
    });
  }

  const groups: Array<{ title: string; skills: Skill[]; empty?: string }> = data
    ? [
        { title: "Your skills", skills: data.installed, empty: q ? undefined : "Skills you add appear here." },
        { title: "Built-in", skills: data.system },
        { title: "Available in your organization", skills: data.available },
      ]
    : [];
  const nothingFound = !!data && !!q && groups.every((g) => g.skills.length === 0);

  return (
    <Shell onAdd={() => setAdding(true)}>
      <Preferences />

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills"
          aria-label="Search skills"
          className="dialog-input w-full pl-9"
        />
      </div>

      {isLoading ? (
        <KeyRowsSkeleton />
      ) : nothingFound ? (
        <Empty text={`No skills match “${q}”.`} />
      ) : (
        groups.map(({ title, skills, empty }) =>
          skills.length === 0 && !empty ? null : (
            <section key={title}>
              <p
                className="mb-3 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
              >
                {title} ({skills.length})
              </p>
              {skills.length === 0 ? (
                <Empty text={empty!} />
              ) : (
                <div className="flex flex-col gap-2">
                  {skills.map((skill) => (
                    <SkillRow
                      key={skill.id}
                      skill={skill}
                      onOpen={() => setOpenId(skill.id)}
                      onToggle={(enabled) => onToggle(skill, enabled)}
                      onDelete={skill.scope !== "system" && skill.installed ? () => setRemoving(skill) : undefined}
                      toggling={toggle.isPending && toggle.variables?.id === skill.id}
                    />
                  ))}
                </div>
              )}
            </section>
          ),
        )
      )}

      <AddSkillDialog open={adding} onOpenChange={setAdding} />
      <SkillDetailDialog skillId={openId} onOpenChange={(open) => !open && setOpenId(null)} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? "skill"}?`}
        description={
          removing?.scope === "org" && !removing.editable
            ? "It will be uninstalled for you. Others in your organization keep it."
            : "This deletes the skill. It can't be undone."
        }
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={confirmRemove}
      />
    </Shell>
  );
}

function Shell({ onAdd, children }: { onAdd: (() => void) | null; children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="page-header">
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-[17px] font-semibold"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
            >
              Skills
            </h1>
            <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              Instructions that shape how Atlas answers. Type <code className="font-mono">/</code> and
              a skill&apos;s name in chat to use one directly.
            </p>
          </div>
          {onAdd && (
            <button
              onClick={onAdd}
              className="signal-btn flex shrink-0 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
            >
              <Plus className="size-3.5" />
              Add skill
            </button>
          )}
        </div>
      </div>
      <div className="px-4 py-5 sm:px-8 sm:py-6">
        <div className="mx-auto max-w-2xl space-y-5">{children}</div>
      </div>
    </div>
  );
}

function Preferences() {
  const { data: prefs } = useSkillPreferences();
  const save = useSaveSkillPreferences();
  if (!prefs) return null;

  function update(next: { auto_select?: boolean; max_active?: number }) {
    save.mutate(
      {
        auto_select: next.auto_select ?? prefs!.auto_select,
        max_active: next.max_active ?? prefs!.max_active_override,
      },
      { onError: () => toast.error("Couldn't save your skill settings") },
    );
  }

  return (
    <div className="rounded-xl p-4" style={CARD_STYLE}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Pick skills automatically
          </p>
          <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
            Atlas adds relevant skills that are on to each reply. Off, a skill is used only when you type its /command.
          </p>
        </div>
        <Switch
          checked={prefs.auto_select}
          disabled={save.isPending}
          onCheckedChange={(auto_select) => update({ auto_select })}
          label="Pick skills automatically"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          Most skills in one reply
        </p>
        <div role="radiogroup" aria-label="Most skills in one reply" className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = prefs.max_active === n;
            return (
              <button
                key={n}
                role="radio"
                aria-checked={active}
                disabled={save.isPending}
                onClick={() => update({ max_active: n })}
                className="size-8 rounded-lg text-[12.5px] font-medium transition-colors"
                style={active
                  ? { background: "var(--accent-subtle)", border: "1px solid var(--accent-border)", color: "var(--accent-bright)" }
                  : { background: "var(--surface-2)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl py-10 text-center"
      style={{ background: "var(--surface-1)", border: "1px dashed var(--border-default)" }}
    >
      <div
        className="flex size-10 items-center justify-center rounded-xl"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)" }}
      >
        <Sparkles className="size-4" style={{ color: "var(--text-muted)" }} />
      </div>
      <p className="max-w-sm px-4 text-[13px]" style={{ color: "var(--text-tertiary)" }}>{text}</p>
    </div>
  );
}
