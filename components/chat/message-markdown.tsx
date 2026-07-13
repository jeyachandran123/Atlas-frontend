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
