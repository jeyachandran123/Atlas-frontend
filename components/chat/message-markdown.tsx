"use client";

import {
  useEffect, useState, useMemo, memo, isValidElement, cloneElement, type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { codeToHtml } from "shiki";
import { Copy, Check } from "lucide-react";
import type { WebSourceOut } from "@/types/api";

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

/**
 * A run of citation markers, as one chip naming where the claim came from.
 *
 * The model writes [1], and often [1][2][3][4][5][6] on a single claim, which
 * as bare digits is noise the reader has to decode against a list they cannot
 * see. One chip carries the same information in the form people already know
 * from search results: whose page it was, and how many others agreed.
 *
 * With no sources — an answer the model gave from its own knowledge — the
 * markers are removed entirely. They would be pointing at nothing.
 */
function siteName(source: WebSourceOut): string {
  const host = (source.domain || "").replace(/\.(com|org|net|co\.uk|io|ai|in|sg|gov|edu)$/i, "");
  const last = host.split(".").pop() || host;
  return last ? last.charAt(0).toUpperCase() + last.slice(1) : "Source";
}

function Cite({ cited }: { cited: WebSourceOut[] }) {
  const [iconFailed, setIconFailed] = useState(false);
  const first = cited[0]!;
  const extra = cited.length - 1;
  return (
    <a
      href={first.url}
      target="_blank"
      rel="noopener noreferrer"
      title={cited.map((s) => `${s.domain} — ${s.title}`).join("\n")}
      className="mx-0.5 inline-flex max-w-[190px] translate-y-[-1px] items-center gap-1 rounded-full px-1.5 py-0.5 align-middle text-[10.5px] font-medium no-underline transition-colors hover:brightness-110"
      style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}
    >
      {first.favicon_url && !iconFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={first.favicon_url}
          alt=""
          className="size-3 shrink-0 rounded-[2px]"
          onError={() => setIconFailed(true)}
        />
      ) : (
        <span
          className="size-3 shrink-0 rounded-[2px]"
          style={{ background: "var(--accent-subtle)" }}
        />
      )}
      <span className="truncate">{siteName(first)}</span>
      {extra > 0 && <span style={{ color: "var(--text-muted)" }}>+{extra}</span>}
    </a>
  );
}

/** One or more adjacent markers: "[1]", "[1][2]", "[1] [2] [3]". */
const CITATION_RUN = /(\[\d{1,2}\](?:\s*\[\d{1,2}\])*)/g;
const IS_RUN = /^\[\d{1,2}\](\s*\[\d{1,2}\])*$/;
// "arr[0]", "items[12]" — an index written in prose, not a citation. Without
// this the chip resolved to nothing, rendered null, and quietly ate the "arr".
const ATTACHED_TO_WORD = /[\w\])]$/;

/**
 * Replace citation runs inside rendered text with chips.
 *
 * Recurses so a marker inside **bold** is caught too, and stops at code so a
 * literal "[1]" in a snippet is left exactly as written.
 */
function withCitations(node: ReactNode, sources: WebSourceOut[], key = 0): ReactNode {
  if (typeof node === "string") {
    if (!node.includes("[")) return node;
    const parts = node.split(CITATION_RUN);
    if (parts.length === 1) return node;
    return parts.map((part, i) => {
      if (!IS_RUN.test(part)) return part;
      // An index like "arr[0]" is attached to the word before it; a citation
      // follows a space or a full stop.
      const before = i > 0 ? parts[i - 1] ?? "" : "";
      if (ATTACHED_TO_WORD.test(before)) return part;

      const refs = [...part.matchAll(/\d{1,2}/g)].map((m) => Number(m[0]));
      const cited = refs
        .map((n) => sources[n - 1])
        .filter((s): s is WebSourceOut => Boolean(s));
      // Nothing was searched, so a marker points at nothing: drop it. That is
      // an answer the model gave from its own knowledge.
      if (sources.length === 0) return null;
      // Sources exist but these numbers are not among them — leave the text
      // alone rather than deleting something we failed to understand.
      if (cited.length === 0) return part;
      return <Cite key={`${key}-${i}`} cited={cited} />;
    });
  }
  if (Array.isArray(node)) {
    return node.map((child, i) => withCitations(child, sources, i));
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    const type = node.type;
    if (type === "code" || type === "pre" || type === CodeBlock) return node;
    const children = node.props.children;
    if (children === undefined) return node;
    return cloneElement(node, undefined, withCitations(children, sources, key));
  }
  return node;
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

/** The same renderers, with citation markers turned into source chips. */
function citingComponents(sources: WebSourceOut[]): Components {
  const decorate =
    (Tag: "p" | "li" | "td" | "th" | "h1" | "h2" | "h3" | "h4" | "blockquote") =>
    ({ children, ...rest }: { children?: ReactNode }) => (
      <Tag {...rest}>{withCitations(children, sources)}</Tag>
    );
  return {
    ...components,
    p: decorate("p"),
    li: decorate("li"),
    td: decorate("td"),
    th: decorate("th"),
    h1: decorate("h1"),
    h2: decorate("h2"),
    h3: decorate("h3"),
    h4: decorate("h4"),
    blockquote: decorate("blockquote"),
  };
}

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

const MarkdownBlock = memo(function MarkdownBlock({
  source, renderers,
}: {
  source: string;
  renderers: Components;
}) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={renderers}>
      {source}
    </ReactMarkdown>
  );
});

export const MessageMarkdown = memo(function MessageMarkdown({
  content, sources,
}: {
  content: string;
  /** The pages this answer cites. Without them a "[1]" points at nothing and
   *  is stripped, which is what an answer from the model's own knowledge
   *  should show. */
  sources?: WebSourceOut[];
}) {
  const blocks = splitBlocks(content);
  // A new object every render would defeat the per-block memo that keeps long
  // streaming replies from stuttering, so the renderers are built once per
  // source list.
  const renderers = useMemo(
    () => (sources && sources.length ? citingComponents(sources) : citingComponents([])),
    [sources],
  );
  return (
    <div className="assistant-content">
      {blocks.map((block, i) => <MarkdownBlock key={i} source={block} renderers={renderers} />)}
    </div>
  );
});
