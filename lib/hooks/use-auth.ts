import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { setAccessToken, clearSession, setCurrentUserId } from "@/lib/api/token-store";
import { scheduleProactiveRefresh } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { LoginRequest, RegisterRequest, FirebaseLoginRequest } from "@/types/api";

export const authKeys = {
  me: ["auth", "me"] as const,
  apiKeys: ["auth", "keys"] as const,
};

/**
 * Fetches the current user. This is the single source of truth for
 * "who am I" — the Zustand auth store mirrors this query's data for
 * synchronous reads, but never fetches independently.
 * 
 * Configured with long staleTime to prevent unnecessary refetches and
 * keep the user logged in across refreshes.
 */
export function useCurrentUser() {
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);

  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      const user = await authApi.me();
      setUser(user);
      setCurrentUserId(user.id);
      setHydrated(true);
      return user;
    },
    retry: false,
    staleTime: 10 * 60 * 1000, // 10 minutes - user info rarely changes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: async (res) => {
      setAccessToken(res.access_token);
      setCurrentUserId(res.user.id);
      setUser(res.user);
      scheduleProactiveRefresh();

      // Persist the refresh token via the BFF route handler — never in JS-readable storage
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: res.refresh_token }),
      });

      queryClient.setQueryData(authKeys.me, res.user);
      router.push("/chat");
    },
  });
}

export function useFirebaseLogin() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (data: FirebaseLoginRequest) => authApi.firebaseLogin(data),
    onSuccess: async (res) => {
      setAccessToken(res.access_token);
      setCurrentUserId(res.user.id);
      setUser(res.user);
      scheduleProactiveRefresh();

      // Persist the refresh token via the BFF route handler
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: res.refresh_token }),
      });

      queryClient.setQueryData(authKeys.me, res.user);
      
      // Optional: Show welcome message for new users
      if (res.is_new_user) {
        console.log("Welcome! Your account has been created.");
      }
      
      router.push("/chat");
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      // Sign out from Firebase so its cached session is cleared.
      // Next Google sign-in will always show the account picker.
      const { signOut } = await import("@/lib/firebase");
      await signOut().catch(() => {}); // non-blocking — don't fail logout if Firebase is down
      await fetch("/api/auth/session", { method: "DELETE" });
    },
    onSuccess: () => {
      clearSession();
      queryClient.clear();
      router.push("/login");
    },
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: authKeys.apiKeys,
    queryFn: () => authApi.listApiKeys(),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.createApiKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.apiKeys }),
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => authApi.revokeApiKey(keyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.apiKeys }),
  });
}
