"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenCheck, SendHorizonal, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageMarkdown } from "@/components/chat/message-markdown";
import { ASK_STAGE_LABELS, StageIndicator } from "@/components/knowledge/stage-indicator";
import { knowledgeApi, streamAsk } from "@/lib/api/knowledge";
import type { Citation } from "@/types/knowledge";

interface TurnView {
  question: string;
  answer: string;
  grounded: boolean | null;   // null while streaming
  citations: Citation[];
  refusalReason: string | null;
  error: string | null;
}

export function KnowledgeChat({ documentId }: { documentId: string | null }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<TurnView[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<string[]>([]);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, stages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(async () => {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    setStages([]);
    setCurrentStage(null);
    setTurns((t) => [...t, {
      question, answer: "", grounded: null, citations: [], refusalReason: null, error: null,
    }]);

    let convId = conversationId;
    if (!convId) {
      const conv = await knowledgeApi.createConversation(question.slice(0, 80));
      convId = conv.id;
      setConversationId(convId);
    }

    const update = (patch: Partial<TurnView>) =>
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, ...patch } : turn)));

    abortRef.current = streamAsk(
      convId, question, documentId,
      (e) => {
        if (e.event === "stage") {
          const s = e.data.stage;
          setStages((prev) => (prev.includes(s) ? prev : [...prev, s]));
          setCurrentStage(s);
        } else if (e.event === "token") {
          setCurrentStage(null);
          setTurns((t) => t.map((turn, i) =>
            i === t.length - 1 ? { ...turn, answer: turn.answer + e.data.text } : turn));
        } else if (e.event === "citations") {
          update({ citations: e.data.citations, grounded: e.data.grounded });
        } else if (e.event === "done") {
          update({
            refusalReason: e.data.refusal_reason,
            ...(e.data.answer ? { answer: e.data.answer } : {}),
          });
        } else if (e.event === "error") {
          update({ error: e.data.message, grounded: false });
        }
      },
      (err) => { update({ error: err.message, grounded: false }); setBusy(false); setCurrentStage(null); },
      () => { setBusy(false); setStages([]); setCurrentStage(null); },
    );
  }, [input, busy, conversationId, documentId]);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {turns.length === 0 && (
          <div className="mt-16 text-center">
            <BookOpenCheck className="mx-auto mb-3 size-8" style={{ color: "var(--text-muted)" }} />
            <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
              Ask anything about your documents
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
              Answers are grounded in your knowledge base and always cite their sources.
            </p>
          </div>
        )}
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {turns.map((turn, i) => (
            <div key={i} className="flex flex-col gap-3">
              {/* Question */}
              <div className="self-end rounded-2xl rounded-br-md px-4 py-2.5 text-[13.5px]"
                style={{ background: "var(--surface-3)", color: "var(--text-primary)", maxWidth: "85%" }}>
                {turn.question}
              </div>
              {/* Live stage progress for the in-flight turn */}
              {i === turns.length - 1 && busy && stages.length > 0 && !turn.answer && (
                <div className="rounded-xl px-4 py-3"
                  style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
                  <StageIndicator stages={stages} current={currentStage} labels={ASK_STAGE_LABELS} />
                </div>
              )}
              {/* Answer */}
              {(turn.answer || turn.error) && (
                <div className="rounded-2xl rounded-bl-md px-4 py-3"
                  style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", maxWidth: "95%" }}>
                  {turn.error ? (
                    <p className="text-[13px]" style={{ color: "var(--status-error)" }}>{turn.error}</p>
                  ) : (
                    <MessageMarkdown content={turn.answer} />
                  )}
                  {turn.grounded !== null && !turn.error && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {turn.grounded ? (
                        <Badge variant="ready"><ShieldCheck className="size-3" /> Grounded</Badge>
                      ) : (
                        <Badge variant="pending"><ShieldAlert className="size-3" />
                          {turn.refusalReason === "unsupported_request" ? "Not supported" : "No source found"}
                        </Badge>
                      )}
                      {turn.citations.map((c) => (
                        <Badge key={c.source_id} variant="info" title={
                          `${c.section || "document"}${c.page != null ? ` · page ${c.page}` : ""} · confidence ${(c.confidence * 100).toFixed(0)}%`
                        }>
                          {c.source_id}{c.page != null ? ` · p.${c.page}` : ""}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-6 pb-5">
        <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl p-2"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); }
            }}
            rows={1}
            placeholder={documentId ? "Ask about the selected document…" : "Ask about your documents…"}
            className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] outline-none"
            style={{ color: "var(--text-primary)" }}
            disabled={busy}
          />
          <Button size="icon-sm" variant="signal" onClick={() => void ask()} disabled={busy || !input.trim()}
            aria-label="Send question">
            <SendHorizonal />
          </Button>
        </div>
      </div>
    </div>
  );
}
