"use client";

import { useEffect, useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { codeToHtml } from "shiki";
import { cn } from "@/lib/utils/cn";

/**
 * Renders assistant message content. Code blocks are highlighted with
 * Shiki using the same TextMate grammars VS Code uses — chosen over
 * Prism/highlight.js specifically so code rendered here looks like what
 * a developer already expects from their editor, not "chatbot code."
 */

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang: language || "text",
      theme: "github-dark-default",
    })
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  if (!html) {
    return (
      <pre className="overflow-x-auto rounded-md border border-border bg-canvas p-3 text-sm">
        <code className="font-mono">{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:p-3 [&_pre]:text-sm [&_pre]:!bg-canvas"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const MessageMarkdown = memo(function MessageMarkdown({ content }: { content: string }) {
  return (
    <div
      className={cn(
        "prose prose-invert prose-sm max-w-none",
        "prose-p:text-text-primary prose-headings:text-text-primary",
        "prose-strong:text-text-primary prose-code:text-signal-glow prose-code:before:content-none prose-code:after:content-none",
        "prose-a:text-signal prose-a:no-underline hover:prose-a:underline",
        "prose-pre:bg-transparent prose-pre:p-0",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className, ...rest } = props;
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  className="rounded bg-surface-overlay px-1.5 py-0.5 font-mono text-[0.85em]"
                  {...rest}
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
