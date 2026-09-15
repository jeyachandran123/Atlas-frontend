import { create } from "zustand";

/**
 * Where a viewable file comes from:
 *   document       — a workspace document
 *   artifact       — a generated file (in a workspace, or made in a chat)
 *   chat_document  — a document attached to a chat message
 *   chat_image     — an image attached to a chat message
 */
export type ViewerKind = "document" | "artifact" | "chat_document" | "chat_image";

/** A resource the in-app Document Viewer can display. One store, one viewer,
 *  reused by workspaces, chat, the Library, search results, bookmarks, timeline. */
export interface ViewerResource {
  kind: ViewerKind;
  id: string;
  /** Set for workspace files; chat and Library files have none. */
  workspaceId?: string;
  title: string;
  filename: string;
  extension?: string;
}

interface ViewerState {
  resource: ViewerResource | null;
  open: (resource: ViewerResource) => void;
  close: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  resource: null,
  open: (resource) => set({ resource }),
  close: () => set({ resource: null }),
}));
