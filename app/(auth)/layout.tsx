import { BookOpenText, FolderGit2, Library, MessageSquare } from "lucide-react";

/**
 * Sign-in and sign-up share this frame: the product on the left, the form on
 * the right. Colours, fonts and marks are the app's own — the same tokens
 * the rest of UnityWorks uses — so the first screen already looks like the
 * product behind it. Below `lg` the story folds away and the form stands alone.
 */

const CAPABILITIES = [
  { Icon: MessageSquare, label: "Chat", body: "Ask anything — code, business, knowledge. It thinks before it answers." },
  { Icon: BookOpenText, label: "Documents", body: "Answers grounded in your files, with every source cited." },
  { Icon: FolderGit2, label: "Code", body: "Understands your whole repository, not just the file in front of it." },
  { Icon: Library, label: "Library", body: "Everything you share, and everything it makes for you, in one place." },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div
          className="absolute inset-0 rounded-[14px] blur-xl"
          style={{
            background: "linear-gradient(135deg, var(--accent), #7c3aed)",
            transform: "scale(1.6)",
            opacity: 0.28,
          }}
        />
        <div
          className="relative flex h-[40px] w-[40px] items-center justify-center rounded-[12px]"
          style={{
            background: "linear-gradient(145deg, var(--accent) 0%, #6d28d9 100%)",
            boxShadow: "0 0 0 1px rgba(99,102,241,0.30), 0 4px 16px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
          }}
        >
          <div
            className="absolute inset-0 rounded-[12px]"
            style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.12) 0%, transparent 50%)" }}
          />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="relative z-10">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.95" />
            <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.60" />
            <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
          </svg>
        </div>
      </div>
      <div>
        <p className="text-[18px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
          UnityWorks
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          AI Coding Assistant
        </p>
      </div>
    </div>
  );
}

function Tagline({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] ${className}`} style={{ color: "var(--text-muted)" }}>
      Self-hosted · Secure · Grounded in your codebase
    </p>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // Exactly one screen tall, never scrolling: everything on the left is
    // sized from the viewport height (clamp + vh), so it fits at any zoom.
    <div className="relative flex h-dvh overflow-hidden" style={{ background: "var(--canvas)" }}>
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-64 -top-64 h-[900px] w-[900px] rounded-full animate-orb"
          style={{
            background: "radial-gradient(circle at center, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0.03) 45%, transparent 70%)",
            filter: "blur(1px)",
          }}
        />
        <div
          className="absolute -bottom-72 left-1/3 h-[800px] w-[800px] rounded-full animate-orb-slow"
          style={{
            background: "radial-gradient(circle at center, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0.02) 45%, transparent 70%)",
            filter: "blur(1px)",
          }}
        />
      </div>

      {/* Fine grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 75% 75% at 30% 50%, black 20%, transparent 100%)",
        }}
      />

      <div className="relative z-10 grid h-full w-full lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* ── The product ─────────────────────────────────────────────── */}
        <section className="hidden min-h-0 flex-col justify-between overflow-hidden px-14 py-[clamp(20px,5.5vh,56px)] lg:flex xl:px-20">
          <div className="animate-fade-up">
            <BrandMark />
          </div>

          <div className="max-w-[600px] animate-fade-up" style={{ animationDelay: "60ms" }}>
            <h2
              className="text-[clamp(26px,5.4vh,46px)] font-semibold leading-[1.1]"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.035em" }}
            >
              An answer you can&apos;t trace is an answer you can&apos;t trust.
            </h2>
            <p
              className="mt-[clamp(10px,2.2vh,20px)] max-w-[520px] text-[clamp(13px,1.8vh,15px)] leading-relaxed [@media(max-height:560px)]:hidden"
              style={{ color: "var(--text-tertiary)" }}
            >
              UnityWorks reads your code, your documents and your conversations — and shows where
              every answer came from. When it isn&apos;t sure, it asks instead of guessing.
            </p>

            <ul className="mt-[clamp(14px,4vh,40px)]" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              {CAPABILITIES.map(({ Icon, label, body }) => (
                <li
                  key={label}
                  className="grid grid-cols-[22px_112px_minmax(0,1fr)] items-center gap-3 py-[clamp(7px,1.6vh,16px)]"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <Icon className="size-4" style={{ color: "var(--accent-bright)" }} />
                  <span
                    className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: "var(--accent-bright)" }}
                  >
                    {label}
                  </span>
                  <span className="text-[clamp(12px,1.65vh,13.5px)] leading-snug" style={{ color: "var(--text-secondary)" }}>
                    {body}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Tagline className="animate-fade-up" />
        </section>

        {/* ── Sign in ─────────────────────────────────────────────────── */}
        {/* Scrolls on its own only when a window is too short for the form —
            the page itself never does. */}
        <section
          className="relative flex min-h-0 flex-col items-center overflow-y-auto px-6 py-8 sm:px-10"
          style={{ background: "var(--surface-1)", borderLeft: "1px solid var(--border-subtle)" }}
        >
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.55) 35%, rgba(139,92,246,0.40) 65%, transparent 100%)",
            }}
          />

          {/* my-auto centres when there is room and starts at the top when
              there is not — justify-center would clip the top instead. */}
          <div className="my-auto flex w-full flex-col items-center">
            {/* On small screens the brand sits above the form. */}
            <div className="mb-8 lg:hidden">
              <BrandMark />
            </div>

            <div className="w-full max-w-[400px] animate-fade-up" style={{ animationDelay: "90ms" }}>
              {children}
            </div>

            <Tagline className="mt-8 text-center lg:hidden" />
          </div>
        </section>
      </div>
    </div>
  );
}
