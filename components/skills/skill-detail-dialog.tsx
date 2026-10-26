"use client";

import { Loader2 } from "lucide-react";
import { DialogShell } from "@/components/skills/dialog-shell";
import { SkillIcon } from "@/components/skills/skill-row";
import { Switch } from "@/components/ui/switch";
import { useSkill, useToggleSkill } from "@/lib/hooks/use-skills";

const MODE_LABEL: Record<string, string> = { auto: "Auto", code: "Code", business: "Business" };

/** What a skill tells Atlas to do, and when it is picked. Read-only. */
export function SkillDetailDialog({
  skillId,
  onOpenChange,
}: {
  skillId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: skill, isLoading } = useSkill(skillId);
  const toggle = useToggleSkill();

  return (
    <DialogShell
      open={!!skillId}
      onOpenChange={onOpenChange}
      width={600}
      title={
        skill ? (
          <span className="flex items-center gap-2.5">
            <span style={{ color: "var(--accent-bright)" }}><SkillIcon icon={skill.icon} /></span>
            {skill.name}
          </span>
        ) : "Skill"
      }
      description={skill?.description}
    >
      {isLoading || !skill ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div
            className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                {skill.enabled ? "On" : "Off"}
              </p>
              <p className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                Type <code className="font-mono">/{skill.slug}</code> in chat to use it directly.
              </p>
            </div>
            <Switch
              checked={skill.enabled}
              disabled={toggle.isPending}
              onCheckedChange={(enabled) => toggle.mutate({ id: skill.id, enabled })}
              label={skill.enabled ? `Turn off ${skill.name}` : `Turn on ${skill.name}`}
            />
          </div>

          {(skill.triggers.length > 0 || skill.modes.length > 0) && (
            <div className="flex flex-col gap-2.5">
              {skill.triggers.length > 0 && (
                <Chips label="Picked automatically for" items={skill.triggers} />
              )}
              {skill.modes.length > 0 && (
                <Chips label="Chat modes" items={skill.modes.map((m) => MODE_LABEL[m] ?? m)} />
              )}
            </div>
          )}

          <div>
            <p
              className="mb-2 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
            >
              Instructions
            </p>
            <pre
              className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl p-4 font-mono text-[12px] leading-relaxed"
              style={{
                background: "var(--canvas)",
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
              }}
            >
              {skill.instructions}
            </pre>
          </div>

          {skill.files.length > 0 && (
            <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
              Also includes {skill.files.map((f) => f.path).join(", ")}
            </p>
          )}
        </div>
      )}
    </DialogShell>
  );
}

function Chips({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>{label}</span>
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full px-2 py-0.5 text-[11px]"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)", color: "var(--text-secondary)" }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
