import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { skillsApi } from "@/lib/api/skills";
import type { SkillCreateRequest, SkillList } from "@/types/skills";

export const skillKeys = {
  all: ["skills"] as const,
  list: (q: string) => ["skills", "list", q] as const,
  detail: (id: string) => ["skills", "detail", id] as const,
  preferences: ["skills", "preferences"] as const,
};

export function useSkills(q = "") {
  return useQuery({
    queryKey: skillKeys.list(q),
    queryFn: () => skillsApi.list(q || undefined),
    // Typing in search keeps the last results on screen instead of a skeleton.
    placeholderData: keepPreviousData,
  });
}

export function useSkill(id: string | null) {
  return useQuery({
    queryKey: skillKeys.detail(id ?? ""),
    queryFn: () => skillsApi.get(id!),
    enabled: !!id,
  });
}

export function useSkillPreferences() {
  return useQuery({ queryKey: skillKeys.preferences, queryFn: skillsApi.preferences });
}

export function useSaveSkillPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: skillsApi.savePreferences,
    onSuccess: (prefs) => queryClient.setQueryData(skillKeys.preferences, prefs),
  });
}

/**
 * The switch flips at once and rolls back if the server refuses, so a row
 * never sits half-toggled while the request is in flight.
 */
export function useToggleSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => skillsApi.setEnabled(id, enabled),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ["skills", "list"] });
      const previous = queryClient.getQueriesData<SkillList>({ queryKey: ["skills", "list"] });
      queryClient.setQueriesData<SkillList>({ queryKey: ["skills", "list"] }, (old) => {
        if (!old) return old;
        const flip = (s: SkillList["system"][number]) => (s.id === id ? { ...s, enabled } : s);
        return { installed: old.installed.map(flip), system: old.system.map(flip), available: old.available.map(flip) };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    // Enabling an available skill also installs it, which moves it between groups.
    onSettled: () => queryClient.invalidateQueries({ queryKey: skillKeys.all }),
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => skillsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: skillKeys.all }),
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SkillCreateRequest) => skillsApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: skillKeys.all }),
  });
}

export function useUploadSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => skillsApi.upload(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: skillKeys.all }),
  });
}

export function useInstallSkillFromUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => skillsApi.installFromUrl(url),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: skillKeys.all }),
  });
}
