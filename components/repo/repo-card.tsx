"use client";

import Link from "next/link";
import { RefreshCw, FolderGit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSyncRepo, useRepoJobs } from "@/lib/hooks/use-repos";
import { useIndexJobProgress } from "@/lib/hooks/use-repos";
import { formatRelativeTime } from "@/lib/utils/format";
import type { IndexStatus, RepoOut } from "@/types/api";

const STATUS_VARIANT: Record<IndexStatus, "ready" | "indexing" | "error" | "pending"> = {
  ready: "ready",
  indexing: "indexing",
  pending: "pending",
  error: "error",
  stale: "indexing",
};

export function RepoCard({ repo }: { repo: RepoOut }) {
  const syncRepo = useSyncRepo();
  const { data: jobs = [] } = useRepoJobs(repo.id);
  const activeJob = jobs.find((j) => j.status === "running" || j.status === "queued");
  const { data: progress } = useIndexJobProgress(activeJob?.id ?? null);

  const isIndexing = repo.index_status === "indexing" || !!activeJob;
  const pct =
    progress && progress.files_total > 0
      ? Math.round((progress.files_processed / progress.files_total) * 100)
      : 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/repos/${repo.id}`} className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-canvas">
            <FolderGit2 className="size-4 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">{repo.name}</p>
            <p className="truncate text-xs text-text-tertiary font-mono">{repo.local_path}</p>
          </div>
        </Link>
        <Badge variant={STATUS_VARIANT[repo.index_status]} dot>
          {isIndexing ? "indexing" : repo.index_status}
        </Badge>
      </div>

      {isIndexing && progress && (
        <div className="mt-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-overlay">
            <div
              className="h-full bg-signal transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-text-tertiary">
            {progress.files_processed} / {progress.files_total} files · {progress.chunks_created} chunks
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-text-tertiary">
        <span>
          {repo.file_count} files · {repo.chunk_count} chunks
        </span>
        <span>
          {repo.last_indexed_at ? `Indexed ${formatRelativeTime(repo.last_indexed_at)}` : "Never indexed"}
        </span>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncRepo.mutate(repo.id)}
          disabled={isIndexing || syncRepo.isPending}
        >
          <RefreshCw className={`size-3.5 ${isIndexing ? "animate-spin" : ""}`} />
          Re-index
        </Button>
      </div>
    </div>
  );
}
