"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import {
  useRegister, useLogin, useFirebaseLogin, useVerifySignup, useResendSignupCode,
} from "@/lib/hooks/use-auth";
import { signInWithGoogle } from "@/lib/firebase";
import { OtpInput } from "@/components/auth/otp-input";
import { ApiError } from "@/types/api";

const schema = z.object({
  full_name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(128, "Use at most 128 characters"),
});
type FormValues = z.infer<typeof schema>;

type Step =
  | { kind: "form" }
  | { kind: "code"; email: string; password: string; expiresIn: number; resendAfter: number };

/**
 * Sign-up: name, email, password. When email is set up on the server, a
 * 6-digit code confirms the address before the account exists; otherwise the
 * account is made at once. Either way the new user is signed straight in.
 * The server decides the organisation and the role.
 */
export default function RegisterPage() {
  const registerMutation = useRegister();
  const login = useLogin();
  const firebaseLogin = useFirebaseLogin();
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Values survive the trip to the code step and back: react-hook-form keeps
  // them while the inputs are unmounted.
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const cred = await signInWithGoogle();
      const token = await cred.user.getIdToken();
      firebaseLogin.mutate({ firebase_token: token });
    } catch (e: unknown) {
      setGoogleError(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  }

  function onSubmit(values: FormValues) {
    registerMutation.mutate(values, {
      onSuccess: (res) => {
        if ("verification" in res) {
          setStep({
            kind: "code", email: res.email, password: values.password,
            expiresIn: res.expires_in, resendAfter: res.resend_after,
          });
          return;
        }
        toast.success("Account created — signing you in…");
        login.mutate({ email: values.email, password: values.password });
      },
    });
  }

  if (step.kind === "code") {
    return (
      <CodeStep
        email={step.email}
        password={step.password}
        expiresIn={step.expiresIn}
        resendAfter={step.resendAfter}
        onBack={() => {
          registerMutation.reset();
          setStep({ kind: "form" });
        }}
      />
    );
  }

  const registerError =
    registerMutation.error instanceof ApiError ? registerMutation.error.message
    : registerMutation.error ? "Could not create the account. Please try again."
    : null;
  const loginError = login.error ? "Your account was created, but signing in failed. Try signing in." : null;
  const firebaseError = firebaseLogin.error instanceof ApiError ? firebaseLogin.error.message : googleError;
  const busy = registerMutation.isPending || login.isPending;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}>
          Create account
        </h2>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Set up your UnityWorks workspace
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
      </button>

      {firebaseError && <ErrorMessage message={firebaseError} />}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
        <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>or sign up with email</span>
        <div className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field label="Full name" error={errors.full_name?.message}>
          <input type="text" autoComplete="name" placeholder="Jane Smith" {...register("full_name")} className="auth-input" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} className="auth-input" />
        </Field>
        <Field label="Password" error={errors.password?.message} hint="At least 8 characters">
          <input type="password" autoComplete="new-password" placeholder="••••••••" {...register("password")} className="auth-input" />
        </Field>

        {registerError && <ErrorMessage message={registerError} />}
        {loginError && <ErrorMessage message={loginError} />}

        <button
          type="submit"
          disabled={busy}
          className="signal-btn mt-0.5 flex h-9 w-full items-center justify-center gap-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {login.isPending ? "Signing you in…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        Already have an account?{" "}
        <Link href="/login" className="link-accent font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}

// ── Step 2: the emailed code ──────────────────────────────────────────────

function CodeStep({
  email, password, expiresIn, resendAfter, onBack,
}: {
  email: string;
  password: string;
  expiresIn: number;
  resendAfter: number;
  onBack: () => void;
}) {
  const verify = useVerifySignup();
  const resend = useResendSignupCode();
  const login = useLogin();
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(resendAfter);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function submit(value: string) {
    if (value.length !== 6 || verify.isPending || login.isPending) return;
    verify.mutate(
      { email, code: value },
      {
        onSuccess: () => {
          toast.success("Email verified — welcome to UnityWorks");
          login.mutate({ email, password });
        },
        onError: () => setCode(""),
      },
    );
  }

  function onCode(value: string) {
    setCode(value);
    if (verify.error) verify.reset();
    if (value.length === 6) submit(value);
  }

  function onResend() {
    resend.mutate(email, {
      onSuccess: (r) => {
        setCooldown(r.resend_after);
        setCode("");
        verify.reset();
        toast.success("A new code is on its way");
      },
      onError: (e) => {
        const wait = e instanceof ApiError && e.status === 429 ? 30 : 0;
        if (wait) setCooldown(wait);
      },
    });
  }

  const verifyError = verify.error instanceof ApiError ? verify.error.message : verify.error ? "Could not check the code." : null;
  const resendError = resend.error instanceof ApiError ? resend.error.message : resend.error ? "Could not send a new code." : null;
  const loginError = login.error ? "Your account was created, but signing in failed. Try signing in." : null;
  const busy = verify.isPending || login.isPending;
  const minutes = Math.max(1, Math.round(expiresIn / 60));

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
        style={{ color: "var(--text-tertiary)" }}
      >
        <ArrowLeft className="size-3.5" /> Use a different email
      </button>

      <div className="flex items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
        >
          <MailCheck className="size-[18px]" style={{ color: "var(--accent-bright)" }} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}>
            Check your email
          </h2>
          <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            We sent a 6-digit code to{" "}
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>{email}</span>.
            It expires in {minutes} minutes.
          </p>
        </div>
      </div>

      <OtpInput value={code} onChange={onCode} autoFocus invalid={!!verifyError} disabled={busy} />

      {verifyError && <ErrorMessage message={verifyError} />}
      {loginError && <ErrorMessage message={loginError} />}

      <button
        type="button"
        onClick={() => submit(code)}
        disabled={code.length !== 6 || busy}
        className="signal-btn flex h-9 w-full items-center justify-center gap-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {login.isPending ? "Signing you in…" : "Verify and create account"}
      </button>

      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
          Didn&apos;t get it? Check your spam folder, or{" "}
          {cooldown > 0 ? (
            <span style={{ color: "var(--text-muted)" }}>resend in {cooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={resend.isPending}
              className="link-accent font-medium disabled:opacity-60"
            >
              {resend.isPending ? "sending…" : "resend the code"}
            </button>
          )}
        </p>
        {resendError && <p className="text-[11px]" style={{ color: "var(--danger)" }}>{resendError}</p>}
      </div>
    </div>
  );
}

function Field({
  label, error, hint, children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
      {error ? (
        <p className="text-[11px]" style={{ color: "var(--danger)" }}>{error}</p>
      ) : hint ? (
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{hint}</p>
      ) : null}
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[12px]"
      style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "var(--danger)" }}
    >
      <span className="mt-0.5 size-1.5 shrink-0 rounded-full" style={{ background: "var(--danger)" }} />
      {message}
    </div>
  );
}
