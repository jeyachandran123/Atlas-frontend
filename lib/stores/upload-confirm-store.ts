import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Reusable upload-confirmation workflow. Any upload entry point calls
 * `request({ files, workspaceName, onConfirm })`; if the user has opted into
 * "don't ask again" the upload proceeds immediately, otherwise a single
 * global confirmation dialog (mounted in the shell) is shown. This prevents
 * accidental uploads without duplicating a dialog per call site.
 */
interface PendingUpload {
  files: File[];
  workspaceName: string;
  onConfirm: (files: File[]) => void;
}

interface UploadConfirmState {
  pending: PendingUpload | null;
  dontAskAgain: boolean;
  request: (req: PendingUpload) => void;
  confirm: (dontAskAgain: boolean) => void;
  cancel: () => void;
}

export const useUploadConfirmStore = create<UploadConfirmState>()(
  persist(
    (set, get) => ({
      pending: null,
      dontAskAgain: false,
      request: (req) => {
        if (get().dontAskAgain) {
          req.onConfirm(req.files);
          return;
        }
        set({ pending: req });
      },
      confirm: (dontAskAgain) => {
        const { pending } = get();
        if (pending) pending.onConfirm(pending.files);
        set({ pending: null, dontAskAgain: dontAskAgain || get().dontAskAgain });
      },
      cancel: () => set({ pending: null }),
    }),
    {
      name: "unityworks-upload-confirm",
      // Only the preference persists — pending File objects are never stored.
      partialize: (s) => ({ dontAskAgain: s.dontAskAgain }),
    },
  ),
);
