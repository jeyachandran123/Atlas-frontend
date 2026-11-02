/** Customize → Plugins — mirrors the backend's /api/v1/plugins responses. */

export type PluginId = "github" | "gmail" | "drive";

export interface Plugin {
  id: PluginId;
  name: string;
  description: string;
  icon: string;
  /** "token": paste an access token. "oauth": sign in with Google. */
  auth: "token" | "oauth";
  examples: string[];
  setup_hint: string;
  connected: boolean;
  enabled: boolean;
  /** The connected account: a GitHub login or a Google email. */
  account: string;
  last_used_at: string | null;
  /** False when the server lacks what connecting needs (the Google OAuth client). */
  available: boolean;
  unavailable_reason: string;
}

export interface PluginTestResult {
  ok: boolean;
  error: string | null;
  title: string;
  lines: string[];
}
