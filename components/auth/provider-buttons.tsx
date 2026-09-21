"use client";

import { Loader2 } from "lucide-react";

export type OAuthProviderId = "google" | "microsoft";

export function GoogleMark() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export function MicrosoftMark() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 23 23" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}

const PROVIDERS: Array<{ id: OAuthProviderId; label: string; Mark: () => React.ReactElement }> = [
  { id: "google", label: "Continue with Google", Mark: GoogleMark },
  { id: "microsoft", label: "Continue with Microsoft", Mark: MicrosoftMark },
];

/**
 * The sign-in buttons shared by the sign-in and sign-up pages, so the two
 * pages cannot drift apart. `busy` is the provider whose popup is open.
 */
export function OAuthButtons({
  busy, disabled, onPick,
}: {
  busy: OAuthProviderId | null;
  disabled?: boolean;
  onPick: (provider: OAuthProviderId) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {PROVIDERS.map(({ id, label, Mark }) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          disabled={disabled || busy !== null}
          className="ghost-raise group relative flex w-full items-center gap-3 overflow-hidden rounded-[10px] px-4 py-2.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === id
            ? <Loader2 className="size-4 animate-spin" style={{ color: "var(--accent-bright)" }} />
            : <Mark />}
          <span>{label}</span>
          <svg
            className="ml-auto size-3.5 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-40"
            viewBox="0 0 16 16" fill="none"
            style={{ color: "var(--text-tertiary)" }}
            aria-hidden
          >
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      ))}
    </div>
  );
}
