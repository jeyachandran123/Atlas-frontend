"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Check, ChevronsUpDown, Database, FlaskConical, FolderKanban, Plus, Scale, Wallet } from "lucide-react";
import { useCreateWorkspace, useWorkspaces } from "@/lib/hooks/use-workspace";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { Workspace } from "@/types/workspace";

const ICONS: Record<string, React.ElementType> = {
  folder: FolderKanban, database: Database, flask: FlaskConical,
  scale: Scale, wallet: Wallet,
};

export function workspaceIcon(icon: string): React.ElementType {
  return ICONS[icon] ?? FolderKanban;
}

export function WorkspaceSwitcher({ current }: { current: Workspace }) {
  const router = useRouter();
  const { data: workspaces = [] } = useWorkspaces();
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);
  const createWs = useCreateWorkspace();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  function switchTo(id: string) {
    setActive(id);
    router.push(`/w/${id}`);
  }

  async function create() {
    if (!name.trim()) return;
    const ws = await createWs.mutateAsync({ name: name.trim() });
    setName("");
    setCreating(false);
    switchTo(ws.id);
  }

  const CurrentIcon = workspaceIcon(current.icon);

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
          style={{ border: "1px solid var(--border-subtle)" }}
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-md"
            style={{ background: "var(--accent-gradient)" }}
          >
            <CurrentIcon className="size-3.5 text-white" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {current.name}
            </span>
            <span className="block text-[10.5px]" style={{ color: "var(--text-muted)" }}>
              {current.is_default ? "Default workspace" : "Workspace"}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
        </button>
      </Dropdown.Trigger>

      <Dropdown.Portal>
        <Dropdown.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[260px] overflow-hidden rounded-xl p-1.5 animate-scale-up"
          style={{
            background: "var(--surface-overlay)",
            backdropFilter: "blur(24px)",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          <div className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}>
            Workspaces
          </div>
          {workspaces.map((w) => {
            const Icon = workspaceIcon(w.icon);
            return (
              <Dropdown.Item
                key={w.id}
                onSelect={() => switchTo(w.id)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--surface-3)]"
                style={{ color: "var(--text-primary)" }}
              >
                <Icon className="size-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                {w.id === current.id && <Check className="size-3.5" style={{ color: "var(--accent)" }} />}
              </Dropdown.Item>
            );
          })}

          <div className="my-1 h-px" style={{ background: "var(--border-subtle)" }} />

          {creating ? (
            <div className="p-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void create();
                  if (e.key === "Escape") setCreating(false);
                }}
                placeholder="Workspace name…"
                className="w-full rounded-lg px-2.5 py-1.5 text-[13px] outline-none"
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          ) : (
            <button
              onClick={(e) => { e.preventDefault(); setCreating(true); }}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] outline-none transition-colors hover:bg-[var(--surface-3)]"
              style={{ color: "var(--text-secondary)" }}
            >
              <Plus className="size-4" /> New workspace
            </button>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
