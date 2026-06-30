"use client";

import { useParams } from "next/navigation";
import { ArrowLeft, FolderGit2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useRepo, useRepoJobs } from "@/lib/hooks/use-repos";
import { formatRelativeTime } from "@/lib/utils/format";
import type { IndexStatus } from "@/types/api";

const STATUS_VARIANT: Record<IndexStatus, "ready" | "indexing" | "error" | "pending"> = {
  ready: "ready",
  indexing: "indexing",
  pending: "pending",
  error: "error",
  stale: "indexing",
};

export default function RepoDetailPage() {
  const params = useParams<{ repoId: string }>();
  const { data: repo, isLoading } = useRepo(params.repoId);
  const { data: jobs = [] } = useRepoJobs(params.repoId);

  if (isLoading || !repo) {
    return <div className="h-full animate-pulse bg-canvas" />;
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/repos" className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary">
          <ArrowLeft className="size-3.5" />
          Repositories
        </Link>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md border border-border bg-surface">
            <FolderGit2 className="size-5 text-text-secondary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">{repo.name}</h1>
            <p className="font-mono text-xs text-text-tertiary">{repo.local_path}</p>
          </div>
          <Badge variant={STATUS_VARIANT[repo.index_status]} dot className="ml-auto">
            {repo.index_status}
          </Badge>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Files" value={repo.file_count} />
          <Stat label="Chunks" value={repo.chunk_count} />
          <Stat
            label="Last indexed"
            value={repo.last_indexed_at ? formatRelativeTime(repo.last_indexed_at) : "Never"}
          />
        </div>

        <h2 className="mt-8 text-sm font-medium text-text-primary">Index jobs</h2>
        <div className="mt-2 flex flex-col gap-1.5">
          {jobs.length === 0 ? (
            <p className="text-xs text-text-tertiary">No index jobs yet.</p>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-xs"
              >
                <span className="font-mono text-text-secondary">{job.job_type}</span>
                <span className="text-text-tertiary">
                  {job.files_processed}/{job.files_total} files
                </span>
                <span className="text-text-tertiary">{formatRelativeTime(job.created_at)}</span>
                <Badge variant={job.status === "completed" ? "ready" : job.status === "failed" ? "error" : "indexing"}>
                  {job.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3.5 py-3">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className="mt-1 text-base font-semibold text-text-primary">{value}</p>
    </div>
  );
}
