"use client";

import { useState } from "react";
import * as Select from "@radix-ui/react-select";
import { Search as SearchIcon, FileCode2, ChevronDown, Check } from "lucide-react";
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="page-header">
        <div className="mx-auto max-w-3xl">
          <h1
            className="mb-4 text-[17px] font-semibold"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            Semantic Search
          </h1>

          {/* Search bar */}
          <div
            className="flex overflow-hidden rounded-xl"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {/* Repo selector */}
            <Select.Root value={repoId || undefined} onValueChange={setRepoId}>
              <Select.Trigger
                className="flex shrink-0 items-center gap-2 px-4 py-3 text-[13px] outline-none transition-colors"
                style={{
                  borderRight: "1px solid var(--border-subtle)",
                  minWidth: "148px",
                  color: "var(--text-secondary)",
                }}
              >
                <Select.Value placeholder="Select repo" />
                <ChevronDown className="ml-auto size-3" style={{ color: "var(--text-muted)" }} />
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  className="z-50 overflow-hidden rounded-xl animate-scale-up"
                  style={{
                    background: "var(--surface-overlay)",
                    backdropFilter: "blur(24px)",
                    border: "1px solid var(--border-strong)",
                    boxShadow: "var(--shadow-xl)",
                    minWidth: "180px",
                  }}
                >
                  <Select.Viewport className="p-1.5">
                    {repos.map((r) => (
                      <Select.Item
                        key={r.id}
                        value={r.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[13px] outline-none transition-colors data-[highlighted]:bg-[var(--surface-3)]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Select.ItemIndicator>
                          <Check className="size-3" style={{ color: "var(--accent-bright)" }} />
                        </Select.ItemIndicator>
                        <Select.ItemText>{r.name}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            {/* Query input */}
            <div className="relative flex flex-1 items-center">
              <SearchIcon className="absolute left-4 size-4" style={{ color: "var(--text-muted)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. how does JWT refresh work"
                className="h-full w-full bg-transparent py-3 pl-11 pr-4 text-[14px] focus:outline-none"
                style={{
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-sans)",
                  letterSpacing: "-0.01em",
                }}
              />
              {isFetching && (
                <div
                  className="absolute right-4 size-4 animate-spin rounded-full"
                  style={{
                    border: "2px solid var(--border-default)",
                    borderTopColor: "var(--accent)",
                  }}
                />
              )}
            </div>
          </div>

          {data && (
            <p className="mt-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
              {data.results.length} result{data.results.length !== 1 ? "s" : ""} for &ldquo;{data.query}&rdquo;
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-8 py-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {!repoId && (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div
                className="flex size-12 items-center justify-center rounded-xl"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)" }}
              >
                <SearchIcon className="size-5" style={{ color: "var(--text-muted)" }} />
              </div>
              <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                Select a repository to search
              </p>
            </div>
          )}

          {repoId && !isFetching && query.length > 2 && !data?.results.length && (
            <div className="py-16 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {data?.results.map((result, i) => {
            const score = Math.round(result.score * 100);
            const scoreColor =
              score >= 80 ? "var(--success)" : score >= 60 ? "var(--accent-bright)" : "var(--text-tertiary)";
            const scoreBg =
              score >= 80 ? "var(--success-bg)" : score >= 60 ? "var(--accent-subtle)" : "var(--surface-3)";
            const scoreBorder =
              score >= 80 ? "var(--success-border)" : score >= 60 ? "var(--accent-border)" : "var(--border-default)";

            return (
              <div
                key={`${result.chunk.file_path}-${result.chunk.start_line}-${i}`}
                className="overflow-hidden rounded-xl animate-fade-in-up"
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-default)",
                  boxShadow: "var(--shadow-sm)",
                  animationDelay: `${i * 35}ms`,
                }}
              >
                {/* File header */}
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{
                    background: "var(--surface-2)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div
                    className="flex items-center gap-2 font-mono text-[12px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <FileCode2 className="size-3.5 shrink-0" style={{ color: "var(--accent-bright)" }} />
                    <span className="truncate">{truncatePath(result.chunk.file_path, 4)}</span>
                    <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
                      :{result.chunk.start_line}–{result.chunk.end_line}
                    </span>
                  </div>
                  <div
                    className="status-badge shrink-0"
                    style={{ background: scoreBg, color: scoreColor, border: `1px solid ${scoreBorder}` }}
                  >
                    {score}% match
                  </div>
                </div>

                {/* Code */}
                <div style={{ background: "#0d0d14" }}>
                  <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed">
                    <code className="font-mono" style={{ color: "#c9d1d9" }}>
                      {result.chunk.content.slice(0, 600)}
                      {result.chunk.content.length > 600 && (
                        <span style={{ color: "#6e7681" }}>…</span>
                      )}
                    </code>
                  </pre>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
