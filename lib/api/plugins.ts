import { api } from "@/lib/api/client";
import type { Plugin, PluginId, PluginTestResult } from "@/types/plugins";

export const pluginsApi = {
  list: () => api.get<{ plugins: Plugin[] }>("/plugins").then((r) => r.plugins),

  connectGithub: (token: string) => api.post<Plugin>("/plugins/github/connect", { token }),

  /** The Google consent URL. Sent as JSON because the request needs the bearer token. */
  oauthStart: (id: PluginId) => api.get<{ url: string }>(`/plugins/${id}/oauth/start`),

  setEnabled: (id: PluginId, enabled: boolean) =>
    api.post<Plugin>(`/plugins/${id}/${enabled ? "enable" : "disable"}`),

  test: (id: PluginId) => api.post<PluginTestResult>(`/plugins/${id}/test`),

  disconnect: (id: PluginId) => api.delete<void>(`/plugins/${id}`),
};
