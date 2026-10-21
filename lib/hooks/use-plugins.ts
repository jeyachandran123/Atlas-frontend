import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pluginsApi } from "@/lib/api/plugins";
import type { Plugin, PluginId } from "@/types/plugins";

export const pluginKeys = { all: ["plugins"] as const };

export function usePlugins() {
  return useQuery({ queryKey: pluginKeys.all, queryFn: pluginsApi.list, retry: false });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: pluginKeys.all });
}

export function useConnectGithub() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: pluginsApi.connectGithub, onSuccess: refresh });
}

export function useStartGoogleSignIn() {
  return useMutation({ mutationFn: (id: PluginId) => pluginsApi.oauthStart(id) });
}

/** Flips at once and rolls back if the server refuses, like the skills switch. */
export function useTogglePlugin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: PluginId; enabled: boolean }) => pluginsApi.setEnabled(id, enabled),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: pluginKeys.all });
      const previous = queryClient.getQueryData<Plugin[]>(pluginKeys.all);
      queryClient.setQueryData<Plugin[]>(pluginKeys.all, (old) =>
        old?.map((p) => (p.id === id ? { ...p, enabled } : p)),
      );
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(pluginKeys.all, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: pluginKeys.all }),
  });
}

export function useTestPlugin() {
  return useMutation({ mutationFn: (id: PluginId) => pluginsApi.test(id) });
}

export function useDisconnectPlugin() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: PluginId) => pluginsApi.disconnect(id), onSuccess: refresh });
}
