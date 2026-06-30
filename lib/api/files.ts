import { api } from "@/lib/api/client";
import type {
  FileContentResponse,
  FileSearchResponse,
  FileTreeNode,
  WriteFileRequest,
  WriteFileResponse,
} from "@/types/api";

export const filesApi = {
  getTree: (repoId: string, path?: string) =>
    api.get<FileTreeNode>(`/files/${repoId}/tree${path ? `?path=${encodeURIComponent(path)}` : ""}`),

  readFile: (repoId: string, path: string) =>
    api.get<FileContentResponse>(`/files/${repoId}/content?path=${encodeURIComponent(path)}`),

  writeFile: (repoId: string, data: WriteFileRequest) =>
    api.post<WriteFileResponse>(`/files/${repoId}/content`, data),

  deleteFile: (repoId: string, path: string) =>
    api.delete<void>(`/files/${repoId}/content?path=${encodeURIComponent(path)}`),

  searchFiles: (repoId: string, query: string) =>
    api.post<FileSearchResponse>(`/files/${repoId}/search`, { query }),
};
