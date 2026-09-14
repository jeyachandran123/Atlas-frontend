/**
 * Domain types — these mirror app/shared/schemas.py and the router-local
 * Pydantic models in the Atlas FastAPI backend EXACTLY.
 *
 * If a backend field is renamed, added, or removed, this file must be
 * updated in lockstep. There is no codegen step yet (consider adding
 * datamodel-code-generator or openapi-typescript once the API stabilizes).
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type ChunkType =
  | "function"
  | "class"
  | "method"
  | "module"
  | "import"
  | "docstring"
  | "constant";

export type IndexStatus = "pending" | "indexing" | "ready" | "error" | "stale";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type UserRole = "admin" | "developer" | "viewer";

export type Intent = "code" | "review" | "explain" | "search" | "fix" | "test";

// ── Auth ───────────────────────────────────────────────────────────────────

export interface UserOut {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  /** Whether email + password sign-in works for this account. */
  has_password?: boolean;
  /** How the account was first created: "email", "google", … */
  auth_provider?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: UserOut;
}

export interface FirebaseLoginRequest {
  firebase_token: string;
}

export interface FirebaseLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: UserOut;
  is_new_user: boolean;
}

/** Sign-up. The server decides role and organisation. */
export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

/** Sign-up accepted, but the address must be confirmed with an emailed code first. */
export interface SignupVerificationPending {
  verification: "email_otp";
  email: string;
  /** Seconds until the code expires. */
  expires_in: number;
  /** Seconds before another code can be requested. */
  resend_after: number;
}

export interface VerifySignupRequest {
  email: string;
  code: string;
}

export interface SetPasswordRequest {
  /** Required when the account already has a password. */
  current_password?: string;
  new_password: string;
}

