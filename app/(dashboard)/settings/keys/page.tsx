"use client";

import { useState } from "react";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/lib/hooks/use-auth";
import { formatRelativeTime } from "@/lib/utils/format";

export default function ApiKeysPage() {
  const { data: keys = [] } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCreate() {
    if (!newKeyName.trim()) return;
    createKey.mutate(
      { name: newKeyName.trim() },
      {
        onSuccess: (res) => {
          setRevealedKey(res.key);
          setNewKeyName("");
        },
      },
    );
  }

  function handleCopy() {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-lg font-semibold text-text-primary">API keys</h1>
        <p className="mt-1 text-sm text-text-tertiary">
          Used by the CLI and IDE extensions to authenticate without your password.
        </p>

        {revealedKey && (
          <div className="mt-5 rounded-lg border border-signal/30 bg-signal/5 p-4">
            <p className="text-xs font-medium text-signal-glow">
              Copy this key now — it won&apos;t be shown again.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-canvas px-2.5 py-1.5 font-mono text-xs text-text-primary">
                {revealedKey}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="size-3.5 text-add" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name, e.g. 'VS Code extension'"
          />
          <Button variant="signal" onClick={handleCreate} disabled={createKey.isPending}>
            <Plus className="size-4" />
            Create
          </Button>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {keys.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-tertiary">No API keys yet.</p>
          ) : (
            keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-md border border-border bg-surface px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <Key className="size-3.5 text-text-tertiary" />
                  <div>
                    <p className="text-sm text-text-primary">{key.name}</p>
                    <p className="text-[11px] text-text-tertiary">
                      {key.last_used_at
                        ? `Last used ${formatRelativeTime(key.last_used_at)}`
                        : "Never used"}{" "}
                      · Created {formatRelativeTime(key.created_at)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    revokeKey.mutate(key.id, { onSuccess: () => toast.success("Key revoked") })
                  }
                >
                  <Trash2 className="size-3.5 text-remove" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
