"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck } from "lucide-react";
import {
  useAddBookmark, useDeleteBookmark, useWorkspaceBookmarks,
} from "@/lib/hooks/use-workspace";
import { cn } from "@/lib/utils/cn";

type TargetType = "answer" | "document" | "conversation" | "artifact";

/**
 * One bookmark control reused everywhere (AI responses, conversations,
 * documents, artifacts). It reflects the real bookmark state — filled +
 * "Bookmarked" when saved, outline otherwise — and toggles add/remove.
 * State comes from the single workspace-bookmarks query, so every instance
 * of this control for the same target stays in sync without a refresh.
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
  targetType: TargetType;
  targetId: string;
  note?: string;
  label?: string;
  compact?: boolean;
}) {
  const { data: bookmarks = [] } = useWorkspaceBookmarks(workspaceId);
  const addBookmark = useAddBookmark(workspaceId);
  const deleteBookmark = useDeleteBookmark(workspaceId);

  const existing = useMemo(
    () => bookmarks.find((b) => b.target_type === targetType && b.target_id === targetId),
    [bookmarks, targetType, targetId],
  );
  const bookmarked = !!existing;
  const busy = addBookmark.isPending || deleteBookmark.isPending;

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      if (existing) {
        await deleteBookmark.mutateAsync(existing.id);
        toast.success("Bookmark removed");
      } else {
        await addBookmark.mutateAsync({ target_type: targetType, target_id: targetId, note });
        toast.success("Bookmarked");
      }
    } catch {
      toast.error("Could not update bookmark");
    }
  }

  const Icon = bookmarked ? BookmarkCheck : Bookmark;

  if (compact) {
    return (
      <button onClick={toggle} disabled={busy} aria-pressed={bookmarked}
        aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
        title={bookmarked ? "Remove bookmark" : "Bookmark"}
        className={cn(
          "group/bm rounded-md p-1 transition-opacity hover:bg-[var(--surface-3)]",
          bookmarked ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        style={{ color: bookmarked ? "var(--accent)" : "var(--text-muted)" }}>
        <Icon className="size-3.5" />
      </button>
    );
  }

  return (
    <button onClick={toggle} disabled={busy} aria-pressed={bookmarked}
      className="group/bm inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] transition-colors hover:bg-[var(--surface-3)]"
      style={{ color: bookmarked ? "var(--accent)" : "var(--text-muted)" }}>
      <Icon className="size-3" />
      {bookmarked ? <span className="group-hover/bm:hidden">Bookmarked</span> : label}
      {bookmarked && <span className="hidden group-hover/bm:inline">Remove</span>}
    </button>
  );
}
