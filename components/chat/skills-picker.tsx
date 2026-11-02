"use client";

import Link from "next/link";
import { ArrowLeft, Check, Settings2, Sparkles, X } from "lucide-react";
import { SkillIcon } from "@/components/skills/skill-row";
import type { Skill } from "@/types/skills";

/**
 * The "Skills" panel of the composer's + menu: every skill the user can use, built-in
 * and their own, each one a tick box. What is ticked is used for the next messages;
 * nothing else is added automatically.
 */
export function SkillsPicker({
  skills,
  loading = false,
  selected,
  onToggle,
  onBack,
  onNavigate,
}: {
  skills: Skill[];
  /** The list is still being fetched. */
  loading?: boolean;
  selected: string[];
  onToggle: (slug: string) => void;
  onBack: () => void;
  /** Called when the user leaves for the Skills page, so the menu can close. */
  onNavigate: () => void;
}) {
  const atLimit = selected.length >= 5;

  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <button onClick={onBack} aria-label="Back" className="icon-btn size-7">
          <ArrowLeft className="size-4" />
        </button>
        <p className="flex-1 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Skills
        </p>
        <span className="pr-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {selected.length > 0 ? `${selected.length} selected` : "None selected"}
        </span>
      </div>

      {loading ? (
        <p className="px-4 py-8 text-center text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          Loading skills…
        </p>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <Sparkles className="size-5" style={{ color: "var(--text-muted)" }} />
          <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            You don&apos;t have any skills yet.
          </p>
        </div>
      ) : (
        <ul className="max-h-[280px] overflow-y-auto py-1" role="listbox" aria-multiselectable aria-label="Skills">
          {skills.map((skill) => {
            const on = selected.includes(skill.slug);
            const blocked = !on && atLimit;
            return (
              <li key={skill.id} role="option" aria-selected={on}>
                <button
                  onClick={() => onToggle(skill.slug)}
                  disabled={blocked}
                  title={blocked ? "You can use up to 5 skills at once" : skill.description}
                  className="menu-item flex w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-40"
                >
                  <span
                    className="flex size-[18px] shrink-0 items-center justify-center rounded-md"
                    style={{
                      background: on ? "var(--accent-bright)" : "transparent",
                      border: `1.5px solid ${on ? "var(--accent-bright)" : "var(--border-strong)"}`,
                    }}
                  >
                    {on && <Check className="size-3 text-white" strokeWidth={3} />}
                  </span>
                  <span style={{ color: "var(--text-tertiary)" }}>
                    <SkillIcon icon={skill.icon} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {skill.name}
                    </span>
                    <span className="block truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {skill.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/skills"
        onClick={onNavigate}
        className="menu-item flex items-center gap-2 px-4 py-2.5 text-[12px]"
        style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-tertiary)" }}
      >
        <Settings2 className="size-3.5" />
        Manage skills
      </Link>
    </div>
  );
}

/** A small removable tag for something switched on for the next message. */
export function ComposerChip({
  icon,
  label,
  onRemove,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <span
      className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1 text-[11.5px] font-medium"
      style={{
        background: "var(--accent-subtle)",
        border: "1px solid var(--accent-border)",
        color: "var(--accent-bright)",
      }}
    >
      {icon}
      <span className="truncate">{label}</span>
      <button
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${label}`}
        className="flex size-4 items-center justify-center rounded-full transition-colors hover:bg-[var(--accent-border)] disabled:opacity-50"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
