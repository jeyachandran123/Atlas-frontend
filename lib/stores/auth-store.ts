import { create } from "zustand";
import type { UserOut } from "@/types/api";

interface AuthState {
  user: UserOut | null;
  isHydrated: boolean;
  setUser: (user: UserOut | null) => void;
  setHydrated: (hydrated: boolean) => void;
  hasRole: (...roles: UserOut["role"][]) => boolean;
}

/**
 * Holds the *current* user for synchronous reads (RBAC gating in nav,
 * conditional rendering). The actual fetch/refresh/cache lifecycle is
 * owned by TanStack Query (see lib/hooks/use-auth.ts) — this store is
 * hydrated from that query's onSuccess, not an independent data source.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isHydrated: false,
  setUser: (user) => set({ user }),
  setHydrated: (hydrated) => set({ isHydrated: hydrated }),
  hasRole: (...roles) => {
    const user = get().user;
    return !!user && roles.includes(user.role);
  },
}));
