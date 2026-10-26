"use client";

import { useState } from "react";
import { Github, HardDrive, Loader2, Lock, Mail, PlugZap, type LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { formatRelativeTime } from "@/lib/utils/format";
import type { Plugin, PluginTestResult } from "@/types/plugins";

const ICONS: Record<string, LucideIcon> = { github: Github, mail: Mail, "hard-drive": HardDrive };

export function PluginIcon({ icon, className = "size-5" }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? PlugZap;
  return <Icon className={className} />;
}

export function PluginCard({
  plugin,
  connecting,
  testing,
  testResult,
  onConnect,
  onToggle,
  onTest,
  onDisconnect,
}: {
  plugin: Plugin;
  connecting: boolean;
  testing: boolean;
  testResult?: PluginTestResult;
  onConnect: () => void;
  onToggle: (enabled: boolean) => void;
  onTest: () => void;
  onDisconnect: () => void;
}) {
  const [showExamples, setShowExamples] = useState(false);

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: plugin.connected && plugin.enabled ? "var(--accent-subtle)" : "var(--surface-2)",
            border: `1px solid ${plugin.connected && plugin.enabled ? "var(--accent-border)" : "var(--border-default)"}`,
            color: plugin.connected && plugin.enabled ? "var(--accent-bright)" : "var(--text-tertiary)",
          }}
        >
          <PluginIcon icon={plugin.icon} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {plugin.name}
            </p>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px]"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)", color: "var(--text-tertiary)" }}
            >
              <Lock className="size-2.5" /> Read-only
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
            {plugin.description}
          </p>
          {plugin.connected && (
            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
              Connected{plugin.account ? ` as ${plugin.account}` : ""}
              {plugin.last_used_at ? ` · last used ${formatRelativeTime(plugin.last_used_at)}` : " · not used yet"}
            </p>
          )}
        </div>

        {plugin.connected && (
          <Switch
            checked={plugin.enabled}
            onCheckedChange={onToggle}
            label={plugin.enabled ? `Pause ${plugin.name}` : `Resume ${plugin.name}`}
          />
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!plugin.connected ? (
          <button
            onClick={onConnect}
            disabled={connecting || !plugin.available}
            className="signal-btn flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold"
          >
            {connecting && <Loader2 className="size-3.5 animate-spin" />}
            {plugin.auth === "oauth" ? "Sign in with Google" : "Connect"}
          </button>
        ) : (
          <>
            <button
              onClick={onTest}
              disabled={testing}
              className="ghost-btn flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
            >
              {testing && <Loader2 className="size-3.5 animate-spin" />}
              Test
            </button>
            <button onClick={onDisconnect} className="ghost-btn px-3 py-1.5 text-[12px] font-medium" style={{ color: "var(--danger)" }}>
              Disconnect
            </button>
          </>
        )}
        <button
          onClick={() => setShowExamples((v) => !v)}
          className="ml-auto text-[11.5px] underline-offset-2 hover:underline"
          style={{ color: "var(--text-muted)" }}
          aria-expanded={showExamples}
        >
          {showExamples ? "Hide examples" : "What can I ask?"}
        </button>
      </div>

      {!plugin.available && (
        <p className="mt-2 text-[11.5px]" style={{ color: "var(--warning)" }}>
          {plugin.unavailable_reason}
        </p>
      )}

      {showExamples && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {plugin.examples.map((example) => (
            <li
              key={example}
              className="rounded-lg px-3 py-1.5 text-[12px]"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
            >
              {example}
            </li>
          ))}
        </ul>
      )}

      {testResult && (
        <div
          className="mt-3 rounded-lg p-3 text-[12px]"
          style={{
            background: "var(--canvas)",
            border: `1px solid ${testResult.ok ? "var(--border-default)" : "var(--danger-border)"}`,
            color: testResult.ok ? "var(--text-secondary)" : "var(--danger)",
          }}
        >
          {testResult.ok ? (
            <>
              <p className="mb-1 font-medium" style={{ color: "var(--success)" }}>
                Working — {testResult.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {testResult.lines.map((line, i) => (
                  <li key={i} className="truncate">{line}</li>
                ))}
              </ul>
            </>
          ) : (
            testResult.error
          )}
        </div>
      )}
    </div>
  );
}
