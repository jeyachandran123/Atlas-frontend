"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/api/workspace";

export function useWorkspaces() {
  return useQuery({ queryKey: ["workspaces"], queryFn: () => workspaceApi.list() });
}

export function useWorkspaceDashboard(workspaceId: string | null) {
  return useQuery({
    queryKey: ["workspace-dashboard", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => workspaceApi.dashboard(workspaceId!),
  });
}

export function useWorkspaceDocuments(workspaceId: string | null) {
  return useQuery({
    queryKey: ["workspace-documents", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => workspaceApi.documents(workspaceId!),
    refetchInterval: (q) => {
      const docs = q.state.data ?? [];
      const active = docs.some((d) =>
        ["queued", "processing", "retrying"].includes(d.processing_status));
      return active ? 3000 : false;
    },
  });
}

export function useWorkspaceConversations(workspaceId: string | null) {
  return useQuery({
    queryKey: ["workspace-conversations", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => workspaceApi.conversations(workspaceId!),
  });
}

export function useWorkspaceArtifacts(workspaceId: string | null) {
  return useQuery({
    queryKey: ["workspace-artifacts", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => workspaceApi.artifacts(workspaceId!),
  });
}

export function useWorkspaceTimeline(workspaceId: string | null) {
  return useQuery({
    queryKey: ["workspace-timeline", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => workspaceApi.timeline(workspaceId!),
  });
}

export function useWorkspaceBookmarks(workspaceId: string | null) {
  return useQuery({
    queryKey: ["workspace-bookmarks", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => workspaceApi.bookmarks(workspaceId!),
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; description?: string; icon?: string }) =>
      workspaceApi.create(v.name, v.description, v.icon),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useStartConversation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) => workspaceApi.startConversation(workspaceId, title),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["workspace-conversations", workspaceId] }),
  });
}

export function useRenameConversation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { conversationId: string; title: string }) =>
      workspaceApi.renameConversation(workspaceId, v.conversationId, v.title),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["workspace-conversations", workspaceId] }),
  });
}

export function useDeleteConversation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      workspaceApi.deleteConversation(workspaceId, conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-conversations", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace-dashboard", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspace-timeline", workspaceId] });
    },
  });
}
