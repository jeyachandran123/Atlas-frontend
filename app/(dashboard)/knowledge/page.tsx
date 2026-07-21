"use client";

import { useState } from "react";
import { FileOutput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentsPanel } from "@/components/knowledge/documents-panel";
import { KnowledgeChat } from "@/components/knowledge/knowledge-chat";
import { GeneratePanel } from "@/components/knowledge/generate-panel";

/**
 * Knowledge AI — the full Document Intelligence flow in one space:
 * upload documents (left), ask grounded questions with live pipeline
 * progress (center), and generate downloadable artifacts (right panel).
 */
export default function KnowledgePage() {
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

  return (
    <div className="flex h-full">
      <DocumentsPanel selectedId={selectedDoc} onSelect={setSelectedDoc} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="flex items-center justify-between px-6 py-3"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <h1 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Knowledge AI
          </h1>
          <Button size="sm" variant={generateOpen ? "default" : "outline"} onClick={() => setGenerateOpen((v) => !v)}>
            <FileOutput /> Generate document
          </Button>
        </div>
        <KnowledgeChat documentId={selectedDoc} />
      </div>

      {generateOpen && (
        <GeneratePanel documentId={selectedDoc} onClose={() => setGenerateOpen(false)} />
      )}
    </div>
  );
}
