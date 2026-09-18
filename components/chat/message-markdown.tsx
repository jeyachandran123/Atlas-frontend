"use client";

import { useEffect, useState, memo, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
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

const components: Components = {
  // Every fenced block becomes a CodeBlock here, at the <pre>, so an untagged
  // fence — the usual shape of a shell step in a walkthrough — gets the same
  // styling and Copy button as a tagged one, and no <pre> wraps a <div>.
  pre({ children }) {
    const child = Array.isArray(children) ? children[0] : children;
    if (isValidElement<{ className?: string; children?: ReactNode }>(child)) {
      const { className, children: code } = child.props;
      // Covers c#, c++, objective-c and the like, which \w+ cut short.
      const language = /language-([\w#+.-]+)/.exec(className ?? "")?.[1] ?? "";
      return <CodeBlock language={language} code={String(code ?? "").replace(/\n$/, "")} />;
    }
    return <pre>{children}</pre>;
  },
  code({ children, className }) {
    return <code className={className}>{children}</code>;
  },
};

/**
 * Split markdown into top-level blocks that can each be parsed on their own.
 *
 * While a reply streams, every token used to re-parse the whole message —
 * about 38 ms per token at 18k characters, so long step-by-step answers
 * stuttered more the longer they got. Finished blocks are memoised, so only
 * the block being written is parsed again. A blank line ends a block only when
 * the next line starts at the margin and no code fence is open: indented lines
 * belong to the list item above them.
 */
function splitBlocks(content: string): string[] {
  const lines = content.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let fence: string | null = null;
  let blankBefore = false;

  for (const line of lines) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence === null && blankBefore && line.trim() !== "" && !/^\s/.test(line) && current.length > 0) {
      blocks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fence === null) fence = marker[0]!.repeat(3);
      else if (marker.startsWith(fence)) fence = null;
    }
    blankBefore = fence === null && line.trim() === "";
  }
  if (current.length > 0) blocks.push(current.join("\n"));
  return blocks;
}

const MarkdownBlock = memo(function MarkdownBlock({ source }: { source: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {source}
    </ReactMarkdown>
  );
});

export const MessageMarkdown = memo(function MessageMarkdown({ content }: { content: string }) {
  const blocks = splitBlocks(content);
  return (
    <div className="assistant-content">
      {blocks.map((block, i) => <MarkdownBlock key={i} source={block} />)}
    </div>
  );
});
