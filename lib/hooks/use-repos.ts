import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reposApi, indexingApi } from "@/lib/api/repos";
import type { ConnectRepoRequest } from "@/types/api";

export const repoKeys = {
  all: ["repos"] as const,
  detail: (id: string) => ["repos", id] as const,
  jobs: (repoId: string) => ["repos", repoId, "jobs"] as const,
  jobProgress: (jobId: string) => ["jobs", jobId, "progress"] as const,
};

export function useRepos() {
  return useQuery({
    queryKey: repoKeys.all,
    queryFn: reposApi.list,
    staleTime: 5000,
    refetchInterval: (query) => {
      const repos = query.state.data ?? [];
      const hasIndexing = repos.some((r) => r.index_status === "indexing");
      return hasIndexing ? 4000 : false;
    },
  });
}

export function useRepo(repoId: string | null) {
  return useQuery({
    queryKey: repoKeys.detail(repoId ?? ""),
    queryFn: () => reposApi.get(repoId as string),
    enabled: !!repoId,
    staleTime: 5000,
    refetchInterval: (query) => {
      const status = query.state.data?.index_status;
      return status === "indexing" ? 4000 : false;
    },
  });
}

export function useConnectRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ConnectRepoRequest) => reposApi.connect(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: repoKeys.all }),
  });
}

export function useSyncRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repoId: string) => reposApi.sync(repoId),
    onSuccess: (_, repoId) => {
      queryClient.invalidateQueries({ queryKey: repoKeys.jobs(repoId) });
      queryClient.invalidateQueries({ queryKey: repoKeys.detail(repoId) });
    },
  });
}

export function useDeleteRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repoId: string) => reposApi.delete(repoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: repoKeys.all }),
  });
}

/**
 * Polls job progress every 2s while the job is active, stops automatically
 * once it reaches a terminal status. This is the entire implementation of
 * FE-REPO-02 (live indexing progress) — no manual setInterval/clearInterval
 * bookkeeping needed.
 */
export function useIndexJobProgress(jobId: string | null) {
  return useQuery({
    queryKey: repoKeys.jobProgress(jobId ?? ""),
    queryFn: () => indexingApi.getJobProgress(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const isTerminal = status === "completed" || status === "failed" || status === "cancelled";
      return isTerminal ? false : 2000;
    },
  });
}

export function useRepoJobs(repoId: string | null) {
  const queryClient = useQueryClient();
  const didInvalidate = useRef(false);

  const query = useQuery({
    queryKey: repoKeys.jobs(repoId ?? ""),
    queryFn: () => indexingApi.listRepoJobs(repoId as string),
    enabled: !!repoId,
    staleTime: 5000,
    refetchInterval: (q) => {
      const jobs = q.state.data ?? [];
      const hasActive = jobs.some((j) => j.status === "running" || j.status === "queued");
      return hasActive ? 4000 : false;
    },
  });

  const jobs = query.data ?? [];
  const hasActive = jobs.some((j) => j.status === "running" || j.status === "queued");
  const hasCompleted = jobs.some((j) => j.status === "completed");

  useEffect(() => {
    if (!hasActive && hasCompleted && !didInvalidate.current) {
      didInvalidate.current = true;
      queryClient.invalidateQueries({ queryKey: repoKeys.all });
    }
    if (hasActive) {
      didInvalidate.current = false;
    }
  }, [hasActive, hasCompleted, queryClient]);

  return query;
}
