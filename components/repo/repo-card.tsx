"use client";

import Link from "next/link";
import { RefreshCw, FolderGit2, Clock, FileCode2, Layers, ExternalLink } from "lucide-react";
import { useSyncRepo, useRepoJobs, useIndexJobProgress } from "@/lib/hooks/use-repos";
import { formatRelativeTime } from "@/lib/utils/format";
import type { IndexStatus, RepoOut } from "@/types/api";

const STATUS: Record<IndexStatus, { label: string; color: string; bg: string; border: string }> = {
  ready:    { label: "Ready",    color: "var(--success)",  bg: "var(--success-bg)",  border: "var(--success-border)"  },
  indexing: { label: "Indexing", color: "var(--warning)",  bg: "var(--warning-bg)",  border: "var(--warning-border)"  },
  pending:  { label: "Pending",  color: "var(--text-tertiary)", bg: "var(--surface-3)", border: "var(--border-default)" },
  error:    { label: "Error",    color: "var(--danger)",   bg: "var(--danger-bg)",   border: "var(--danger-border)"   },
  stale:    { label: "Stale",    color: "var(--warning)",  bg: "var(--warning-bg)",  border: "var(--warning-border)"  },
};

export function RepoCard({ repo }: { repo: RepoOut }) {
  const syncRepo = useSyncRepo();
  const { data: jobs = [] } = useRepoJobs(repo.id);
  const activeJob = jobs.find((j) => j.status === "running" || j.status === "queued");
  const { data: progress } = useIndexJobProgress(activeJob?.id ?? null);
  const isIndexing = repo.index_status === "indexing" || !!activeJob;

  // Live counts: use progress data during indexing, fall back to repo stats
  const filesProcessed = progress?.files_processed ?? 0;
  const filesTotal = progress?.files_total ?? 0;
  const pct = filesTotal > 0 ? Math.round((filesProcessed / filesTotal) * 100) : 0;

  const displayFileCount = isIndexing && filesTotal > 0 ? filesProcessed : repo.file_count;
  const displayChunkCount = isIndexing && progress?.chunks_indexed != null ? progress.chunks_indexed : repo.chunk_count;

  const s = STATUS[repo.index_status];

  return (
    <div className="card group relative flex flex-col overflow-hidden">
      {/* Top accent line — visible on hover */}
      <div
        className="card-accent-line absolute inset-x-0 top-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
        }}
      />

      <div className="flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <Link href={`/repos/${repo.id}`} className="flex min-w-0 items-center gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: "var(--accent-subtle)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <FolderGit2 className="size-5" style={{ color: "var(--accent-glow)" }} />
            </div>
            <div className="min-w-0">
              <p
                className="truncate text-[14px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {repo.name}
              </p>
              <p
                className="mt-0.5 truncate font-mono text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                {repo.local_path}
              </p>
            </div>
          </Link>

          {/* Status badge */}
          <div
            className="status-badge shrink-0"
            style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{
                background: s.color,
                animation: isIndexing ? "pulse-glow 2s ease-in-out infinite" : "none",
              }}
            />
            {isIndexing ? "Indexing" : s.label}
          </div>
        </div>

        {/* Progress bar — always visible while indexing */}
        {isIndexing && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[11px]" style={{ color: "var(--text-muted)" }}>
              <span>
                {filesTotal > 0 ? `${filesProcessed} / ${filesTotal} files` : "Starting…"}
              </span>
              <span>{filesTotal > 0 ? `${pct}%` : ""}</span>
            </div>
            <div
              className="h-1 w-full overflow-hidden rounded-full"
              style={{ background: "var(--surface-3)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: filesTotal > 0 ? `${pct}%` : "30%",
                  background: "linear-gradient(90deg, var(--accent), #7c3aed)",
                  boxShadow: "0 0 8px rgba(99,102,241,0.35)",
                  animation: filesTotal === 0 ? "indeterminate 1.5s ease-in-out infinite" : "none",
                }}
              />
            </div>
          </div>
        )}

        {/* Stale warning */}
        {repo.index_status === "stale" && !isIndexing && (
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2 text-[12px]"
            style={{
              background: "var(--warning-bg)",
              border: "1px solid var(--warning-border)",
              color: "var(--warning)",
            }}
          >
            <span>Files changed — index is out of date</span>
            <button
              onClick={() => syncRepo.mutate(repo.id)}
              className="font-semibold underline underline-offset-2"
            >
              Re-index now
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          <span className="flex items-center gap-1.5">
            <FileCode2 className="size-3.5" />
            {displayFileCount.toLocaleString()} files
          </span>
          <span className="flex items-center gap-1.5">
            <Layers className="size-3.5" />
            {displayChunkCount.toLocaleString()} chunks
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {repo.last_indexed_at ? formatRelativeTime(repo.last_indexed_at) : "Never"}
          </span>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between border-t pt-3"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <Link
            href={`/repos/${repo.id}`}
            className="flex items-center gap-1.5 text-[12px] transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent-glow)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-tertiary)"; }}
          >
            <ExternalLink className="size-3" />
            View details
          </Link>
          <button
            onClick={() => syncRepo.mutate(repo.id)}
            disabled={isIndexing || syncRepo.isPending}
            className="ghost-btn flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
          >
            <RefreshCw className={`size-3 ${isIndexing ? "animate-spin" : ""}`} />
            Re-index
          </button>
        </div>
      </div>
    </div>
  );
}
