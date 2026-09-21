"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Share2, Check, AlertCircle } from "lucide-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { StreamingMessageBubble } from "@/components/chat/streaming-message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { QuickActions, type QuickStart } from "@/components/chat/quick-actions";
import { PromptNavigator, type PromptEntry } from "@/components/chat/prompt-navigator";
import { ScrollToBottomButton } from "@/components/chat/scroll-to-bottom";
import { ChatMessagesSkeleton } from "@/components/ui/skeleton";
import { useMessages, useStreamChat, useConversations } from "@/lib/hooks/use-chat";
import { useChatStore } from "@/lib/stores/chat-store";
import { useAuthStore } from "@/lib/stores/auth-store";

/** How close to the bottom still counts as "reading the latest". */
const NEAR_BOTTOM_PX = 120;
/** Where a prompt lands when jumped to — a little breathing room above it. */
const JUMP_OFFSET_PX = 16;
/** The gap left above a prompt that was just sent — close to the top, not
 *  flush against it. */
const PIN_TOP_GAP_PX = 28;

/**
 * A stream error as a sentence a person would say. The raw text is an
 * exception or an HTTP status line ("httpx.ReadTimeout: timed out",
 * "Stream request failed: 502 — …") — accurate, and meaningless to the reader.
 */
function humanStreamError(raw: string | null): string {
  const text = (raw ?? "").toLowerCase();
  if (/\b401\b|unauthori[sz]ed|expired|not authenticated/.test(text)) {
    return "Your session expired while I was answering. Refresh the page to sign back in, then try again.";
  }
  if (/\b429\b|rate limit|too many requests/.test(text)) {
    return "I'm getting a lot of requests right now. Give it a few seconds, then try again.";
  }
  if (/timeout|timed out|\b504\b/.test(text)) {
    return "That took longer than it should have, so I stopped waiting. Try again — it usually goes through.";
  }
  if (/failed to fetch|network|connection|\b502\b|\b503\b/.test(text)) {
    return "I lost the connection before I could finish. Try again in a moment.";
  }
  return "Something went wrong on my side while answering. Try again, and if it keeps happening, rephrasing usually helps.";
}

