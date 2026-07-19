"use client";

import { useState } from "react";
import { Key, Plus, Trash2, Copy, Check, User, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useLogout } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatRelativeTime } from "@/lib/utils/format";

export default function ApiKeysPage() {
  const user = useAuthStore((s) => s.user);
  const { data: keys = [] } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const logout = useLogout();
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCreate() {
    if (!newKeyName.trim()) return;
    createKey.mutate(
      { name: newKeyName.trim() },
      { onSuccess: (res) => { setRevealedKey(res.key); setNewKeyName(""); } },
    );
  }

  function handleCopy() {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-header">
        <div className="mx-auto max-w-2xl">
          <h1
            className="text-[17px] font-semibold"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            API Keys
          </h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Authenticate the CLI and IDE extensions without your password.
          </p>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="mx-auto max-w-2xl space-y-4">

          {/* User card */}
          {user && (
            <div
              className="flex items-center gap-3 rounded-xl p-4"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border-default)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
              >
                <User className="size-4" style={{ color: "var(--accent-bright)" }} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                  {user.full_name || user.email}
                </p>
                <p className="truncate text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {user.email}
                </p>
              </div>
              <span
                className="status-badge ml-auto shrink-0 capitalize"
                style={{
                  background: "var(--accent-subtle)",
                  border: "1px solid var(--accent-border)",
                  color: "var(--accent-glow)",
                }}
              >
                {user.role}
              </span>
              <button
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="ghost-btn flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
                style={{ color: "var(--danger)" }}
                title="Sign out"
              >
                <LogOut className="size-3.5" />
                {logout.isPending ? "Signing out…" : "Sign out"}
              </button>
            </div>
          )}

          {/* Revealed key */}
          {revealedKey && (
            <div
              className="overflow-hidden rounded-xl animate-fade-up"
              style={{
                background: "var(--accent-subtle)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <div
                className="px-4 py-3"
                style={{ borderBottom: "1px solid var(--accent-border)" }}
              >
                <p className="text-[12px] font-medium" style={{ color: "var(--accent-glow)" }}>
                  ⚠ Copy this key now — it won&apos;t be shown again.
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-3">
                <code
                  className="flex-1 truncate rounded-lg px-3 py-2 font-mono text-[12px]"
                  style={{
                    background: "var(--canvas)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  {revealedKey}
                </code>
                <button
                  onClick={handleCopy}
                  className="ghost-btn flex shrink-0 items-center gap-1.5 px-3 py-2 text-[12px] font-medium"
                >
                  {copied
                    ? <><Check className="size-3.5" style={{ color: "var(--success)" }} /> Copied</>
                    : <><Copy className="size-3.5" /> Copy</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* Create key */}
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <p className="mb-3 text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
              Create new key
            </p>
            <div className="flex gap-2">
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. VS Code extension"
                className="dialog-input flex-1"
              />
              <button
                onClick={handleCreate}
                disabled={createKey.isPending || !newKeyName.trim()}
                className="signal-btn flex shrink-0 items-center gap-1.5 px-4 py-2 text-[13px] font-semibold"
              >
                <Plus className="size-3.5" />
                Create
              </button>
            </div>
          </div>

          {/* Keys list */}
          <div>
            <p
              className="mb-3 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
            >
              Active keys ({keys.length})
            </p>
            {keys.length === 0 ? (
              <div
                className="flex flex-col items-center gap-3 rounded-xl py-12 text-center"
                style={{
                  background: "var(--surface-1)",
                  border: "1px dashed var(--border-default)",
                }}
              >
                <div
                  className="flex size-10 items-center justify-center rounded-xl"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)" }}
                >
                  <Key className="size-4" style={{ color: "var(--text-muted)" }} />
                </div>
                <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                  No API keys yet
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: "var(--surface-1)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)" }}
                      >
                        <Key className="size-3.5" style={{ color: "var(--text-tertiary)" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                          {key.name}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {key.last_used_at
                            ? `Last used ${formatRelativeTime(key.last_used_at)}`
                            : "Never used"
                          }{" · "}Created {formatRelativeTime(key.created_at)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => revokeKey.mutate(key.id, { onSuccess: () => toast.success("Key revoked") })}
                      aria-label={`Revoke key ${key.name}`}
                      className="icon-btn danger size-7 shrink-0"
                      title="Revoke key"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
