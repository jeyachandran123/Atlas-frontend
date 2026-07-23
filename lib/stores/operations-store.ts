import { create } from "zustand";

/**
 * Global, workspace-level state for long-running operations (uploads,
 * generation, export, save-as-knowledge). Because this is a module-level
 * store — not component state — an operation's progress survives navigation
 * between Workspace pages. The OperationsTray (mounted once in the shell)
 * renders it, and a single poller advances upload operations through
 * queued → processing → knowledge-ready.
 */
export type OperationKind = "upload" | "generate" | "export" | "save";
export type OperationStatus =
  | "uploading" | "queued" | "processing" | "embedding" | "completed" | "failed";

export interface Operation {
  id: string;
  kind: OperationKind;
  label: string;
  status: OperationStatus;
  workspaceId: string;
  documentId?: string; // uploads: polled to advance status
  detail?: string;
  createdAt: number;
}

interface OperationsState {
  operations: Operation[];
  start: (op: Omit<Operation, "id" | "createdAt">) => string;
  update: (id: string, patch: Partial<Operation>) => void;
  finish: (id: string, status: "completed" | "failed", detail?: string) => void;
  remove: (id: string) => void;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useOperationsStore = create<OperationsState>((set) => ({
  operations: [],
  start: (op) => {
    const id = uid();
    set((s) => ({ operations: [...s.operations, { ...op, id, createdAt: Date.now() }] }));
    return id;
  },
  update: (id, patch) =>
    set((s) => ({ operations: s.operations.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),
  finish: (id, status, detail) => {
    set((s) => ({ operations: s.operations.map((o) => (o.id === id ? { ...o, status, detail } : o)) }));
    // Auto-dismiss completed/failed operations after a short grace period.
    setTimeout(() => set((s) => ({ operations: s.operations.filter((o) => o.id !== id) })), 5000);
  },
  remove: (id) => set((s) => ({ operations: s.operations.filter((o) => o.id !== id) })),
}));

export const STATUS_LABEL: Record<OperationStatus, string> = {
  uploading: "Uploading",
  queued: "Queued",
  processing: "Processing",
  embedding: "Embedding",
  completed: "Ready",
  failed: "Failed",
};
