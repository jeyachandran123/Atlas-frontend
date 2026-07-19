"use client";

import * as Select from "@radix-ui/react-select";
import { ChevronDown, FolderGit2, Check } from "lucide-react";
import { useRepos } from "@/lib/hooks/use-repos";
import { useChatStore } from "@/lib/stores/chat-store";
import type { IndexStatus } from "@/types/api";

const DOT_COLOR: Record<IndexStatus, string> = {
  ready:    "var(--success)",
  indexing: "var(--warning)",
  pending:  "var(--text-muted)",
  error:    "var(--danger)",
  stale:    "var(--warning)",
};

export function RepoSelector() {
  const { data: repos = [] } = useRepos();
  const selectedRepoId = useChatStore((s) => s.selectedRepoId);
  const setSelectedRepo = useChatStore((s) => s.setSelectedRepo);
  const selected = repos.find((r) => r.id === selectedRepoId);

  return (
    <Select.Root value={selectedRepoId ?? undefined} onValueChange={setSelectedRepo}>
      <Select.Trigger
        className="hover-surface flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium outline-none"
        style={{ color: "var(--text-secondary)" }}
      >
        <FolderGit2 className="size-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} />
        <Select.Value placeholder="All repositories">
          {selected?.name ?? "All repositories"}
        </Select.Value>
        <ChevronDown className="size-3 shrink-0" style={{ color: "var(--text-muted)" }} />
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="z-50 overflow-hidden rounded-xl animate-scale-up"
          style={{
            background: "var(--surface-overlay)",
            backdropFilter: "blur(24px) saturate(160%)",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-xl)",
            minWidth: "220px",
          }}
        >
          <Select.Viewport className="p-1.5">
            {repos.map((repo) => (
              <Select.Item
                key={repo.id}
                value={repo.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--surface-3)]"
                style={{ color: "var(--text-secondary)" }}
              >
                <span className="flex items-center gap-2">
                  <Select.ItemIndicator>
                    <Check className="size-3" style={{ color: "var(--accent-bright)" }} />
                  </Select.ItemIndicator>
                  <Select.ItemText>{repo.name}</Select.ItemText>
                </span>
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: DOT_COLOR[repo.index_status] }}
                />
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
