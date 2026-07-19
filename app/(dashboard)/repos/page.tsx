"use client";

import { FolderGit2, GitBranch } from "lucide-react";
import { ConnectRepoDialog } from "@/components/repo/connect-repo-dialog";
import { RepoCard } from "@/components/repo/repo-card";
import { useRepos } from "@/lib/hooks/use-repos";

export default function ReposPage() {
  const { data: repos = [], isLoading } = useRepos();

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1
              className="text-[17px] font-semibold"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
            >
              Repositories
            </h1>
            <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              Connect and index your codebases for AI-powered search and answers.
            </p>
          </div>
          <ConnectRepoDialog />
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="mx-auto max-w-5xl">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-48 animate-shimmer rounded-xl"
                  style={{ border: "1px solid var(--border-subtle)" }}
                />
              ))}
            </div>
          ) : repos.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {repos.map((repo) => <RepoCard key={repo.id} repo={repo} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center gap-6 rounded-2xl py-24 text-center"
      style={{
        background: "var(--surface-1)",
        border: "1px dashed var(--border-default)",
      }}
    >
      <div
        className="flex size-16 items-center justify-center rounded-2xl"
        style={{
          background: "var(--accent-subtle)",
          border: "1px solid var(--accent-border)",
        }}
      >
        <FolderGit2 className="size-7" style={{ color: "var(--accent-bright)" }} />
      </div>
      <div>
        <p className="text-[16px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          No repositories yet
        </p>
        <p className="mt-1.5 max-w-xs text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Connect your first repository to start asking UnityWorks about your code.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {["Local paths", "GitHub", "GitLab", "Bitbucket"].map((s) => (
          <span
            key={s}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px]"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-default)",
              color: "var(--text-tertiary)",
            }}
          >
            <GitBranch className="size-3" style={{ color: "var(--accent)" }} />
            {s}
          </span>
        ))}
      </div>
      <ConnectRepoDialog />
    </div>
  );
}
