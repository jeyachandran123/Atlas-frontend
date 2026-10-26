"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DialogShell, Field } from "@/components/skills/dialog-shell";
import { useConnectGithub } from "@/lib/hooks/use-plugins";

/** GitHub connects with a token the user creates, so nothing needs registering with us. */
export function GithubTokenDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const connect = useConnectGithub();
  const [token, setToken] = useState("");
  const ready = token.trim().length >= 20;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    connect.mutate(token.trim(), {
      onSuccess: (p) => {
        toast.success(`GitHub connected as ${p.account}`);
        setToken("");
        onOpenChange(false);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't connect GitHub"),
    });
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Connect GitHub"
      description="Atlas reads your repositories, pull requests and issues. It never changes anything."
      width={480}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          <li>
            Open{" "}
            <a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noreferrer"
              className="link-accent inline-flex items-center gap-1"
            >
              GitHub token settings <ExternalLink className="size-3" />
            </a>
            .
          </li>
          <li>
            Under <b>Repository access</b> choose <b>All repositories</b>. The default, public
            repositories only, hides your private ones.
          </li>
          <li>
            Give it <b>read-only</b> access (Pull requests, Issues and Metadata: Read).
          </li>
          <li>Create it, copy the token, and paste it below.</li>
        </ol>
        <Field label="Access token" hint="Stored encrypted. You can disconnect and delete it at any time.">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_…"
            autoComplete="off"
            spellCheck={false}
            className="dialog-input font-mono"
            autoFocus
          />
        </Field>
        <button
          type="submit"
          disabled={connect.isPending || !ready}
          className="signal-btn mt-1 flex h-10 w-full items-center justify-center gap-2 text-[13.5px] font-semibold"
        >
          {connect.isPending && <Loader2 className="size-4 animate-spin" />}
          Connect GitHub
        </button>
      </form>
    </DialogShell>
  );
}
