"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { knowledgeApi } from "@/lib/api/knowledge";
import type { DipDocument } from "@/types/knowledge";
import { cn } from "@/lib/utils/cn";

const ACTIVE_STATES = new Set(["queued", "processing", "retrying"]);

function statusBadge(doc: DipDocument, indexed: boolean) {
  if (doc.processing_status === "knowledge_ready") {
    return indexed
      ? <Badge variant="ready" dot>Ready</Badge>
      : <Badge variant="indexing" dot>Embedding…</Badge>;
  }
  if (doc.processing_status === "failed") return <Badge variant="error" dot>Failed</Badge>;
  if (ACTIVE_STATES.has(doc.processing_status)) return <Badge variant="indexing" dot>Processing…</Badge>;
  return <Badge variant="pending">{doc.processing_status || "uploaded"}</Badge>;
}

export function DocumentsPanel({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["dip-documents"],
    queryFn: () => knowledgeApi.listDocuments(),
    // Keep polling while any document is still processing (the embedding
    // pipeline runs in the background after knowledge_ready).
    refetchInterval: (q) => {
      const docs = q.state.data?.items ?? [];
      return docs.some((d) => ACTIVE_STATES.has(d.processing_status)) ? 3000 : 15000;
    },
  });
  const docs = data?.items ?? [];

  // Track semantic (embedding) readiness per ready document.
  const readyIds = docs
    .filter((d) => d.processing_status === "knowledge_ready")
    .map((d) => d.id)
    .sort()
    .join(",");
  const { data: semanticMap = {} } = useQuery({
    queryKey: ["dip-semantic", readyIds],
    enabled: readyIds.length > 0,
    refetchInterval: 5000,
    queryFn: async () => {
      const map: Record<string, boolean> = {};
      await Promise.all(
        readyIds.split(",").map(async (id) => {
          try {
            const s = await knowledgeApi.semanticState(id);
            map[id] = s.status === "indexed";
          } catch {
            map[id] = false;
          }
        }),
      );
      return map;
    },
  });

  const onUpload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setUploading(true);
      setUploadError(null);
      try {
        for (const file of Array.from(files)) {
          await knowledgeApi.uploadDocument(file);
        }
        await qc.invalidateQueries({ queryKey: ["dip-documents"] });
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
        if (fileInput.current) fileInput.current.value = "";
      }
    },
    [qc],
  );

  return (
    <div
      className="flex h-full w-[290px] shrink-0 flex-col"
      style={{ borderRight: "1px solid var(--border-subtle)", background: "var(--sidebar-bg)" }}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Documents
        </h2>
        <Button
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
          Upload
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => onUpload(e.target.files)}
        />
      </div>
      {uploadError && (
        <p className="px-4 pb-1 text-[11px]" style={{ color: "var(--status-error)" }}>
          {uploadError}
        </p>
      )}
      <p className="px-4 pb-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        {selectedId ? "Chat & generation scoped to the selected document." : "Chat uses all ready documents."}
      </p>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {docs.length === 0 && (
          <div className="mt-10 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
            Upload a PDF, Word, Excel or text file to build your knowledge base.
          </div>
        )}
        {docs.map((doc) => (
          <button
            key={doc.id}
            onClick={() => onSelect(selectedId === doc.id ? null : doc.id)}
            className={cn(
              "group mb-1 flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
            )}
            style={{
              background: selectedId === doc.id ? "var(--surface-3)" : "transparent",
              border: selectedId === doc.id
                ? "1px solid var(--border-strong)"
                : "1px solid transparent",
            }}
          >
            <FileText className="mt-0.5 size-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-[12.5px] font-medium"
                style={{ color: "var(--text-primary)" }}
                title={doc.filename}
              >
                {doc.filename}
              </div>
              <div className="mt-1 flex items-center gap-2">
                {statusBadge(doc, semanticMap[doc.id] ?? false)}
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {(doc.size_bytes / 1024).toFixed(0)} KB
                </span>
              </div>
            </div>
            <Trash2
              className="mt-1 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
              style={{ color: "var(--status-error)" }}
              onClick={async (e) => {
                e.stopPropagation();
                await knowledgeApi.deleteDocument(doc.id);
                if (selectedId === doc.id) onSelect(null);
                qc.invalidateQueries({ queryKey: ["dip-documents"] });
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
