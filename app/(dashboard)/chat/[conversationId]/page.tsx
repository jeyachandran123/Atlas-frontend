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
      <header
        className="flex items-center gap-3 px-5 py-3"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          background: "rgba(7,7,12,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <RepoSelector />
      </header>
      <div className="flex-1 overflow-hidden">
        <ChatThread />
      </div>
    </div>
  );
}
