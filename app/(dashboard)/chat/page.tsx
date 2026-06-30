import { ChatThread } from "@/components/chat/chat-thread";
import { RepoSelector } from "@/components/layout/repo-selector";

export default function ChatPage() {
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
