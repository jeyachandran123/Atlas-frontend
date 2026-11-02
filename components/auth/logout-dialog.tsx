"use client";

import { LogOut } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLogout } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/stores/auth-store";

/**
 * "Log out?" — asked before the session ends, because a stray click on the
 * rail would otherwise throw away an open chat and a half-typed prompt.
 * The dialog owns the logout itself, so every place that offers it behaves
 * the same way.
 */
export function LogoutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const logout = useLogout();
  const user = useAuthStore((s) => s.user);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Log out of UnityWorks?"
      description={
        user
          ? `You're signed in as ${user.email}. You'll need to sign in again to get back to your chats and files.`
          : "You'll need to sign in again to get back to your chats and files."
      }
      confirmLabel={logout.isPending ? "Logging out…" : "Log out"}
      pending={logout.isPending}
      icon={<LogOut className="size-4.5" style={{ color: "var(--danger)" }} />}
      onConfirm={() => logout.mutate()}
    />
  );
}
