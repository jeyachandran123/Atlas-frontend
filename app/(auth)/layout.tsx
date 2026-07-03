export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen overflow-hidden"
      style={{ background: "var(--canvas)" }}
    >
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
          className="absolute -bottom-72 -right-64 h-[800px] w-[800px] rounded-full animate-orb-slow"
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
          maskImage: "radial-gradient(ellipse 75% 75% at 50% 50%, black 20%, transparent 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-4 py-4 min-h-screen">

        {/* Brand mark */}
        <div className="mb-5 flex items-center gap-3 animate-fade-up">
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
            <h1
              className="text-[18px] font-semibold"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
            >
              Atlas
            </h1>
            <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              AI Coding Assistant
            </p>
          </div>
        </div>

        {/* Auth card */}
        <div
          className="w-full max-w-[380px] animate-fade-up"
          style={{ animationDelay: "60ms" }}
        >
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-xl), 0 0 0 1px rgba(99,102,241,0.05)",
            }}
          >
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.55) 35%, rgba(139,92,246,0.40) 65%, transparent 100%)",
              }}
            />
            <div className="p-6">{children}</div>
          </div>
        </div>

        <p
          className="mt-5 text-center text-[11px] animate-fade-up"
          style={{ color: "var(--text-muted)", animationDelay: "120ms" }}
        >
          Self-hosted · Secure · Grounded in your codebase
        </p>
      </div>
    </div>
  );
}
