import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarCollapsed: boolean;
  citationsPanelOpen: boolean;
  toggleSidebar: () => void;
  setCitationsPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      citationsPanelOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCitationsPanelOpen: (open) => set({ citationsPanelOpen: open }),
    }),
    { name: "atlas-ui-prefs" },
  ),
);
