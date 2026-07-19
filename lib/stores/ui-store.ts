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
    {
      name: "atlas-ui-prefs",
      // v2: the V2 shell replaced the collapsible sidebar with rail + panel.
      // Reset any stuck "collapsed" state so the conversation list is visible
      // by default after the upgrade.
      version: 2,
      migrate: (persisted) => ({
        ...(persisted as Partial<UIState>),
        sidebarCollapsed: false,
      }),
    },
  ),
);
