"use client";

import {
  BookOpen, Bug, Download, Sparkles, Trash2, Wand2, type LucideIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { Skill } from "@/types/skills";

/** SKILL.md names its icon; these are the ones shipped skills use. */
const ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  bug: Bug,
  download: Download,
  sparkles: Sparkles,
  wand: Wand2,
};

export function SkillIcon({ icon, className = "size-4" }: { icon: string | null; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Sparkles;
  return <Icon className={className} />;
}

const SCOPE_LABEL: Record<Skill["scope"], string> = {
  system: "Built-in",
  org: "Organization",
  personal: "Personal",
};

export function SkillRow({
  skill,
  onOpen,
  onToggle,
  onDelete,
  toggling = false,
}: {
  skill: Skill;
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
  /** Omitted where the skill can't be removed (built-in ones). */
  onDelete?: () => void;
  toggling?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 outline-none transition-colors hover:bg-[var(--surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-default)" }}
    >
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: skill.enabled ? "var(--accent-subtle)" : "var(--surface-2)",
          border: `1px solid ${skill.enabled ? "var(--accent-border)" : "var(--border-default)"}`,
          color: skill.enabled ? "var(--accent-bright)" : "var(--text-tertiary)",
        }}
      >
        <SkillIcon icon={skill.icon} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
            {skill.name}
          </p>
          <code className="shrink-0 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
            /{skill.slug}
          </code>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
          {skill.description}
        </p>
        <p className="mt-1 text-[10.5px]" style={{ color: "var(--text-muted)" }}>
          {SCOPE_LABEL[skill.scope]}
          {skill.version ? ` · v${skill.version}` : ""}
          {skill.source === "git" ? " · from GitHub" : skill.source === "upload" ? " · uploaded" : ""}
        </p>
      </div>

      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={`Remove ${skill.name}`}
          title="Remove"
          className="icon-btn danger size-7 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
      <Switch
        checked={skill.enabled}
        onCheckedChange={onToggle}
        disabled={toggling}
        label={skill.enabled ? `Turn off ${skill.name}` : `Turn on ${skill.name}`}
      />
    </div>
  );
}
