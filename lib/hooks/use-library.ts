import { useInfiniteQuery } from "@tanstack/react-query";
import { libraryApi } from "@/lib/api/library";
import type { LibraryKind } from "@/types/api";

const PAGE_SIZE = 48;

/**
 * The Library, a page at a time, newest first. Keyed under ["library"] so a
 * finished chat turn (a new upload, a new file) refreshes every view of it.
 */
export function useLibrary(kind: LibraryKind | "all", query: string) {
  return useInfiniteQuery({
    queryKey: ["library", kind, query],
    queryFn: ({ pageParam }) =>
      libraryApi.list({
        kind: kind === "all" ? undefined : kind,
        q: query || undefined,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = last.offset + last.items.length;
      return next < last.total ? next : undefined;
    },
    // Image previews are signed links that expire after an hour.
    staleTime: 60_000,
  });
}
