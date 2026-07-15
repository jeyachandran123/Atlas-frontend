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

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
  role?: UserRole;
  org_id: string;
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

export interface MessageOut {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  agent_used: string | null;
  tokens_used: number;
  images?: MessageImageOut[];
  created_at: string;
}

export type AgentMode = "auto" | "code" | "business";

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  repo_id?: string;
  agent_mode?: AgentMode;
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

// SSE stream event union — matches chat/router.py event_generator exactly
export type ChatStreamEvent =
  | { type: "token"; content: string }
  | { type: "tool_call"; tool_name: string; rationale?: string }
  | { type: "done"; conversation_id: string; tokens_used: number }
  | { type: "error"; message: string };

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
