import { create } from "zustand";

/** A resource the in-app Document Viewer can display. One store, one viewer,
 *  reused by documents, artifacts, search results, bookmarks, timeline. */
export interface ViewerResource {
  kind: "document" | "artifact";
  id: string;
  workspaceId: string;
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
