"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useLogin, useFirebaseLogin } from "@/lib/hooks/use-auth";
import { signInWithGoogle, signInWithMicrosoft } from "@/lib/firebase";
import { OAuthButtons, type OAuthProviderId } from "@/components/auth/provider-buttons";
import { PasswordInput } from "@/components/auth/password-input";
import { ApiError } from "@/types/api";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const login = useLogin();
  const firebaseLogin = useFirebaseLogin();
  // Which provider's popup is open, and what it said if it failed.
  const [oauthBusy, setOauthBusy] = useState<OAuthProviderId | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  /** Google and Microsoft take the same path: their popup, then our token exchange. */
  async function signInWith(provider: OAuthProviderId) {
    const name = provider === "google" ? "Google" : "Microsoft";
    setOauthBusy(provider);
    setOauthError(null);
    try {
      const result = provider === "google" ? await signInWithGoogle() : await signInWithMicrosoft();
      const token = await result.user.getIdToken(true);
      firebaseLogin.mutate(
        { firebase_token: token },
        {
          onError: (e) => {
            setOauthError(e instanceof Error ? e.message : `${name} sign-in failed.`);
            setOauthBusy(null);
          },
        }
      );
    } catch (e: unknown) {
      setOauthError(e instanceof Error ? e.message : `${name} sign-in failed.`);
      setOauthBusy(null);
    }
  }

  const emailError =
    login.error instanceof ApiError
      ? login.error.status === 401
        ? "Incorrect email or password."
        : login.error.message
      : null;
  const firebaseError =
    firebaseLogin.error instanceof ApiError ? firebaseLogin.error.message : oauthError;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2
          className="text-[18px] font-semibold"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
        >
          Welcome back
        </h2>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Sign in to your workspace
        </p>
      </div>

      {/* Sign in with Google or Microsoft */}
      <OAuthButtons busy={oauthBusy} disabled={firebaseLogin.isPending} onPick={signInWith} />

      {firebaseError && <ErrorMessage message={firebaseError} />}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>or continue with email</span>
        <div className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit((v) => login.mutate(v))} className="flex flex-col gap-3">
        <Field label="Email" error={errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register("email")}
            className="auth-input"
          />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <PasswordInput
            autoComplete="current-password"
            placeholder="••••••••"
            {...register("password")}
            className="auth-input"
          />
        </Field>

        {emailError && <ErrorMessage message={emailError} />}

        <button
          type="submit"
          disabled={login.isPending}
          className="signal-btn mt-0.5 flex h-9 w-full items-center justify-center gap-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed"
        >
          {login.isPending && <Loader2 className="size-4 animate-spin" />}
          Sign in
        </button>
      </form>

      <p className="text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        No account?{" "}
        <Link href="/register" className="link-accent font-medium">
          Create one free
        </Link>
      </p>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      {children}
      {error && <p className="text-[11px]" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[12px]"
      style={{
        background: "var(--danger-bg)",
        border: "1px solid var(--danger-border)",
        color: "var(--danger)",
      }}
    >
      <span className="mt-0.5 size-1.5 shrink-0 rounded-full" style={{ background: "var(--danger)" }} />
      {message}
    </div>
  );
}