export interface APIKeyOut {
  id: string;
  name: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

export interface CreateAPIKeyRequest {
  name: string;
  scopes?: string[];
  expires_days?: number;
}

export interface CreateAPIKeyResponse {
  key: string; // shown once
  details: APIKeyOut;
}

// ── Repositories & Indexing ──────────────────────────────────────────────

export interface RepoOut {
  id: string;
  name: string;
  local_path: string;
  provider: "local" | "github" | "gitlab" | "bitbucket";
  index_status: IndexStatus;
  file_count: number;
  chunk_count: number;
  last_indexed_at: string | null;
  created_at: string;
}

export interface ConnectRepoRequest {
  name: string;
  provider: RepoOut["provider"];
  local_path?: string;
  remote_url?: string;
  default_branch?: string;
}

export interface IndexJobOut {
  id: string;
  repo_id: string;
  job_type: "full" | "incremental";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  files_total: number;
  files_processed: number;
  chunks_created: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ── Chat / Conversations ────────────────────────────────────────────────

export interface ConversationOut {
  id: string;
  title: string;
  repo_id: string | null;
  total_tokens: number;
  is_pinned: boolean;
  pin_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationsResponse {
  conversations: ConversationOut[];
  total: number;
  limit: number;
  offset: number;
}

export interface MessageImageOut {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  url: string;
}

export interface MessageDocumentOut {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  page_count: number | null;
  char_count: number;
  url: string;
}

export interface MessageOut {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  agent_used: string | null;
  tokens_used: number;
  images?: MessageImageOut[];
  documents?: MessageDocumentOut[];
  created_at: string;
}

/** Each maps onto a chat profile in the backend's app/llm. */
export type AgentMode = "auto" | "code" | "business" | "reasoning" | "math" | "planning";

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  repo_id?: string;
  agent_mode?: AgentMode;
  /** Omitted = the profile's default. true/false force thinking for this message. */
  thinking?: boolean;
}

// Vision-enabled chat uses FormData (multipart), not JSON
export interface VisionChatRequest {
  message: string;
  conversation_id?: string;
  repo_id?: string;
  agent_mode?: AgentMode;
  images?: File[];
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  content: string;
  agent_used: string;
  tokens_used: number;
  latency_ms: number;
  context_chunks_used: number;
}

/** A file the assistant made — stored as JSON on its message (agent_used "file_artifact"). */
export interface ChatFilePayload {
  artifact_id?: string | null;
  title?: string | null;
  filename?: string | null;
  format?: string | null;
  size_bytes?: number | null;
  status?: string | null;
  error?: string | null;
  /** attachment | conversation | knowledge — where the content came from. */
  source?: string | null;
  based_on?: string | null;
  /** A short written overview of what the file contains (markdown). */
  summary?: string | null;
}

// SSE stream event union — matches chat/router.py event_generator exactly
export type ChatStreamEvent =
  /** First event of every turn: where the user's message was saved. */
  | { type: "meta"; conversation_id: string; user_message_id: string }
  | { type: "token"; content: string }
  /** The model's thinking, streamed apart from the answer. Never saved. */
  | { type: "reasoning"; content: string }
  /** Progress while a file is being made. */
  | { type: "file_stage"; stage: string; format?: string }
  /** Questions to answer before a file is made (also saved as a message). */
  | { type: "clarify"; questions: unknown[]; intro?: string }
  /** A finished file (also saved as a message). */
  | ({ type: "file" } & ChatFilePayload)
  | { type: "tool_call"; tool_name: string; rationale?: string }
  | {
      type: "done";
      conversation_id: string;
      tokens_used: number;
      message_id?: string;
      latency_ms?: number;
      // ── Cognitive OS metadata (present only when the brain handled the turn) ──
      brain?: boolean;
      decision?: string;        // executive decision, e.g. "approve" | "escalate" | "ask_user"
      authorized?: boolean;
      escalated?: boolean;      // true => held for human review, not auto-answered
      confidence?: number;      // 0..1 calibrated confidence
      intent?: string;
    }
  // conversation_id lets the client adopt the conversation even when the
  // stream fails — otherwise every retry would spawn a new conversation
  | { type: "error"; message: string; conversation_id?: string };

// ── Library — mirrors app/api/v1/library/router.py ───────────────────────

export type LibraryKind = "image" | "document" | "created";

export interface LibraryItem {
  id: string;
  kind: LibraryKind;
  name: string;
  filename: string;
  /** File extension, lower-case: "pdf", "xlsx", "png"… */
  format: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  conversation_id: string | null;
  conversation_title: string | null;
  width: number | null;
  height: number | null;
  page_count: number | null;
  /** Created files: "chat" when made in a chat. */
  origin: string | null;
  /** A short-lived signed link for an image preview, when storage can mint one. */
  preview_url: string | null;
}

export interface LibraryPage {
  items: LibraryItem[];
  total: number;
  counts: Record<LibraryKind, number>;
  limit: number;
  offset: number;
}

/** One sheet (or Word table) as the viewer draws it — mirrors app/library/preview.py. */
export interface PreviewSheet {
  name: string;
  rows: string[][];
  total_rows: number;
  total_cols: number;
  truncated: boolean;
}

export type FilePreview =
  | { type: "table"; sheets: PreviewSheet[]; sheet_count: number }
  | {
      type: "document";
      blocks: Array<{ kind: "heading" | "paragraph"; text: string }>;
      tables: PreviewSheet[];
      truncated: boolean;
    }
  | { type: "too_large"; max_mb: number }
  | { type: "unsupported" };

// ── Search & Retrieval ───────────────────────────────────────────────────

export interface CodeChunk {
  content: string;
  file_path: string;
  language: string;
  chunk_type: ChunkType;
  start_line: number;
  end_line: number;
  function_name: string | null;
  class_name: string | null;
  repo_id: string;
  file_hash: string;
}

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
  rank: number;
}

export interface SearchRequest {
  query: string;
  repo_id: string;
  top_k?: number;
  language?: string;
  chunk_type?: ChunkType;
  file_path_filter?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total_found: number;
  query: string;
}

// ── Files ────────────────────────────────────────────────────────────────

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number | null;
  children: FileTreeNode[] | null;
}

export interface FileContentResponse {
  path: string;
  content: string;
  size: number;
  language: string | null;
}

export interface WriteFileRequest {
  path: string;
  content: string;
  create_backup?: boolean;
}

export interface WriteFileResponse {
  path: string;
  size: number;
  backup_path: string | null;
}

export interface FileSearchResult {
  path: string;
  name: string;
  size: number;
  type: string;
}

export interface FileSearchResponse {
  results: FileSearchResult[];
  total: number;
  query: string;
}

// ── Git ──────────────────────────────────────────────────────────────────

export interface GitStatusResponse {
  branch: string;
  is_clean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface GitDiffResponse {
  diff: string;
  files_changed: number;
  insertions: number;
  deletions: number;
}

export interface GitCommit {
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

export interface GitLogResponse {
  commits: GitCommit[];
  total: number;
}

export interface GitBranch {
  name: string;
  is_current: boolean;
  last_commit_sha: string;
  last_commit_message: string;
}

export interface GitBranchesResponse {
  branches: GitBranch[];
  current_branch: string;
}

export interface GitShowResponse {
  commit: GitCommit;
  diff: string;
}

export interface GitBlameLine {
  line_number: number;
  content: string;
  commit_sha: string;
  author: string;
  date: string;
}

export interface GitBlameResponse {
  file_path: string;
  lines: GitBlameLine[];
}

// ── Errors ───────────────────────────────────────────────────────────────

export interface ErrorResponse {
  status: "error";
  message: string;
  detail?: string;
  request_id?: string;
}

export class ApiError extends Error {
  status: number;
  requestId?: string;
  detail?: string;

  constructor(message: string, status: number, requestId?: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
    this.detail = detail;
  }
}
