"use client";

import { ChatThread } from "@/components/chat/chat-thread";

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <ChatThread />
      </div>
    </div>
  );
}
