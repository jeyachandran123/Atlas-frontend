"use client";

import { useState } from "react";
import { FileUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadConfirmStore } from "@/lib/stores/upload-confirm-store";

/** Single global upload-confirmation dialog, mounted once in the shell. */
export function UploadConfirmDialog() {
  const pending = useUploadConfirmStore((s) => s.pending);
  const confirm = useUploadConfirmStore((s) => s.confirm);
  const cancel = useUploadConfirmStore((s) => s.cancel);
  const [dontAsk, setDontAsk] = useState(false);

  if (!pending) return null;

  const { files, workspaceName } = pending;
  const single = files.length === 1;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={cancel}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl animate-scale-up"
        style={{ background: "var(--surface-overlay)", backdropFilter: "blur(24px)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            <FileUp className="size-4" /> {single ? "Upload file?" : `Upload ${files.length} files?`}
          </h2>
          <button onClick={cancel} aria-label="Cancel"><X className="size-4" style={{ color: "var(--text-muted)" }} /></button>
        </div>

        <div className="px-4 py-4">
          <div className="mb-3 flex flex-col gap-1.5">
            {files.slice(0, 5).map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px]"
                style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}>
                <FileUp className="size-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name}</span>
                <span className="shrink-0 text-[10.5px]" style={{ color: "var(--text-muted)" }}>{(f.size / 1024).toFixed(0)} KB</span>
              </div>
            ))}
            {files.length > 5 && (
              <span className="px-1 text-[11px]" style={{ color: "var(--text-muted)" }}>+{files.length - 5} more</span>
            )}
          </div>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            Workspace: <span style={{ color: "var(--text-secondary)" }}>{workspaceName}</span>
          </p>

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)}
              className="size-3.5 rounded" style={{ accentColor: "var(--accent)" }} />
            Don&apos;t ask again
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
          <Button size="sm" variant="signal" onClick={() => { confirm(dontAsk); setDontAsk(false); }}>
            <FileUp /> Upload
          </Button>
        </div>
      </div>
    </div>
  );
}
