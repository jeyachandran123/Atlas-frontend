# Atlas Web

The primary client for Atlas — a self-hosted AI coding assistant. Built to
compete on quality with Cursor/Linear/Vercel-tier products, while staying
strictly grounded in the actual FastAPI backend contract (`types/api.ts`
mirrors `app/shared/schemas.py` and the router-local Pydantic models exactly).

## Stack & why

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 | Server components for dashboards, client components for the streaming chat surface |
| Styling | Tailwind v4 + owned primitives (`components/ui`) | shadcn-style — components you own and deeply customize, not a black-box library |
| Server state | TanStack Query | Repo list, conversations, index progress (polling) — a cache of backend truth |
| Client state | Zustand | Streaming token buffer, active tool call, UI prefs — ephemeral, high-frequency, never duplicates server data |
| Code highlighting | Shiki | Same TextMate grammars as VS Code — code looks like code, not "chatbot output" |
| Forms | React Hook Form + Zod | Type-safe validation aligned with backend Pydantic constraints |
| Auth storage | httpOnly cookie (refresh) + in-memory (access) | JWT never touches `localStorage` — matters given Atlas's per-repo ACLs and RBAC |

## Why two state libraries

Server state (repos, conversations, index status) and client state (streaming
buffer, active tool call, sidebar collapse) are fundamentally different
problems. Putting server data in Zustand means hand-rolling cache
invalidation; putting UI-only state in TanStack Query is a category error —
there's no "query" behind "is the sidebar open." See `lib/stores/` vs
`lib/hooks/` for the split; `lib/stores/auth-store.ts` is the one exception,
documented inline — it's hydrated *from* a TanStack Query call, never an
independent fetch source.

## Auth flow

```
Login form → useLogin() → POST /auth/login (FastAPI)
                         → access_token kept in memory (token-store.ts)
                         → refresh_token POSTed to /api/auth/session (Next.js route handler)
                         → route handler sets httpOnly cookie
                         → redirect to /chat

Hard refresh → (dashboard)/layout.tsx → POST /api/auth/refresh
                                       → route handler reads httpOnly cookie server-side
                                       → exchanges with FastAPI /auth/refresh
                                       → new access_token → memory
                                       → GET /auth/me → hydrates Zustand auth store
```

No client-side JavaScript ever reads the refresh token.

## Streaming chat

`lib/api/chat.ts::streamChatMessage` uses raw `fetch` + `ReadableStream`,
**not** `EventSource`, because the backend's `/chat/stream` is a POST
endpoint requiring a JSON body and a Bearer header — both unsupported by
`EventSource`. Token/tool-call/done/error events are routed into
`lib/stores/chat-store.ts`, which only the streaming message components
subscribe to, so the conversation sidebar and repo selector never re-render
on every token.

## Getting started

```bash
pnpm install
cp .env.example .env.local
# point ATLAS_BACKEND_URL at your running FastAPI instance (default :8000)
pnpm dev
```

The app proxies `/api/backend/*` → `${ATLAS_BACKEND_URL}/api/v1/*` via
`next.config.ts` rewrites, so the browser only ever talks to same-origin
Next.js — avoids CORS configuration in local dev entirely.

## Directory map

```
app/
  (auth)/            login, register — unauthenticated routes
  (dashboard)/        chat, repos, search, settings — behind session bootstrap
  api/auth/           BFF route handlers for httpOnly cookie session
components/
  ui/                owned primitives (button, input, card, badge, label)
  chat/              message bubbles, streaming UI, tool-call indicator, input
  repo/              connect dialog, repo card with live progress
  citations/         source citation chips
  layout/            sidebar, repo selector
lib/
  api/               typed fetch wrappers, one module per backend router
  hooks/             TanStack Query hooks — owns server state lifecycle
  stores/            Zustand stores — owns client/UI state
  utils/             cn(), date/token/size formatting
types/
  api.ts             hand-mirrored backend Pydantic schemas
```

## Known gaps / next stories to wire up

- `FE-CODE-01/02` — file viewer + Monaco diff editor (not yet built)
- `FE-CONV-01` — rename/archive conversation actions (list exists, actions don't)
- `FE-DOC-*` — document upload UI (depends on backend `BE-DOC-01..05`)
- `FE-ADMIN-02/03` — team management, org admin console
- Toast-driven retry on SSE stream drop (`lib/api/chat.ts` surfaces the error; UI retry affordance not yet added)
