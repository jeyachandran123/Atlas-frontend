"use client";

import { useState } from "react";
import { Search as SearchIcon, FileCode2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRepos } from "@/lib/hooks/use-repos";
import { useSearch } from "@/lib/hooks/use-search";
import { truncatePath } from "@/lib/utils/format";

export default function SearchPage() {
  const { data: repos = [] } = useRepos();
  const [query, setQuery] = useState("");
  const [repoId, setRepoId] = useState<string>("");

  const { data, isFetching } = useSearch(
    query.length > 2 && repoId ? { query, repo_id: repoId, top_k: 12 } : null,
  );

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-lg font-semibold text-text-primary">Search</h1>
        <p className="mt-1 text-sm text-text-tertiary">
          Search by meaning — find code by what it does, not just keyword matches.
        </p>

        <div className="mt-5 flex gap-2">
          <select
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
            className="h-9 shrink-0 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
          >
            <option value="">Select repository</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. how does JWT refresh work"
              className="pl-9"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {!repoId && (
            <p className="py-8 text-center text-sm text-text-tertiary">
              Select a repository to start searching.
            </p>
          )}

          {isFetching && <p className="text-xs text-text-tertiary">Searching…</p>}

          {data?.results.map((result, i) => (
            <div
              key={`${result.chunk.file_path}-${result.chunk.start_line}-${i}`}
              className="rounded-lg border border-border bg-surface p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-mono text-xs text-text-secondary">
                  <FileCode2 className="size-3.5 text-text-tertiary" />
                  {truncatePath(result.chunk.file_path, 3)}
                  <span className="text-text-tertiary">
                    :{result.chunk.start_line}-{result.chunk.end_line}
                  </span>
                </span>
                <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] text-text-tertiary">
                  {(result.score * 100).toFixed(0)}% match
                </span>
              </div>
              <pre className="mt-2.5 overflow-x-auto rounded-md bg-canvas p-2.5 text-xs text-text-secondary">
                <code className="font-mono">{result.chunk.content.slice(0, 400)}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
