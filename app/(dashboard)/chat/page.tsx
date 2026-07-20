"use client";

import { useEffect } from "react";
import { ChatThread } from "@/components/chat/chat-thread";
import { useChatStore } from "@/lib/stores/chat-store";

/**
 * /chat — the new-chat home (ChatGPT-style).
 *
 * No conversation exists yet: the backend creates one on the first message,
 * and use-chat adopts it into the URL via history.replaceState → /chat/{id}
 * without remounting this page (the stream is never interrupted).
 * Existing conversations live at /chat/[conversationId].
 */
export default function ChatPage() {
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  useEffect(() => {
    // Fresh start whenever the home route mounts. Guard against clobbering a
    // just-adopted conversation: adoption rewrites the URL in place, so if
    // the path already carries an id, this mount is stale history traversal.
    if (window.location.pathname === "/chat") {
      setActiveConversation(null);
    }
  }, [setActiveConversation]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <ChatThread />
      </div>
    </div>
  );
}
