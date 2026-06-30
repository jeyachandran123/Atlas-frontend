import { api } from "@/lib/api/client";
import type {
  GitBlameResponse,
  GitBranchesResponse,
  GitDiffResponse,
  GitLogResponse,
  GitShowResponse,
  GitStatusResponse,
} from "@/types/api";

export const gitApi = {
  status: (repoId: string) => api.get<GitStatusResponse>(`/git/${repoId}/status`),

  diff: (repoId: string, path?: string) =>
    api.get<GitDiffResponse>(`/git/${repoId}/diff${path ? `?path=${encodeURIComponent(path)}` : ""}`),

  log: (repoId: string, n = 20) => api.get<GitLogResponse>(`/git/${repoId}/log?n=${n}`),

  branches: (repoId: string) => api.get<GitBranchesResponse>(`/git/${repoId}/branches`),

  show: (repoId: string, sha: string) => api.get<GitShowResponse>(`/git/${repoId}/show?sha=${sha}`),

  blame: (repoId: string, path: string) =>
    api.get<GitBlameResponse>(`/git/${repoId}/blame?path=${encodeURIComponent(path)}`),
};
