"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FolderGit2, FileCode2, Layers, Clock, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSyncRepo, useRepo, useRepoJobs, useDeleteRepo } from "@/lib/hooks/use-repos";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatRelativeTime } from "@/lib/utils/format";
import { toast } from "sonner";
import type { IndexStatus } from "@/types/api";

const STATUS: Record<IndexStatus, { label: string; color: string; bg: string; border: string }> = {
  ready:    { label: "Ready",    color: "var(--success)",       bg: "var(--success-bg)",  border: "var(--success-border)"  },
  indexing: { label: "Indexing", color: "var(--warning)",       bg: "var(--warning-bg)",  border: "var(--warning-border)"  },
  pending:  { label: "Pending",  color: "var(--text-tertiary)", bg: "var(--surface-3)",   border: "var(--border-default)"  },
  error:    { label: "Error",    color: "var(--danger)",        bg: "var(--danger-bg)",   border: "var(--danger-border)"   },
  stale:    { label: "Stale — re-index needed", color: "var(--warning)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
};

const JOB_STATUS: Record<string, { color: string; bg: string; border: string }> = {
  completed: { color: "var(--success)", bg: "var(--success-bg)", border: "var(--success-border)" },
  running:   { color: "var(--warning)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
  queued:    { color: "var(--text-tertiary)", bg: "var(--surface-3)", border: "var(--border-default)" },
  failed:    { color: "var(--danger)",  bg: "var(--danger-bg)",  border: "var(--danger-border)"  },
  cancelled: { color: "var(--text-tertiary)", bg: "var(--surface-3)", border: "var(--border-default)" },
};

export default function RepoDetailPage() {
  const params = useParams<{ repoId: string }>();
  const router = useRouter();
  const { data: repo, isLoading } = useRepo(params.repoId);
  const { data: jobs = [] } = useRepoJobs(params.repoId);
  const syncRepo = useSyncRepo();
  const deleteRepo = useDeleteRepo();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (isLoading || !repo) {
    return (
      <div className="h-full overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {[72, 180, 140].map((h, i) => (
            <div
              key={i}
              className="animate-shimmer rounded-2xl"
              style={{ height: h, border: "1px solid var(--border-subtle)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  const s = STATUS[repo.index_status];
  const isIndexing = repo.index_status === "indexing";

  return (
    <div className="h-full overflow-y-auto">
      {/* Sticky header */}
      <div className="page-header">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/repos"
            className="link-quiet mb-3 flex w-fit items-center gap-1.5 text-[12px]"
          >
            <ArrowLeft className="size-3.5" />
            Repositories
          </Link>

          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
              >
                <FolderGit2 className="size-5" style={{ color: "var(--accent-glow)" }} />
              </div>
              <div className="min-w-0">
                <h1
                  className="truncate text-[18px] font-semibold tracking-tight"
                  style={{ color: "var(--text-primary)", letterSpacing: "-0.015em" }}
                >
                  {repo.name}
                </h1>
                <p className="truncate font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {repo.local_path}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div
                className="status-badge"
                style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{
                    background: s.color,
                    animation: isIndexing ? "pulse-glow 2s ease-in-out infinite" : "none",
                  }}
                />
                {s.label}
              </div>
              <button
                onClick={() => syncRepo.mutate(repo.id)}
                disabled={isIndexing || syncRepo.isPending}
                className="ghost-btn flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
              >
                <RefreshCw className={`size-3 ${isIndexing || syncRepo.isPending ? "animate-spin" : ""}`} />
                Re-index
              </button>
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={deleteRepo.isPending}
                className="ghost-btn flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
                style={{ color: "var(--danger)" }}
              >
                <Trash2 className="size-3" />
                Delete
              </button>
              <ConfirmDialog
                open={confirmDeleteOpen}
                onOpenChange={setConfirmDeleteOpen}
                title={`Delete “${repo.name}”?`}
                description="This removes the repository and all of its indexed vectors. This action cannot be undone."
                confirmLabel="Delete repository"
                pending={deleteRepo.isPending}
                onConfirm={() =>
                  deleteRepo.mutate(repo.id, {
                    onSuccess: () => {
                      setConfirmDeleteOpen(false);
                      toast.success(`${repo.name} deleted`);
                      router.push("/repos");
                    },
                    onError: () => {
                      setConfirmDeleteOpen(false);
                      toast.error("Failed to delete repository");
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={FileCode2} label="Files" value={repo.file_count.toLocaleString()} />
            <StatCard icon={Layers} label="Chunks" value={repo.chunk_count.toLocaleString()} />
            <StatCard
              icon={Clock}
              label="Last indexed"
              value={repo.last_indexed_at ? formatRelativeTime(repo.last_indexed_at) : "Never"}
            />
          </div>

          {/* Index jobs */}
          <div>
            <h2
              className="mb-3 text-[13px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Index jobs
            </h2>
            {jobs.length === 0 ? (
              <div
                className="flex items-center justify-center rounded-2xl py-12 text-[13px]"
                style={{
                  background: "var(--surface-1)",
                  border: "1px dashed var(--border-default)",
                  color: "var(--text-tertiary)",
                }}
              >
                No index jobs yet
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {jobs.map((job) => {
                  const js = JOB_STATUS[job.status] ?? JOB_STATUS.queued!;
                  const pct =
                    job.files_total > 0
                      ? Math.round((job.files_processed / job.files_total) * 100)
                      : 0;
                  return (
                    <div
                      key={job.id}
                      className="overflow-hidden rounded-xl"
                      style={{
                        background: "var(--surface-1)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{
                              background: js.color,
                              boxShadow: job.status === "running" ? `0 0 6px ${js.color}` : "none",
                            }}
                          />
                          <span
                            className="font-mono text-[12px] capitalize"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {job.job_type}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-4 text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <span>{job.files_processed}/{job.files_total} files</span>
                          <span>{formatRelativeTime(job.created_at)}</span>
                          <span
                            className="status-badge"
                            style={{ background: js.bg, color: js.color, border: `1px solid ${js.border}` }}
                          >
                            {job.status}
                          </span>
                        </div>
                      </div>
                      {(job.status === "running" || job.status === "queued") && job.files_total > 0 && (
                        <div className="h-0.5 w-full" style={{ background: "var(--surface-3)" }}>
                          <div
                            className="h-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: "linear-gradient(90deg, var(--accent), #a78bfa)",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value,
}: {
  icon: React.ElementType; label: string; value: string;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl p-4"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="flex size-8 items-center justify-center rounded-lg"
        style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
      >
        <Icon className="size-4" style={{ color: "var(--accent-glow)" }} />
      </div>
      <div>
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{label}</p>
        <p
          className="mt-0.5 text-[20px] font-semibold tracking-tight"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
