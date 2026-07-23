"use client";

import { toast } from "sonner";
import { Bookmark } from "lucide-react";
import { useAddBookmark } from "@/lib/hooks/use-workspace";
import { cn } from "@/lib/utils/cn";

/**
 * One bookmark control reused everywhere (AI responses, conversations,
 * documents, artifacts). Adds a workspace bookmark and confirms with a toast.
 * Removal happens from the Bookmarks tab.
 */
export function BookmarkButton({
  workspaceId,
  targetType,
  targetId,
  note,
  label = "Bookmark",
  compact = false,
}: {
  workspaceId: string;
  targetType: "answer" | "document" | "conversation" | "artifact";
  targetId: string;
  note?: string;
  label?: string;
  compact?: boolean;
}) {
  const addBookmark = useAddBookmark(workspaceId);

  async function save(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await addBookmark.mutateAsync({ target_type: targetType, target_id: targetId, note });
      toast.success("Bookmarked");
    } catch {
      toast.error("Could not bookmark");
    }
  }

  if (compact) {
    return (
      <button onClick={save} disabled={addBookmark.isPending} aria-label={label}
        className="rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-3)]"
        style={{ color: "var(--text-muted)" }}>
        <Bookmark className="size-3.5" />
      </button>
    );
  }

  return (
    <button onClick={save} disabled={addBookmark.isPending}
      className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] transition-colors hover:bg-[var(--surface-3)]")}
      style={{ color: "var(--text-muted)" }}>
      <Bookmark className="size-3" /> {label}
    </button>
  );
}
