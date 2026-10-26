import { api, API_BASE } from "@/lib/api/client";
import { getAccessToken } from "@/lib/api/token-store";
import { ApiError } from "@/types/api";
import type {
  Skill, SkillCreateRequest, SkillDetail, SkillList, SkillPreferences,
} from "@/types/skills";

export const skillsApi = {
  list: (q?: string) =>
    api.get<SkillList>(q ? `/skills?q=${encodeURIComponent(q)}` : "/skills"),

  get: (id: string) => api.get<SkillDetail>(`/skills/${id}`),

  create: (body: SkillCreateRequest) => api.post<SkillDetail>("/skills", body),

  installFromUrl: (url: string) =>
    api.post<SkillDetail>("/skills/install-from-url", { url, scope: "personal" }),

  /** A single SKILL.md, or a .zip package with SKILL.md at its root. */
  upload: async (file: File): Promise<SkillDetail> => {
    const token = getAccessToken();
    const form = new FormData();
    form.append("file", file);
    form.append("scope", "personal");
    const res = await fetch(`${API_BASE}/skills/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(errorText(body.detail) ?? `Upload failed (${res.status})`, res.status);
    }
    return res.json();
  },

  setEnabled: (id: string, enabled: boolean) =>
    api.post<Skill>(`/skills/${id}/${enabled ? "enable" : "disable"}`),

  remove: (id: string) =>
    api.delete<{ id: string; status: "deleted" | "uninstalled" }>(`/skills/${id}`),

  preferences: () => api.get<SkillPreferences>("/skills/preferences"),

  savePreferences: (body: { auto_select: boolean; max_active: number | null }) =>
    api.put<SkillPreferences>("/skills/preferences", body),
};

/** FastAPI sends a string for handled errors and a list for validation ones. */
export function errorText(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string } | undefined;
    return first?.msg;
  }
  return undefined;
}
