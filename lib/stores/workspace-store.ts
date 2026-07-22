import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceState {
  /** The last workspace the user was in — restored on next visit. */
  activeWorkspaceId: string | null;
  /** Right panel visibility (Workspace context). */
  contextPanelOpen: boolean;
  setActiveWorkspace: (id: string | null) => void;
  toggleContextPanel: () => void;
  setContextPanelOpen: (open: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      contextPanelOpen: true,
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
      toggleContextPanel: () => set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),
      setContextPanelOpen: (open) => set({ contextPanelOpen: open }),
    }),
    { name: "unityworks-workspace" },
  ),
);
