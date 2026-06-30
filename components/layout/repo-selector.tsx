"use client";

import * as Select from "@radix-ui/react-select";
import { ChevronDown, FolderGit2, Check } from "lucide-react";
import { useRepos } from "@/lib/hooks/use-repos";
import { useChatStore } from "@/lib/stores/chat-store";
import { Badge } from "@/components/ui/badge";
import type { IndexStatus } from "@/types/api";

const STATUS_VARIANT: Record<IndexStatus, "ready" | "indexing" | "error" | "pending"> = {
  ready: "ready",
  indexing: "indexing",
  pending: "pending",
  error: "error",
  stale: "indexing",
};

export function RepoSelector() {
  const { data: repos = [] } = useRepos();
  const selectedRepoId = useChatStore((s) => s.selectedRepoId);
  const setSelectedRepo = useChatStore((s) => s.setSelectedRepo);

  const selected = repos.find((r) => r.id === selectedRepoId);

  return (
    <Select.Root value={selectedRepoId ?? undefined} onValueChange={setSelectedRepo}>
      <Select.Trigger className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <FolderGit2 className="size-3.5" />
        <Select.Value placeholder="All repositories">
          {selected?.name ?? "All repositories"}
        </Select.Value>
        <ChevronDown className="size-3.5 text-text-tertiary" />
      </Select.Trigger>

      <Select.Portal>
        <Select.Content className="z-50 overflow-hidden rounded-md border border-border bg-surface-raised shadow-xl">
          <Select.Viewport className="p-1">
            {repos.map((repo) => (
              <Select.Item
                key={repo.id}
                value={repo.id}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-sm text-text-secondary outline-none data-[highlighted]:bg-surface-overlay data-[highlighted]:text-text-primary"
              >
                <span className="flex items-center gap-2">
                  <Select.ItemIndicator>
                    <Check className="size-3 text-signal" />
                  </Select.ItemIndicator>
                  <Select.ItemText>{repo.name}</Select.ItemText>
                </span>
                <Badge variant={STATUS_VARIANT[repo.index_status]} dot>
                  {repo.index_status}
                </Badge>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
