"use client";

import { useEffect, useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { codeToHtml } from "shiki";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

function useIsDark() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const check = () => setDark(document.documentElement.getAttribute("data-theme") !== "light");
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isDark = useIsDark();

  useEffect(() => {
    let cancelled = false;
    const theme = isDark ? "github-dark-default" : "github-light";
    codeToHtml(code, { lang: language || "text", theme })
      .then((r) => { if (!cancelled) setHtml(r); })
      .catch(() => { if (!cancelled) setHtml(null); });
    return () => { cancelled = true; };
  }, [code, language, isDark]);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const headerBg = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
  const headerBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const langColor = isDark ? "#6e7681" : "#57606a";
  const copyColor = isDark ? "#6e7681" : "#57606a";
  const copyHoverColor = isDark ? "#c9d1d9" : "#24292f";
  const copyHoverBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const fallbackColor = isDark ? "#c9d1d9" : "#24292f";

  return (
    <div className="code-block group">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          background: headerBg,
          borderBottom: `1px solid ${headerBorder}`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: "#ff5f57" }} />
            <span className="size-2.5 rounded-full" style={{ background: "#febc2e" }} />
            <span className="size-2.5 rounded-full" style={{ background: "#28c840" }} />
          </div>
          {language && (
            <span
              className="font-mono text-[10px] uppercase tracking-widest"
              style={{ color: langColor }}
            >
              {language}
            </span>
          )}
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all"
          style={{ color: copyColor }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = copyHoverColor;
            (e.currentTarget as HTMLButtonElement).style.background = copyHoverBg;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = copyColor;
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          {copied
            ? <><Check className="size-3" style={{ color: "#34d399" }} /> Copied</>
            : <><Copy className="size-3" /> Copy</>
          }
        </button>
      </div>

      {/* Code */}
      {html ? (
        <div
          className="overflow-x-auto text-[13px] [&_pre]:m-0 [&_pre]:p-4 [&_pre]:!bg-transparent [&_pre]:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed" style={{ color: fallbackColor }}>
          <code className="font-mono">{code}</code>
        </pre>
      )}
    </div>
  );
}

export const MessageMarkdown = memo(function MessageMarkdown({ content }: { content: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none",
        /* Base text */
        "prose-p:leading-[1.78] prose-p:my-2",
        /* Headings */
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-h1:text-[19px] prose-h2:text-[16px] prose-h3:text-[14px]",
        "prose-h1:mt-5 prose-h2:mt-4 prose-h3:mt-3",
        /* Inline code */
        "prose-code:before:content-none prose-code:after:content-none",
        /* Links */
        "prose-a:no-underline hover:prose-a:underline",
        /* Lists */
        "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
        /* Blockquote */
        "prose-blockquote:not-italic",
        /* Pre — handled by CodeBlock, give it breathing room */
        "prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-3",
      )}
      style={{
        "--tw-prose-body": "var(--text-primary)",
        "--tw-prose-headings": "var(--text-primary)",
        "--tw-prose-lead": "var(--text-secondary)",
        "--tw-prose-links": "var(--accent-glow)",
        "--tw-prose-bold": "var(--text-primary)",
        "--tw-prose-counters": "var(--text-tertiary)",
        "--tw-prose-bullets": "var(--text-muted)",
        "--tw-prose-hr": "var(--border-default)",
        "--tw-prose-quotes": "var(--text-secondary)",
        "--tw-prose-quote-borders": "var(--accent-border)",
        "--tw-prose-captions": "var(--text-tertiary)",
        "--tw-prose-code": "var(--accent-glow)",
        "--tw-prose-pre-code": "#c9d1d9",
        "--tw-prose-pre-bg": "#0d0d14",
        "--tw-prose-th-borders": "var(--border-default)",
        "--tw-prose-td-borders": "var(--border-subtle)",
      } as React.CSSProperties}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className || "");
            if (!match) {
              return (
                <code
                  className="rounded-md px-1.5 py-0.5 font-mono text-[0.85em]"
                  style={{
                    background: "var(--accent-subtle)",
                    border: "1px solid var(--accent-border)",
                    color: "var(--accent-glow)",
                  }}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock language={match[1]} code={String(children).replace(/\n$/, "")} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
