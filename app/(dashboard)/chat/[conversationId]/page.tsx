"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ChatThread } from "@/components/chat/chat-thread";
import { RepoSelector } from "@/components/layout/repo-selector";
import { useChatStore } from "@/lib/stores/chat-store";

export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  useEffect(() => {
    setActiveConversation(params.conversationId);
    return () => setActiveConversation(null);
  }, [params.conversationId, setActiveConversation]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <RepoSelector />
      </header>
      <div className="flex-1 overflow-hidden">
        <ChatThread />
      </div>
    </div>
  );
}
