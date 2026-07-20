"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatThread } from "@/components/chat/chat-thread";
import { useChatStore } from "@/lib/stores/chat-store";

/**
 * /chat/[conversationId] — the canonical route for an existing conversation.
 * The URL is the source of truth: deep links, refresh, and back/forward all
 * land here and hydrate the store from the path parameter.
 */
export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  useEffect(() => {
    setActiveConversation(params.conversationId);
  }, [params.conversationId, setActiveConversation]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <ChatThread />
      </div>
    </div>
  );
}
