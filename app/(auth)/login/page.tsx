"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useLogin, useFirebaseLogin } from "@/lib/hooks/use-auth";
import { signInWithGoogle } from "@/lib/firebase";
import { ApiError } from "@/types/api";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const login = useLogin();
  const firebaseLogin = useFirebaseLogin();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const result = await signInWithGoogle();
      const token = await result.user.getIdToken(true);
      firebaseLogin.mutate(
        { firebase_token: token },
        {
          onError: (e) => {
            setGoogleError(e instanceof Error ? e.message : "Google sign-in failed.");
            setGoogleLoading(false);
          },
        }
      );
    } catch (e: unknown) {
      setGoogleError(e instanceof Error ? e.message : "Google sign-in failed.");
      setGoogleLoading(false);
    }
  }

  const emailError =
    login.error instanceof ApiError
      ? login.error.status === 401
        ? "Incorrect email or password."
        : login.error.message
      : null;
  const firebaseError =
    firebaseLogin.error instanceof ApiError ? firebaseLogin.error.message : googleError;

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

      {/* Google button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading || firebaseLogin.isPending}
        className="ghost-raise group relative flex w-full items-center gap-3 overflow-hidden rounded-[10px] px-4 py-2.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        {googleLoading || firebaseLogin.isPending ? (
          <Loader2 className="size-4 animate-spin" style={{ color: "var(--accent-bright)" }} />
        ) : (
          <svg className="size-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        <span>Continue with Google</span>
        <svg
          className="ml-auto size-3.5 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-40"
          viewBox="0 0 16 16" fill="none"
          style={{ color: "var(--text-tertiary)" }}
        >
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

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
          <input
            type="password"
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
