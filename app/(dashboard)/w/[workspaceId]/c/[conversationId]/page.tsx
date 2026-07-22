"use client";

import { use } from "react";
import { ConversationView } from "@/components/workspace/conversation-view";

export default function WorkspaceConversationPage({
  params,
}: {
  params: Promise<{ workspaceId: string; conversationId: string }>;
}) {
  const { workspaceId, conversationId } = use(params);
  return <ConversationView workspaceId={workspaceId} conversationId={conversationId} />;
}
