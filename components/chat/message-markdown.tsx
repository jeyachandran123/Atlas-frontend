"use client";

import { useEffect, useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { codeToHtml } from "shiki";
import { Copy, Check } from "lucide-react";

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

  return (
    <div className="code-block group">
      {/* Header */}
      <div
        className="flex items-center justify-between py-1.5 pl-4 pr-2"
        style={{
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--code-border)",
        }}
      >
        <span
          className="font-mono text-[11px] lowercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          {language || "code"}
        </span>
        <button
          onClick={copy}
          aria-label="Copy code"
          className="icon-btn gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium"
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
        <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <code className="font-mono">{code}</code>
        </pre>
      )}
    </div>
  );
}

export const MessageMarkdown = memo(function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="assistant-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className || "");
            if (!match) {
              return (
                <code>{children}</code>
              );
            }
           return <CodeBlock language={match[1] ?? "text"} code={String(children).replace(/\n$/, "")} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
