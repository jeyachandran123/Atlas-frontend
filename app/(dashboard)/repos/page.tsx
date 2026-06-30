"use client";

import { FolderGit2 } from "lucide-react";
import { ConnectRepoDialog } from "@/components/repo/connect-repo-dialog";
import { RepoCard } from "@/components/repo/repo-card";
import { useRepos } from "@/lib/hooks/use-repos";

export default function ReposPage() {
  const { data: repos = [], isLoading } = useRepos();

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Repositories</h1>
            <p className="mt-1 text-sm text-text-tertiary">
              Connect a repository to make it searchable and answerable by Atlas.
            </p>
          </div>
          <ConnectRepoDialog />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isLoading ? (
            <SkeletonCards />
          ) : repos.length === 0 ? (
            <EmptyState />
          ) : (
            repos.map((repo) => <RepoCard key={repo.id} repo={repo} />)
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <>
      {[1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-surface" />
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <div className="col-span-2 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
      <FolderGit2 className="size-8 text-text-tertiary" />
      <div>
        <p className="text-sm font-medium text-text-primary">No repositories connected</p>
        <p className="mt-1 text-xs text-text-tertiary">
          Connect your first repository to start asking Atlas about your code.
        </p>
      </div>
    </div>
  );
}
