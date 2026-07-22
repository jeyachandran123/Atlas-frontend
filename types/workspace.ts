/** Types for the Knowledge Workspace (Phase 5.5) — the Product Experience Layer. */

export interface Workspace {
  id: string;
  name: string;
  description: string;
  icon: string;
  is_default: boolean;
  status: string;
  created_at: string;
}

export interface WorkspaceDocument {
  id: string;
  filename: string;
  extension: string;
  size_bytes: number;
  processing_status: string;
  created_at: string;
}

export interface WorkspaceConversation {
  conversation_id: string;
  title: string;
  title_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceArtifact {
  id: string;
  title: string;
  filename: string;
  format: string;
  status: string;
  size_bytes: number;
  grounded: boolean;
  conversation_id: string | null;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  event_type: string;
  title: string;
  ref_type: string | null;
  ref_id: string | null;
  detail_json: string | null;
  created_at: string;
}

export interface Bookmark {
  id: string;
  target_type: "answer" | "document" | "conversation" | "artifact";
  target_id: string;
  note: string | null;
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

export interface RestoreTurn {
  id: string;
  seq: number;
  question: string;
  answer: string | null;
  status: string;
  grounded: boolean;
  grounding_score: number | null;
  citations: Citation[];
  created_at: string;
}

export interface ConversationRestore {
  conversation_id: string;
  title: string;
  correlation_id: string;
  turns: RestoreTurn[];
  documents: WorkspaceDocument[];
  artifacts: WorkspaceArtifact[];
}

export interface WorkspaceDashboard {
  workspace: Workspace;
  stats: Record<string, number>;
  summary: string;
  suggestions: string[];
  summary_generated_at: string | null;
  recent_conversations: WorkspaceConversation[];
  recent_documents: WorkspaceDocument[];
  recent_artifacts: WorkspaceArtifact[];
  recent_activity: TimelineEvent[];
}

export interface WorkspaceSearchResults {
  documents: { id: string; filename: string; processing_status: string }[];
  conversations: { conversation_id: string; title: string }[];
  turns: {
    conversation_id: string;
    turn_id: string;
    question: string;
    conversation_title: string;
    answer_snippet: string;
  }[];
  artifacts: { id: string; title: string; filename: string; format: string; status: string }[];
  timeline: { event_type: string; title: string; created_at: string }[];
  chunks: { document_id: string; section: string; snippet: string; score: number }[];
}

export interface RelatedResults {
  documents: { id: string; filename: string; score: number }[];
  conversations: { conversation_id: string; title: string }[];
}

/** Named SSE events from the workspace ask stream (adds `title` to the base set). */
export type WorkspaceAskEvent =
  | { event: "meta"; data: { turn_id: string; conversation_id: string; correlation_id: string } }
  | { event: "stage"; data: { stage: string; detail: Record<string, unknown> } }
  | { event: "token"; data: { text: string } }
  | { event: "citations"; data: { citations: Citation[]; grounded: boolean; grounding_score: number } }
  | { event: "done"; data: { status: string; refusal_reason: string | null; answer?: string | null; metrics: Record<string, unknown> } }
  | { event: "title"; data: { title: string } }
  | { event: "error"; data: { message: string } };

export type WorkspaceGenerateEvent =
  | { event: "meta"; data: { artifact_id: string; correlation_id: string; format: string } }
  | { event: "stage"; data: { stage: string; detail: Record<string, unknown> } }
  | { event: "done"; data: { artifact_id: string; status: string; title: string; filename: string; format: string; size_bytes: number; error: string | null } }
  | { event: "error"; data: { message: string } };
