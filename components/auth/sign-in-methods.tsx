"use client";

import { useState } from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser, useSetPassword } from "@/lib/hooks/use-auth";
import { ApiError } from "@/types/api";
import { CardSkeleton } from "@/components/ui/skeleton";

/**
 * How this account can sign in — Google, a password, or both — and the one
 * place a password can be added to an existing account. Being signed in is
 * the proof of ownership here; the sign-up form, which cannot verify an
 * email address, is never allowed to put a password on an account.
 */
export function SignInMethods() {
  const { data: user } = useCurrentUser();
  const setPassword = useSetPassword();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  if (!user) return <CardSkeleton lines={3} />;

  const hasPassword = !!user.has_password;
  const google = user.auth_provider === "google";
  const microsoft = user.auth_provider === "microsoft";
  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && next !== confirm;
  const valid = next.length >= 8 && next === confirm && (!hasPassword || current.length > 0);

  function reset() {
    setOpen(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    setPassword.reset();
  }

  function save() {
    if (!valid || setPassword.isPending) return;
    setPassword.mutate(
      { current_password: hasPassword ? current : undefined, new_password: next },
      {
        onSuccess: () => {
          toast.success(hasPassword ? "Password changed" : "Password added — you can now sign in with your email too");
          reset();
        },
      },
    );
  }

  const error =
    setPassword.error instanceof ApiError ? setPassword.error.message
    : setPassword.error ? "Could not save the password."
    : null;

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="px-4 pb-2 pt-3.5">
        <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Sign-in methods</p>
        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
          The ways you can sign in to this account.
        </p>
      </div>

      {/* Google */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Google</p>
          <p className="truncate text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
            {google ? `Continue with Google as ${user.email}` : "Use “Continue with Google” with this email to connect it."}
          </p>
        </div>
        {google && <StatusPill label="Connected" />}
      </div>

      {/* Microsoft */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
          <svg className="size-4" viewBox="0 0 23 23" aria-hidden>
            <path fill="#F25022" d="M1 1h10v10H1z" />
            <path fill="#7FBA00" d="M12 1h10v10H12z" />
            <path fill="#00A4EF" d="M1 12h10v10H1z" />
            <path fill="#FFB900" d="M12 12h10v10H12z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Microsoft</p>
          <p className="truncate text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
            {microsoft
              ? `Continue with Microsoft as ${user.email}`
              : "Use “Continue with Microsoft” with this email to connect it."}
          </p>
        </div>
        {microsoft && <StatusPill label="Connected" />}
      </div>

      {/* Password */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
            <KeyRound className="size-4" style={{ color: "var(--accent-bright)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Email and password</p>
            <p className="truncate text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
              {hasPassword
                ? `Sign in with ${user.email} and your password`
                : "Not set — add one to sign in with your email and password as well"}
            </p>
          </div>
          {hasPassword && !open && <StatusPill label="Set" />}
          {!open && (
            <button onClick={() => setOpen(true)} className="ghost-btn shrink-0 px-3 py-1.5 text-[12px] font-medium">
              {hasPassword ? "Change" : "Add password"}
            </button>
          )}
        </div>

        {open && (
          <form
            className="mt-3 flex flex-col gap-2.5 animate-fade-in"
            onSubmit={(e) => { e.preventDefault(); save(); }}
          >
            {/* Lets password managers file the new password under the right account. */}
            <input type="email" autoComplete="username" value={user.email} readOnly hidden />
            {hasPassword && (
              <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
            )}
            <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" autoFocus={!hasPassword}
              note={tooShort ? "Use at least 8 characters" : undefined} />
            <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password"
              note={mismatch ? "The passwords don't match" : undefined} />
            {error && (
              <p className="text-[12px]" style={{ color: "var(--danger)" }}>{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={reset} className="ghost-btn px-3 py-1.5 text-[12px] font-medium">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!valid || setPassword.isPending}
                className="signal-btn flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {setPassword.isPending && <Loader2 className="size-3.5 animate-spin" />}
                {hasPassword ? "Change password" : "Add password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
      style={{ background: "var(--accent-subtle)", color: "var(--accent-bright)", border: "1px solid var(--accent-border)" }}
    >
      <Check className="size-3" /> {label}
    </span>
  );
}

function PasswordField({
  label, value, onChange, autoComplete, autoFocus, note,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
  note?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="auth-input"
      />
      {note && <span className="text-[11px]" style={{ color: "var(--danger)" }}>{note}</span>}
    </label>
  );
}
