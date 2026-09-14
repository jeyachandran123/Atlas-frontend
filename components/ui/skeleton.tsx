import type { CSSProperties, ReactNode } from "react";

/**
 * Loading placeholders shaped like the content they stand in for, so a page
 * keeps its layout while its data arrives instead of flashing blank or empty.
 * All of them shimmer with the app's `animate-shimmer` sweep.
 */

/** One shimmering block. */
export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={`animate-shimmer rounded-md ${className}`} style={style} />;
}

/** Announces "loading" once to screen readers; the blocks inside are decorative. */
function Loading({
  label = "Loading", className = "", style, children,
}: {
  label?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" className={className} style={style}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

const CARD: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
};

// ── Chat ──────────────────────────────────────────────────────────────────

/** The sidebar's chat list: a section label and rows of titles. */
export function ConversationListSkeleton() {
  const widths = [78, 62, 88, 54, 72, 66, 84, 58, 70];
  return (
    <Loading label="Loading chats" className="px-2.5 pt-4">
      <Skeleton className="mb-3.5 h-3 w-12" />
      <div className="flex flex-col gap-3">
        {widths.map((w, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
        ))}
      </div>
    </Loading>
  );
}

/** A conversation's messages: prompts on the right, replies on the left. */
export function ChatMessagesSkeleton() {
  return (
    <Loading label="Loading messages" className="flex flex-col gap-7">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-7">
          <div className="flex justify-end">
            <Skeleton className="h-11 rounded-2xl" style={{ width: i ? "38%" : "52%" }} />
          </div>
          <div className="flex gap-3">
            <Skeleton className="size-7 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2.5 pt-1">
              <Skeleton className="h-3.5 w-[92%]" />
              <Skeleton className="h-3.5 w-[84%]" />
              <Skeleton className="h-3.5 w-[66%]" />
              {i === 0 && <Skeleton className="mt-1 h-24 w-full rounded-xl" />}
            </div>
          </div>
        </div>
      ))}
    </Loading>
  );
}

/** A whole chat page: header, messages, composer. */
export function ChatPageSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center px-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <Skeleton className="h-3.5 w-48" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto max-w-[768px] px-6 py-8">
          <ChatMessagesSkeleton />
        </div>
      </div>
      <div className="px-6 pb-5 pt-3">
        <div className="mx-auto max-w-[768px]">
          <Skeleton className="h-[104px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// ── Pages ─────────────────────────────────────────────────────────────────

/** A standard page: title, subtitle, a few content cards. */
export function PageSkeleton() {
  return (
    <Loading label="Loading page" className="flex h-full flex-col">
      <div className="page-header">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3.5 w-72" />
        </div>
      </div>
      <div className="px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {[88, 150, 110].map((h, i) => (
            <Skeleton key={i} className="w-full rounded-xl" style={{ height: h }} />
          ))}
        </div>
      </div>
    </Loading>
  );
}

/** A settings-style card: optional avatar, a few lines. */
export function CardSkeleton({ avatar = false, lines = 2 }: { avatar?: boolean; lines?: number }) {
  return (
    <Loading label="Loading" className="flex items-center gap-3.5 rounded-xl p-4" style={CARD}>
      {avatar && <Skeleton className="size-11 shrink-0 rounded-full" />}
      <div className="flex flex-1 flex-col gap-2">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={i === 0 ? "h-4" : "h-3"} style={{ width: `${72 - i * 20}%` }} />
        ))}
      </div>
    </Loading>
  );
}

/** Rows of API keys: icon, name, when it was used, a revoke button. */
export function KeyRowsSkeleton() {
  return (
    <Loading label="Loading keys" className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3" style={CARD}>
          <Skeleton className="size-7 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5" style={{ width: `${40 - i * 6}%` }} />
            <Skeleton className="h-3 w-[55%]" />
          </div>
          <Skeleton className="size-7 shrink-0 rounded-lg" />
        </div>
      ))}
    </Loading>
  );
}

