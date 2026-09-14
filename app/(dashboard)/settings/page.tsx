"use client";

import { useState } from "react";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { LogoutDialog } from "@/components/auth/logout-dialog";
import { SignInMethods } from "@/components/auth/sign-in-methods";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useTheme } from "@/app/providers";
import { CardSkeleton } from "@/components/ui/skeleton";

const THEMES = [
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "light", label: "Light", Icon: Sun },
  { id: "system", label: "System", Icon: Monitor },
] as const;

const CARD_STYLE: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  boxShadow: "var(--shadow-sm)",
};

/** Settings — the account, how it signs in, and how the app looks. API keys have their own page. */
export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const name = user?.full_name?.trim() || user?.email?.split("@")[0] || "Account";
  const initials = name.split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "U";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-header">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-[17px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Settings
          </h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Your account, how you sign in, and how UnityWorks looks.
          </p>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Account */}
          {!user ? (
            <CardSkeleton avatar lines={3} />
          ) : (
            <div className="rounded-xl p-4" style={CARD_STYLE}>
              <div className="flex items-center gap-3.5">
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
                  style={{ background: "var(--accent-gradient)" }}
                  aria-hidden
                >
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{name}</p>
                    <span
                      className="status-badge shrink-0 capitalize"
                      style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)", color: "var(--accent-glow)" }}
                    >
                      {user.role}
                    </span>
                  </div>
                  <p className="truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>{user.email}</p>
                  {memberSince && (
                    <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>Member since {memberSince}</p>
                  )}
                </div>
                <button
                  onClick={() => setConfirmLogout(true)}
                  className="ghost-btn flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
                  style={{ color: "var(--danger)" }}
                >
                  <LogOut className="size-3.5" /> Sign out
                </button>
              </div>
            </div>
          )}

          {/* Sign-in methods */}
          <SignInMethods />

          {/* Appearance */}
          <div className="rounded-xl p-4" style={CARD_STYLE}>
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Appearance</p>
            <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
              System follows your computer&apos;s light or dark setting.
            </p>
            <div role="radiogroup" aria-label="Theme" className="mt-3 grid grid-cols-3 gap-2">
              {THEMES.map(({ id, label, Icon }) => {
                const active = theme === id;
                return (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(id)}
                    className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px] font-medium transition-colors"
                    style={active
                      ? { background: "var(--accent-subtle)", border: "1px solid var(--accent-border)", color: "var(--accent-bright)" }
                      : { background: "var(--surface-2)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
                  >
                    <Icon className="size-4" /> {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <LogoutDialog open={confirmLogout} onOpenChange={setConfirmLogout} />
    </div>
  );
}