export function ChatThread() {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const selectedRepoId = useChatStore((s) => s.selectedRepoId);
  const streamingConversationId = useChatStore((s) => s.streamingConversationId);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const streamingReasoning = useChatStore((s) => s.streamingReasoning);
  const streamingFileStage = useChatStore((s) => s.streamingFileStage);
  const streamingFile = useChatStore((s) => s.streamingFile);
  const searchStage = useChatStore((s) => s.searchStage);
  const streamingSources = useChatStore((s) => s.streamingSources);
  const streamingSourceImages = useChatStore((s) => s.streamingSourceImages);
  const streamingSearchQuery = useChatStore((s) => s.streamingSearchQuery);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const activeToolCall = useChatStore((s) => s.activeToolCall);
  const streamError = useChatStore((s) => s.streamError);
  const optimisticUserMessage = useChatStore((s) => s.optimisticUserMessage);
  const resetStreamingContent = useChatStore((s) => s.resetStreamingContent);
  const clearOptimisticMessage = useChatStore((s) => s.clearOptimisticMessage);
  const streamEndedAt = useChatStore((s) => s.streamEndedAt);

  // Only show streaming state if it belongs to the currently viewed conversation
  const isActiveStream = isStreaming && streamingConversationId === activeConversationId;
  const activeStreamContent = isActiveStream || (streamingConversationId === activeConversationId && streamingContent)
    ? streamingContent
    : "";
  const showStreamError = streamError && streamingConversationId === activeConversationId;
  const showOptimistic = optimisticUserMessage && streamingConversationId === activeConversationId;

  const { data: messages = [], isLoading, dataUpdatedAt } = useMessages(activeConversationId);
  const { send, editAndResend, retry, deleteMessage, stop } = useStreamChat();

  // The streamed reply stays on screen after the stream ends, until its saved
  // copy is in the list — the refetch takes a moment, and clearing it sooner
  // left the answer blank in between. The hand-over ends when the reply is the
  // last message, or when fresh data from after the stream arrives (a stopped
  // or failed turn saves no reply). Both are decided in the same render the
  // saved copy appears in, so the two never show together.
  const lastMessage = messages[messages.length - 1];
  /** The newest saved prompt — the pin's anchor once the optimistic copy of it
   *  has been replaced. */
  const lastUserId = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]!.role === "user") return messages[i]!.id;
    }
    return undefined;
  })();
  const handingOver =
    !isActiveStream && !streamError && streamEndedAt !== null
    && streamingConversationId === activeConversationId
    && lastMessage?.role !== "assistant" && dataUpdatedAt <= streamEndedAt;

  // A reply that was stopped or failed part-way saves nothing, so the refetch
  // brings back no copy of it. It used to disappear then — the six steps of a
  // walkthrough someone was reading, gone. What was written stays, marked as
  // unfinished, until the next message or conversation replaces it.
  const keptPartial =
    !isActiveStream && !handingOver && streamEndedAt !== null
    && streamingConversationId === activeConversationId
    && !!activeStreamContent && lastMessage?.role !== "assistant";
  const interruptedNote = keptPartial
    ? streamError
      ? "I didn't get to finish this reply."
      : "You stopped this reply here, so it wasn't saved."
    : null;

  // Conversation title for the header (best-effort from the cached list)
  const { data: convData } = useConversations();
  const activeTitle = convData?.conversations.find((c) => c.id === activeConversationId)?.title;

  function handleRetry(messageId: string, content: string) {
    retry(messageId, content, selectedRepoId ?? undefined);
  }

  // A quick-start card fills the prompt box and picks the mode — it never sends.
  function startFromCard(start: QuickStart) {
    const store = useChatStore.getState();
    store.setAgentMode(start.mode);
    store.setComposerDraft({ text: start.text, files: start.files });
  }

  function handleEdit(messageId: string, newContent: string, keep?: string[]) {
    editAndResend(messageId, newContent, selectedRepoId ?? undefined, keep);
  }

  // Last user message for error-banner retry
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content
    ?? (showOptimistic ? optimisticUserMessage?.content : undefined);

  // Index of the last user message that has no assistant reply after it
  const lastUnansweredUserIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") {
        // Check if any assistant message exists after this index
        const hasReply = messages.slice(i + 1).some((m) => m.role === "assistant");
        return hasReply ? -1 : i;
      }
    }
    return -1;
  })();

  // The prompts, in order — what the navigator lists and jumps between.
  const prompts: PromptEntry[] = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user")
        .map((m) => ({
          id: m.id,
          text: m.content?.trim() || m.documents?.[0]?.filename || m.images?.[0]?.filename || "Attachment",
          time: m.created_at,
        })),
    [messages],
  );

  // ── Scrolling ──────────────────────────────────────────────────────────────
  //
  // The rule: follow new content only while the reader is at the bottom. The
  // moment they scroll up, they are reading something, and a streaming reply
  // must not drag them away from it. Following resumes when they come back
  // down on their own, or press the button.
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  // Sending pins your message to the top and lets the reply grow underneath,
  // instead of keeping the view glued to the bottom edge.
  const [pinned, setPinned] = useState(false);
  /** Whether the run-off is being kept sized for the newest prompt. Set by a
   *  send and kept after the pin ends — the run-off must go on shrinking as
   *  the reply grows even once the reader has taken the scroll, or whatever
   *  height it had at that moment is left behind as a dead gap under the
   *  answer. */
  const [runOffLive, setRunOffLive] = useState(false);
  const pinnedRef = useRef(false);
  pinnedRef.current = pinned;
  /** The run-off space under the newest prompt, sized straight on the node.
   *
   *  It was React state with a height transition, and both were wrong: the
   *  state arrived a render later and the transition a further 300ms later,
   *  while the scroll that needed that height ran in the next frame. So the
   *  browser clamped the scroll to a container that had not grown yet and the
   *  prompt stopped short — the same bug the fixed 60dvh had, wearing a
   *  measurement. Writing the height here applies it in the same frame. */
  const spacerRef = useRef<HTMLDivElement>(null);
  /** The message list itself, watched for any change in height. */
  const contentRef = useRef<HTMLDivElement>(null);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const updateActivePrompt = useCallback(() => {
    const el = scrollRef.current;
    if (!el || prompts.length === 0) return;
    const line = el.getBoundingClientRect().top + 96;
    let current = prompts[0]!.id;
    for (const p of prompts) {
      const node = el.querySelector<HTMLElement>(`[data-msg-id="${CSS.escape(p.id)}"]`);
      if (!node) continue;
      if (node.getBoundingClientRect().top <= line) current = p.id;
      else break;
    }
    setActivePromptId(current);
  }, [prompts]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    followRef.current = near;
    setAtBottom(near);
    if (near) setHasNewBelow(false);
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateActivePrompt();
      });
    }
  }

  /** Stop holding the prompt at the top. The run-off is NOT frozen here: the
   *  sizing effect keeps shrinking it as the reply grows, so it only ever
   *  covers screen the reply has not reached yet and reaches zero once the
   *  reply fills the view. Freezing it was the half-screen gap under a
   *  finished answer. */
  const endPin = useCallback(() => setPinned(false), []);

  // A wheel or touch upwards is intent, and it is known before the scroll
  // event lands — acting on it here means the next streamed token cannot win
  // a race against the reader's own hand. Scrolling down is not a reason to
  // let go of the prompt.
  function handleWheel(e: React.WheelEvent) {
    if (e.deltaY < 0) {
      followRef.current = false;
      endPin();
    }
  }
  function handleTouchMove() {
    followRef.current = false;
    endPin();
  }

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    followRef.current = true;
    setHasNewBelow(false);
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  /** How far the view must move to put a message `gap` below the top, and
   *  where that would land. Measured from rectangles rather than offsetTop,
   *  which is relative to whichever ancestor happens to be positioned and was
   *  leaving the prompt short of the top by the height of the wrappers. */
  const topTarget = useCallback((id: string, gap: number) => {
    const el = scrollRef.current;
    const node = el?.querySelector<HTMLElement>(`[data-msg-id="${CSS.escape(id)}"]`);
    if (!el || !node) return null;
    const delta = node.getBoundingClientRect().top - el.getBoundingClientRect().top - gap;
    return { el, top: el.scrollTop + delta };
  }, []);

  /** Sending: stop following the bottom, so the answer can grow below the prompt.
   *  followRef is set here rather than in the effect because the follow effect
   *  runs first on the next render and would scroll to the bottom before the
   *  pin ever happened. */
  function beginPinnedSend() {
    followRef.current = false;
    setHasNewBelow(false);
    // Measured fresh for this send: what the last one needed says nothing
    // about what this one needs.
    if (spacerRef.current) spacerRef.current.style.height = "";
    setRunOffLive(true);
    setPinned(true);
  }

  const jumpToPrompt = useCallback((id: string) => {
    // Same measurement as the pin: offsetTop is relative to whichever ancestor
    // is positioned, so the navigator landed short of the top by the height of
    // the wrappers too.
    const measured = topTarget(id, JUMP_OFFSET_PX);
    if (!measured) return;
    followRef.current = false;
    measured.el.scrollTo({ top: Math.max(0, measured.top), behavior: "smooth" });
    setActivePromptId(id);
    setFlashId(id);
    window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
  }, [topTarget]);

  // Opening a conversation starts at its latest message.
  useEffect(() => {
    followRef.current = true;
    setHasNewBelow(false);
    setAtBottom(true);
    // A conversation opened from the sidebar gets no run-off. A brand-new chat
    // receives its id mid-send, while the pin is still holding — keep that one.
    if (!pinnedRef.current) {
      setRunOffLive(false);
      if (spacerRef.current) spacerRef.current.style.height = "";
    }
  }, [activeConversationId]);

  // Follow new content — instantly, not smoothly: a smooth scroll started on
  // every streamed token is an animation that never finishes, and it fights
  // any scroll the reader starts while it runs.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (followRef.current) {
      // Following the bottom and holding a prompt at the top cannot both be
      // true; following wins here. The run-off stays — while it is sized
      // correctly the bottom of the page IS the pinned position, so this
      // scroll lands where the prompt already was and nothing moves.
      if (pinned) setPinned(false);
      el.scrollTop = el.scrollHeight;
      return;
    }
    // While pinned, the run-off effect below owns the scroll position.
    if (pinned) return;
    if (isActiveStream || activeStreamContent) setHasNewBelow(true);
  }, [messages.length, activeStreamContent, streamingReasoning, isActiveStream,
      showOptimistic, pinned]);

  /**
   * Hold the newest prompt at the top while its reply fills the screen.
   *
   * The run-off underneath shrinks by exactly what the reply grows, so the
   * scrollable height never changes and the prompt cannot move. Removing it
   * outright once the reply was long enough is what threw the view to the
   * middle: the height vanished, the browser clamped the scroll, everything
   * slid. Nothing is removed here — by the time the reply outgrows the screen
   * the run-off is already zero, so following the bottom carries on from where
   * the text is.
   *
   * It is driven by a ResizeObserver rather than by React dependencies,
   * because the things that change the height are not all state this component
   * watches: streamed text, the sources block arriving, an image finishing its
   * load, and the optimistic prompt being swapped for the saved one. Every
   * dependency list I wrote missed one of them, and a missed change is a jump.
   */
  //
  // The run-off is sized on every resize for as long as it is live — pinned or
  // not — so it is never taller than the screen the reply has yet to fill.
  // Only the scroll-holding depends on the pin.
  useEffect(() => {
    if (!runOffLive) return;
    const el = scrollRef.current;
    const spacer = spacerRef.current;
    const content = contentRef.current;
    if (!el || !spacer || !content) return;

    const apply = () => {
      // The last anchor: the optimistic prompt while it exists, the saved one
      // once it has taken over.
      const anchors = el.querySelectorAll<HTMLElement>("[data-pin-anchor]");
      const node = anchors[anchors.length - 1];
      if (!node) return;

      const promptTop =
        node.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      const replyHeight = el.scrollHeight - spacer.offsetHeight - promptTop;
      const runOff = el.clientHeight - PIN_TOP_GAP_PX - replyHeight;

      spacer.style.height = runOff > 0 ? `${Math.ceil(runOff)}px` : "";

      if (pinnedRef.current) {
        if (runOff > 0) {
          el.scrollTop = Math.max(0, promptTop - PIN_TOP_GAP_PX);
        } else {
          // The reply has reached the composer: from here the stream runs on
          // down the screen with the view following it.
          pinnedRef.current = false;
          setPinned(false);
          followRef.current = true;
          el.scrollTop = el.scrollHeight;
        }
      } else if (followRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(content);
    return () => observer.disconnect();
  }, [runOffLive]);

  // There is deliberately no second effect placing the prompt. One did the
  // first placement on a frame callback while the effect above adjusted the
  // run-off on every token, and the two wrote the same scroll position from
  // different measurements — which is the jump. Placement and growth are one
  // rule now, applied in one place.

  // A finished reply deliberately releases nothing. Closing the run-off the
  // moment a reply ended was the jump: its text was on screen, the page shrank
  // under it, and the whole conversation slid down. A short reply is meant to
  // sit with its prompt at the top and the rest of the screen empty — that is
  // what the run-off is. The pin ends itself when a reply outgrows the screen,
  // or when the reader scrolls.

  useEffect(() => { updateActivePrompt(); }, [updateActivePrompt]);
  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  // Once the saved reply has taken its place, the streamed copy is done with.
  // A failed turn keeps its prompt for the error banner's retry, and a stopped
  // turn with text keeps that text (keptPartial) — nothing saved replaces it.
  const lastIsAssistant = lastMessage?.role === "assistant";
  useEffect(() => {
    if (
      !isActiveStream && streamEndedAt !== null && !handingOver && !streamError
      && (lastIsAssistant || !streamingContent)
    ) {
      resetStreamingContent();
      clearOptimisticMessage();
    }
  }, [
    isActiveStream, streamEndedAt, handingOver, streamError, lastIsAssistant, streamingContent,
    resetStreamingContent, clearOptimisticMessage,
  ]);

  const isEmpty = messages.length === 0 && !isActiveStream && !isLoading && !showOptimistic;

  const [copied, setCopied] = useState(false);

  function handleShareConversation() {
    const text = messages
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: "${m.content}"`)
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Conversation header */}
      {!isEmpty && (
        <div
          className="glass sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-3 px-3 sm:gap-4 sm:px-5"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <p
            className="truncate text-[13px] font-medium"
            style={{ color: "var(--text-secondary)", letterSpacing: "-0.01em" }}
          >
            {activeTitle || "Conversation"}
          </p>
          <button
            onClick={handleShareConversation}
            title="Copy conversation"
            className="ghost-btn flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium"
            style={copied ? { color: "var(--success)" } : undefined}
          >
            {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
            {/* The icon carries the meaning when there is no room for the word. */}
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </button>
        </div>
      )}

      {/* Message area. The navigator overlays exactly this region, so it can
          never run under the header above or the composer below. */}
      <div className="relative min-h-0 flex-1">
        <div
          className={`absolute inset-0 ${isEmpty ? "overflow-hidden" : "overflow-y-auto"}`}
          ref={scrollRef}
          onScroll={handleScroll}
          onWheel={handleWheel}
          onTouchMove={handleTouchMove}
        >
          {isEmpty ? (
            <EmptyState onStart={startFromCard} />
          ) : isLoading && messages.length === 0 && !showOptimistic ? (
            <div className="mx-auto max-w-[768px] px-4 py-6 sm:px-6 sm:py-8">
              <ChatMessagesSkeleton />
            </div>
          ) : (
            <div ref={contentRef} className="mx-auto max-w-[768px] px-4 py-6 sm:px-6 sm:py-8">
              <div className="flex flex-col gap-7">
                {messages.map((m, i) => (
                  <div
                    key={m.id}
                    data-msg-id={m.id}
                    // The pin follows this marker rather than an id, because the
                    // message it holds is replaced mid-reply: the optimistic
                    // copy gives way to the saved one under a different id, and
                    // an id-based lookup stops finding anything at that moment.
                    data-pin-anchor={m.role === "user" && m.id === lastUserId ? "" : undefined}
                    className="-mx-3 rounded-2xl px-3 py-1 transition-[box-shadow,background-color] duration-700 ease-out"
                    style={flashId === m.id ? {
                      background: "var(--accent-subtle)",
                      boxShadow: "0 0 0 1px var(--accent-border), 0 0 28px rgba(99,102,241,0.18)",
                    } : undefined}
                  >
                    <MessageBubble
                      message={m}
                      onRetry={m.role === "user" && i === lastUnansweredUserIdx && !isActiveStream
                        ? (id, content) => handleRetry(id, content)
                        : undefined}
                      onEdit={m.role === "user" && !isActiveStream
                        ? (id, newContent, keep) => handleEdit(id, newContent, keep)
                        : undefined}
                      onDelete={m.role === "user" && !isActiveStream ? (id) => deleteMessage(id) : undefined}
                      isLastUserWithoutReply={m.role === "user" && i === lastUnansweredUserIdx && !isActiveStream}
                      isLast={i === messages.length - 1 && !isActiveStream}
                      onClarifySubmit={(text) => {
                        beginPinnedSend();
                        send(text, selectedRepoId ?? undefined, useChatStore.getState().agentMode);
                      }}
                    />
                  </div>
                ))}

                {showOptimistic &&
                  !messages.find((m) => m.content === optimisticUserMessage!.content && m.role === "user") && (
                    // Wrapped like the saved messages above: the pin finds it by
                    // data-msg-id, and without the wrapper the message you just
                    // sent is the one thing on screen that cannot be scrolled to.
                    <div key={optimisticUserMessage!.id} data-msg-id={optimisticUserMessage!.id} data-pin-anchor="" className="-mx-3 px-3 py-1">
                      <MessageBubble message={optimisticUserMessage!} />
                    </div>
                  )}

                {(isActiveStream || handingOver || keptPartial) && (
                  <StreamingMessageBubble content={activeStreamContent} activeToolCall={activeToolCall} reasoning={isActiveStream ? streamingReasoning : ""} fileStage={isActiveStream ? streamingFileStage : null} file={streamingConversationId === activeConversationId ? streamingFile : null} searchStage={isActiveStream ? searchStage : null} sources={isActiveStream ? streamingSources : []} sourceImages={isActiveStream ? streamingSourceImages : []} searchQuery={isActiveStream ? streamingSearchQuery : null} interrupted={interruptedNote} />
                )}

                {showStreamError && (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-[13px] animate-fade-in-up"
                    style={{
                      background: "var(--danger-bg)",
                      border: "1px solid var(--danger-border)",
                      color: "var(--danger)",
                    }}
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      {/* The raw error stays in the tooltip for whoever is debugging. */}
                      <span title={streamError ?? undefined}>{humanStreamError(streamError)}</span>
                    </div>
                    {lastUserMessage && (
                      <button
                        onClick={() => {
                          const lastMsg = [...messages].reverse().find((m) => m.role === "user");
                          if (lastMsg) handleRetry(lastMsg.id, lastMsg.content);
                        }}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                        style={{ background: "var(--danger-border)", color: "var(--danger)" }}
                      >
                        <RotateCcw className="size-3" /> Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
              {/* Room to scroll into. A prompt can only reach the top if there is
                  height beneath it, so while a reply is in flight this opens up
                  and then collapses — a permanent tall spacer would leave a dead
                  gap under every finished conversation. */}
              <div ref={spacerRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Prompt navigator — right edge of the message area */}
        {!isEmpty && (
          <PromptNavigator prompts={prompts} activeId={activePromptId} onJump={jumpToPrompt} />
        )}
      </div>

      {/* Input */}
      {/* The composer sits against the bottom of the viewport, so on a phone its
          padding has to clear the home indicator — env() resolves to 0 anywhere
          that has no inset, which is why max() is safe on every device. */}
      <div
        className="px-3 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5"
        style={{ background: "linear-gradient(to top, var(--canvas) 60%, transparent)" }}
      >
        <div className="relative mx-auto max-w-[768px]">
          {!isEmpty && (
            <ScrollToBottomButton
              visible={!atBottom}
              hasNew={hasNewBelow}
              onClick={() => scrollToBottom("smooth")}
            />
          )}
          <ChatInput
            onSend={(msg, files, agentId) => {
              // Your message goes to the top and the answer grows underneath it.
              beginPinnedSend();
              send(msg, selectedRepoId ?? undefined, agentId ?? "auto", files);
            }}
            onStop={stop}
            isStreaming={isActiveStream}
          />
          <p className="mt-2.5 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
            UnityWorks can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function EmptyState({ onStart }: { onStart: (start: QuickStart) => void }) {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.full_name?.split(" ")[0];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-4 sm:px-6">
      <div className="mt-8 w-full max-w-[640px]">

        {/* Hero */}
        <div className="mb-7 flex flex-col items-center text-center animate-fade-up sm:mb-10">
          {/* Logo */}
          <div className="relative mb-5 sm:mb-7">
            <div
              className="absolute inset-0 rounded-3xl blur-2xl"
              style={{
                background: "var(--accent-gradient)",
                transform: "scale(1.7)",
                opacity: 0.26,
              }}
            />
            <div
              className="relative flex size-[52px] items-center justify-center rounded-[20px] sm:size-[64px]"
              style={{
                background: "var(--accent-gradient)",
                boxShadow: "0 0 0 1px var(--accent-border), 0 12px 40px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <div
                className="absolute inset-0 rounded-[20px]"
                style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.14) 0%, transparent 50%)" }}
              />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="relative z-10">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.95" />
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
              </svg>
            </div>
          </div>

          <h1
            className="text-[23px] font-semibold sm:text-[30px]"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.035em", lineHeight: 1.15 }}
          >
            {firstName ? `${greeting()}, ${firstName}` : greeting()}
          </h1>
          <p
            className="mt-3 max-w-[420px] text-[13px] leading-relaxed sm:text-[14px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Ask anything — or bring a document, a spreadsheet or your code, and I&apos;ll answer from it,
            analyse it, or turn it into a file.
          </p>
        </div>

        {/* Quick actions */}
        <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
          <QuickActions onPick={onStart} />
        </div>
      </div>
    </div>
  );
}