/** Code search results: a file header and a block of code each. */
export function SearchResultsSkeleton() {
  return (
    <Loading label="Searching" className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-xl" style={CARD}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <Skeleton className="h-3.5" style={{ width: `${46 - i * 8}%` }} />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex flex-col gap-2 p-4">
            {[90, 76, 84, 60, 70].map((w, j) => (
              <Skeleton key={j} className="h-3" style={{ width: `${w - i * 4}%` }} />
            ))}
          </div>
        </div>
      ))}
    </Loading>
  );
}

/** A short list of one-line rows with an icon — side panels and small lists. */
export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Loading label="Loading" className="flex flex-col gap-2.5 py-0.5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="size-3.5 shrink-0 rounded" />
          <Skeleton className="h-3" style={{ width: `${78 - (i % 3) * 14}%` }} />
        </div>
      ))}
    </Loading>
  );
}

// ── Workspace ─────────────────────────────────────────────────────────────

/** The workspace overview: stat cards, the summary, suggested next steps. */
export function DashboardSkeleton() {
  return (
    <Loading label="Loading workspace" className="mx-auto max-w-3xl">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl p-4" style={CARD}>
            <Skeleton className="size-4 rounded" />
            <Skeleton className="mt-3 h-6 w-10" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-4 h-24 w-full rounded-xl" />
      <Skeleton className="mt-5 h-3 w-24" />
      <div className="mt-2 flex flex-col gap-1.5">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    </Loading>
  );
}

/** Rows of files or events — the workspace's documents, generated files, timeline. */
export function TableRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Loading label="Loading" className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3" style={CARD}>
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5" style={{ width: `${56 - (i % 3) * 10}%` }} />
            <Skeleton className="h-3 w-[30%]" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </Loading>
  );
}

/** The workspace: its sidebar, the page, and the context panel on the right. */
export function WorkspaceSkeleton() {
  return (
    <Loading label="Loading workspace" className="flex h-full min-h-0">
      <div className="hidden w-[240px] shrink-0 flex-col gap-3 p-4 md:flex" style={{ borderRight: "1px solid var(--border-subtle)", background: "var(--sidebar-bg)" }}>
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="mt-3 h-3 w-16" />
        {[80, 64, 72, 56, 68].map((w, i) => <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-5 px-8 py-7">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3.5 w-80" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <div className="hidden w-[280px] shrink-0 flex-col gap-3 p-4 lg:flex" style={{ borderLeft: "1px solid var(--border-subtle)", background: "var(--sidebar-bg)" }}>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="mt-2 h-3 w-24" />
        {[76, 60, 70, 52].map((w, i) => <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />)}
      </div>
    </Loading>
  );
}

// ── App ───────────────────────────────────────────────────────────────────

/** The whole app while the session is restored: sidebar and an empty page. */
export function AppShellSkeleton() {
  return (
    <Loading label="Loading UnityWorks" className="flex h-screen" style={{ background: "var(--canvas)" }}>
      <div
        className="flex w-[260px] shrink-0 flex-col gap-2 px-3 py-3"
        style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border-subtle)" }}
      >
        <div className="mb-2 flex items-center gap-2.5 px-1 py-1">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="h-4 w-28" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-2.5 py-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-3.5" style={{ width: `${40 + (i % 3) * 12}%` }} />
          </div>
        ))}
        <div className="mt-3 flex flex-col gap-3 px-2.5">
          <Skeleton className="h-3 w-12" />
          {[80, 64, 72, 58, 68].map((w, i) => <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />)}
        </div>
        <div className="mt-auto flex items-center gap-2.5 px-2 py-2">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 px-6">
        <Skeleton className="size-16 rounded-[20px]" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="mt-6 h-[104px] w-full max-w-[640px] rounded-2xl" />
      </div>
    </Loading>
  );
}
