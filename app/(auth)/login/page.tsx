"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(values: FormValues) {
    login.mutate(values);
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setGoogleError(null);
    
    try {
      // Step 1: Sign in with Google via Firebase
      const userCredential = await signInWithGoogle();
      
      // Step 2: Get Firebase ID token
      const idToken = await userCredential.user.getIdToken();
      
      // Step 3: Send token to backend
      firebaseLogin.mutate({ firebase_token: idToken });
    } catch (error: unknown) {
      console.error("Google sign-in error:", error);
      
      if (error instanceof Error) {
        setGoogleError(error.message);
      } else {
        setGoogleError("Failed to sign in with Google. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  const emailErrorMessage =
    login.error instanceof ApiError
      ? login.error.status === 401
        ? "Incorrect email or password."
        : login.error.message
      : null;

  const firebaseErrorMessage =
    firebaseLogin.error instanceof ApiError
      ? firebaseLogin.error.message
      : googleError;

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h1 className="text-base font-semibold text-text-primary">Sign in</h1>
      <p className="mt-1 text-sm text-text-tertiary">Access your Atlas workspace.</p>

      {/* Google Sign-In */}
      <div className="mt-5">
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || firebaseLogin.isPending}
          className="w-full"
        >
          {(googleLoading || firebaseLogin.isPending) ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <svg className="mr-2 size-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Continue with Google
        </Button>
        
        {firebaseErrorMessage && (
          <p className="mt-2 rounded-md border border-remove/20 bg-remove-bg px-3 py-2 text-xs text-remove">
            {firebaseErrorMessage}
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="my-5 flex items-center">
        <div className="flex-1 border-t border-border"></div>
        <span className="px-4 text-xs text-text-tertiary">or</span>
        <div className="flex-1 border-t border-border"></div>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-xs text-remove">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
          {errors.password && <p className="text-xs text-remove">{errors.password.message}</p>}
        </div>

        {emailErrorMessage && (
          <p className="rounded-md border border-remove/20 bg-remove-bg px-3 py-2 text-xs text-remove">
            {emailErrorMessage}
          </p>
        )}

        <Button type="submit" variant="signal" disabled={login.isPending} className="mt-1">
          {login.isPending && <Loader2 className="size-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <p className="mt-5 text-center text-xs text-text-tertiary">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-signal hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
