/** Types for the Document Intelligence Platform (upload → chat → generate). */

// ── Documents (Phase 1–3) ────────────────────────────────────────────────────

export interface DipDocument {
  id: string;
  filename: string;
  extension: string;
  mime_type: string;
  size_bytes: number;
  upload_status: string;
  processing_status: string;
  version: number;
  created_at: string;
}

export interface DipDocumentList {
  items: DipDocument[];
  total: number;
  limit: number;
  offset: number;
}

export interface DipUploadResponse {
  document: DipDocument;
  duplicate_of: string | null;
}

export interface ProcessingState {
  processing_status: string;
  current_stage?: string | null;
  error?: string | null;
  correlation_id?: string;
}

export interface SemanticManifest {
  status: string;
  embedding_count: number;
  model_name: string;
  dimension: number;
}

// ── Knowledge conversations (Phase 4) ────────────────────────────────────────

export interface KnowledgeConversation {
  id: string;
  title: string;
  status: string;
  correlation_id: string;
  created_at: string;
}

export interface Citation {
  source_id: string;
  knowledge_id: string;
  document_id: string;
  section: string;
  page: number | null;
  chunk_ids: string[];
  seqs: number[];
  confidence: number;
}

export interface TurnHistory {
  id: string;
  seq: number;
  question: string;
  answer: string | null;
  intent: string;
  status: string;
  grounded: boolean;
  grounding_score: number | null;
  citation_count: number;
  total_ms: number | null;
  total_tokens: number | null;
  created_at: string;
}

/** Named SSE events from POST /conversations/{id}/ask/stream */
export type AskStreamEvent =
  | { event: "meta"; data: { turn_id: string; conversation_id: string; correlation_id: string } }
  | { event: "stage"; data: { stage: string; detail: Record<string, unknown> } }
  | { event: "token"; data: { text: string } }
  | { event: "citations"; data: { citations: Citation[]; grounded: boolean; grounding_score: number } }
  | { event: "done"; data: { status: string; refusal_reason: string | null; answer?: string | null; intent?: string; metrics: Record<string, unknown> } }
  | { event: "error"; data: { message: string } };

// ── Generation (Phase 5) ─────────────────────────────────────────────────────

export interface GenerationArtifact {
  id: string;
  status: string;
  format: string;
  title: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  grounded: boolean;
  error: string | null;
  total_ms: number | null;
  created_at: string;
}

export interface GenerationDownload {
  mode: "signed_url" | "proxy";
  url: string | null;
  expires_in: number | null;
  filename: string;
  content_type: string;
}

/** Named SSE events from POST /generations/stream */
export type GenerateStreamEvent =
  | { event: "meta"; data: { artifact_id: string; correlation_id: string; format: string } }
  | { event: "stage"; data: { stage: string; detail: Record<string, unknown> } }
  | { event: "done"; data: { artifact_id: string; status: string; title: string; filename: string; format: string; size_bytes: number; error: string | null } }
  | { event: "error"; data: { message: string } };
