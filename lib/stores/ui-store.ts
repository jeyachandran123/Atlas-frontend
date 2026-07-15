import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarCollapsed: boolean;
  citationsPanelOpen: boolean;
  galleryOpen: boolean;
  toggleSidebar: () => void;
  setCitationsPanelOpen: (open: boolean) => void;
  setGalleryOpen: (open: boolean) => void;
  toggleGallery: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      citationsPanelOpen: true,
      galleryOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCitationsPanelOpen: (open) => set({ citationsPanelOpen: open }),
      setGalleryOpen: (open) => set({ galleryOpen: open }),
      toggleGallery: () => set((s) => ({ galleryOpen: !s.galleryOpen })),
    }),
    { name: "atlas-ui-prefs" },
  ),
);
