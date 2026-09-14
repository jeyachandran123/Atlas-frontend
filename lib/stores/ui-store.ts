import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  /** Sidebar folded to its icon strip. */
  sidebarCollapsed: boolean;
  citationsPanelOpen: boolean;
  /** The Ctrl+K palette — opened by the shortcut or the sidebar's search button. Not persisted. */
  paletteOpen: boolean;
  /** The page a click is heading to — shown as its skeleton until it arrives. Not persisted. */
  pendingHref: string | null;
  toggleSidebar: () => void;
  setCitationsPanelOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  setPendingHref: (href: string | null) => void;
}

/** What survives a reload: preferences only, never an open dialog. */
type SavedPrefs = Pick<UIState, "sidebarCollapsed" | "citationsPanelOpen">;

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      citationsPanelOpen: true,
      paletteOpen: false,
      pendingHref: null,
      setPendingHref: (href) => set({ pendingHref: href }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCitationsPanelOpen: (open) => set({ citationsPanelOpen: open }),
      setPaletteOpen: (open) =>
        set((s) => ({ paletteOpen: typeof open === "function" ? open(s.paletteOpen) : open })),
    }),
    {
      name: "atlas-ui-prefs",
      // v3: one ChatGPT-style sidebar replaced the rail + conversation panel.
      // Start everyone expanded once so the new layout is seen as intended.
      version: 3,
      migrate: (persisted): SavedPrefs => {
        const prev = (persisted ?? {}) as Partial<SavedPrefs>;
        return { sidebarCollapsed: false, citationsPanelOpen: prev.citationsPanelOpen ?? true };
      },
      partialize: (s): SavedPrefs => ({
        sidebarCollapsed: s.sidebarCollapsed,
        citationsPanelOpen: s.citationsPanelOpen,
      }),
    },
  ),
);
