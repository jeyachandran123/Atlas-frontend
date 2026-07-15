import { api } from "@/lib/api/client";
import type { ConnectRepoRequest, IndexJobOut, RepoOut } from "@/types/api";

export const reposApi = {
  list: () => api.get<RepoOut[]>("/repositories"),

  get: (repoId: string) => api.get<RepoOut>(`/repositories/${repoId}`),

  connect: (data: ConnectRepoRequest) => api.post<RepoOut>("/repositories", data),

  sync: (repoId: string) => api.post<IndexJobOut>(`/repositories/${repoId}/sync`),

  delete: (repoId: string) => api.delete<void>(`/repositories/${repoId}`),
};

export const indexingApi = {
  getJob: (jobId: string) => api.get<IndexJobOut>(`/indexing/jobs/${jobId}`),

  getJobProgress: (jobId: string) =>
    api.get<{ files_total: number; files_processed: number; chunks_created: number; status: string }>(
      `/indexing/jobs/${jobId}/progress`,
    ),

  listRepoJobs: (repoId: string) => api.get<IndexJobOut[]>(`/indexing/repos/${repoId}/jobs`),
};
