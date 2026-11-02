/** Customize → Skills — mirrors the backend's /api/v1/skills responses. */

export type SkillScope = "system" | "org" | "personal";

export interface Skill {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  description: string;
  icon: string | null;
  version: string | null;
  scope: SkillScope;
  source: string;
  source_ref: string | null;
  triggers: string[];
  modes: string[];
  installed: boolean;
  enabled: boolean;
  pinned: boolean;
  editable: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface SkillDetail extends Skill {
  body: string;
  instructions: string;
  checksum: string;
  files: Array<{ path: string; size: number; content: string }>;
}

/** GET /skills groups what the user can see. */
export interface SkillList {
  installed: Skill[];
  system: Skill[];
  available: Skill[];
}

export interface SkillPreferences {
  auto_select: boolean;
  max_active: number;
  /** null = the server default applies. */
  max_active_override: number | null;
}

export interface SkillCreateRequest {
  name: string;
  display_name?: string;
  description: string;
  instructions: string;
  triggers?: string[];
  modes?: string[];
  scope?: "personal" | "org";
}
