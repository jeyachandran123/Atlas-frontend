import { useQuery } from "@tanstack/react-query";
import { libraryApi } from "@/lib/api/library";

/** Signed image links last five minutes; take a fresh one a little before that. */
const LINK_FRESH_MS = 4 * 60 * 1000;

export const chatImageKey = (imageId: string | null) => ["chat-image", imageId] as const;

/**
 * Where to load a saved chat image from: a signed link straight from storage
 * when it can mint one — fast, and never through the API's size-capped proxy —
 * or the bytes through the API when it cannot. The thumbnail and the viewer
 * both ask through this, so they share one cached answer.
 */
export function chatImageQuery(imageId: string) {
  return {
    queryKey: chatImageKey(imageId),
    queryFn: async () => (await libraryApi.downloadById("image", imageId, "")).url,
    staleTime: LINK_FRESH_MS,
    gcTime: 30 * 60 * 1000,
  };
}

/** The same, as a hook — a message shown again draws at once instead of fetching again. */
export function useChatImageSrc(imageId: string | null, enabled = true) {
  return useQuery({
    ...chatImageQuery(imageId ?? ""),
    enabled: enabled && !!imageId,
    retry: 1,
  });
}
