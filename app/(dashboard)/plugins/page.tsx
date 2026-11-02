"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlugZap } from "lucide-react";
import { toast } from "sonner";
import { GithubTokenDialog } from "@/components/plugins/github-token-dialog";
import { PluginCard } from "@/components/plugins/plugin-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { KeyRowsSkeleton } from "@/components/ui/skeleton";
import {
  useDisconnectPlugin, usePlugins, useStartGoogleSignIn, useTestPlugin, useTogglePlugin,
} from "@/lib/hooks/use-plugins";
import { ApiError } from "@/types/api";
import type { Plugin, PluginId, PluginTestResult } from "@/types/plugins";

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message) || fallback;

/** Customize → Plugins: connect your own accounts so Atlas can answer from them. */
export default function PluginsPage() {
  return (
    <Suspense fallback={null}>
      <PluginsContent />
    </Suspense>
  );
}

function PluginsContent() {
  const { data: plugins, isLoading, error } = usePlugins();
  const toggle = useTogglePlugin();
  const test = useTestPlugin();
  const disconnect = useDisconnectPlugin();
  const google = useStartGoogleSignIn();
  const [githubOpen, setGithubOpen] = useState(false);
  const [removing, setRemoving] = useState<Plugin | null>(null);
  const [results, setResults] = useState<Partial<Record<PluginId, PluginTestResult>>>({});
  const [pending, setPending] = useState<PluginId | null>(null);

  // Google sends the browser back here with ?connected=gmail or ?error=…
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const connected = params.get("connected");
    const failed = params.get("error");
    if (!connected && !failed) return;
    if (connected) toast.success(`${connected === "drive" ? "Google Drive" : "Gmail"} connected`);
    if (failed) toast.error(failed);
    router.replace(pathname);
  }, [params, router, pathname]);

  // 404 = ENABLE_PLUGINS is off on the server.
  if (error instanceof ApiError && error.status === 404) {
    return (
      <Shell>
        <Empty text="Plugins are turned off on this server. Set ENABLE_PLUGINS=true in the backend's .env and restart it." />
      </Shell>
    );
  }

  function connect(plugin: Plugin) {
    if (plugin.auth === "token") return setGithubOpen(true);
    setPending(plugin.id);
    google.mutate(plugin.id, {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (e) => {
        setPending(null);
        toast.error(message(e, "Couldn't start Google sign-in"));
      },
    });
  }

  function runTest(plugin: Plugin) {
    test.mutate(plugin.id, {
      onSuccess: (r) => setResults((prev) => ({ ...prev, [plugin.id]: r })),
      onError: (e) => toast.error(message(e, "The test failed")),
    });
  }

  function confirmDisconnect() {
    if (!removing) return;
    disconnect.mutate(removing.id, {
      onSuccess: () => {
        toast.success(`${removing.name} disconnected`);
        setResults((prev) => ({ ...prev, [removing.id]: undefined }));
        setRemoving(null);
      },
      onError: (e) => toast.error(message(e, "Couldn't disconnect")),
    });
  }

  return (
    <Shell>
      {isLoading ? (
        <KeyRowsSkeleton />
      ) : !plugins || plugins.length === 0 ? (
        <Empty text="No plugins are available." />
      ) : (
        <div className="flex flex-col gap-3">
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              connecting={pending === plugin.id}
              testing={test.isPending && test.variables === plugin.id}
              testResult={results[plugin.id]}
              onConnect={() => connect(plugin)}
              onToggle={(enabled) =>
                toggle.mutate(
                  { id: plugin.id, enabled },
                  { onError: (e) => toast.error(message(e, "Couldn't change the plugin")) },
                )
              }
              onTest={() => runTest(plugin)}
              onDisconnect={() => setRemoving(plugin)}
            />
          ))}
        </div>
      )}

      <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Plugins only read. When you ask about your own data (&ldquo;my open pull requests&rdquo;,
        &ldquo;unread emails&rdquo;), Atlas fetches it and the model answers from it. Nothing is
        changed in your accounts, and credentials are stored encrypted. You can also type
        {" "}<code className="font-mono">/github</code>, <code className="font-mono">/gmail</code> or
        {" "}<code className="font-mono">/drive</code> to ask directly.
      </p>

      <GithubTokenDialog open={githubOpen} onOpenChange={setGithubOpen} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Disconnect ${removing?.name ?? "plugin"}?`}
        description="Atlas forgets the stored credential and stops reading this account. You can connect again any time."
        confirmLabel="Disconnect"
        pending={disconnect.isPending}
        onConfirm={confirmDisconnect}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="page-header">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-[17px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Plugins
          </h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Connect your own accounts so Atlas can answer questions about them.
          </p>
        </div>
      </div>
      <div className="px-4 py-5 sm:px-8 sm:py-6">
        <div className="mx-auto max-w-2xl space-y-5">{children}</div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl py-10 text-center"
      style={{ background: "var(--surface-1)", border: "1px dashed var(--border-default)" }}
    >
      <div
        className="flex size-10 items-center justify-center rounded-xl"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)" }}
      >
        <PlugZap className="size-4" style={{ color: "var(--text-muted)" }} />
      </div>
      <p className="max-w-sm px-4 text-[13px]" style={{ color: "var(--text-tertiary)" }}>{text}</p>
    </div>
  );
}
