"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRegister, useFirebaseLogin } from "@/lib/hooks/use-auth";
import { signInWithGoogle } from "@/lib/firebase";
import { ApiError } from "@/types/api";

const schema = z.object({
  full_name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
  org_id: z.string().min(1, "Organization ID is required"),
});
type FormValues = z.infer<typeof schema>;

const FIELDS = [
  { id: "full_name", label: "Full name",      type: "text",     placeholder: "Jane Smith",       autoComplete: "name" },
  { id: "email",     label: "Email",           type: "email",    placeholder: "you@company.com",  autoComplete: "email" },
  { id: "password",  label: "Password",        type: "password", placeholder: "Min. 8 characters", autoComplete: "new-password" },
  { id: "org_id",    label: "Organization ID", type: "text",     placeholder: "org_xxxx",          autoComplete: "off" },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const registerMutation = useRegister();
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
      const cred = await signInWithGoogle();
      const token = await cred.user.getIdToken();
      firebaseLogin.mutate({ firebase_token: token });
    } catch (e: unknown) {
      setGoogleError(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  }

  const emailError =
    registerMutation.error instanceof ApiError
      ? registerMutation.error.status === 409
        ? "Email already exists."
        : registerMutation.error.message
      : null;
  const firebaseError =
    firebaseLogin.error instanceof ApiError ? firebaseLogin.error.message : googleError;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-[17px] font-semibold"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
          >
            Create account
          </h2>
          <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            Set up your Atlas workspace
          </p>
        </div>
      </div>

      {/* Google button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading || firebaseLogin.isPending}
        className="group flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
          color: "var(--text-primary)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
        }}
      >
        {googleLoading || firebaseLogin.isPending ? (
          <Loader2 className="size-3.5 animate-spin" style={{ color: "var(--accent-bright)" }} />
        ) : (
          <svg className="size-3.5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        <span>Continue with Google</span>
      </button>

      {firebaseError && <ErrorMsg message={firebaseError} />}

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>or with email</span>
        <div className="h-px flex-1" style={{ background: "var(--border-subtle)" }} />
      </div>

      {/* Form — 2-column grid for fields */}
      <form
        onSubmit={handleSubmit((v) =>
          registerMutation.mutate({ ...v, role: "developer" }, {
            onSuccess: () => { toast.success("Account created!"); router.push("/login"); },
          })
        )}
        className="flex flex-col gap-2"
      >
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map(({ id, label, type, placeholder, autoComplete }) => (
            <div key={id} className="flex flex-col gap-0.5">
              <label className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                {label}
              </label>
              <input
                type={type}
                autoComplete={autoComplete}
                placeholder={placeholder}
                {...register(id as keyof FormValues)}
                className="auth-input"
              />
              {errors[id as keyof FormValues] && (
                <p className="text-[10px]" style={{ color: "var(--danger)" }}>
                  {errors[id as keyof FormValues]?.message}
                </p>
              )}
            </div>
          ))}
        </div>

        {emailError && <ErrorMsg message={emailError} />}

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="signal-btn flex h-8 w-full items-center justify-center gap-2 text-[12px] font-semibold text-white disabled:cursor-not-allowed"
        >
          {registerMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
          Create account
        </button>
      </form>

      <p className="text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium transition-colors"
          style={{ color: "var(--accent-glow)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent-bright)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent-glow)"; }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

function ErrorMsg({ message }: { message: string }) {
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
