"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileSearch, GitBranch, Terminal, Search } from "lucide-react";
import type { ActiveToolCall } from "@/lib/stores/chat-store";

const TOOL_ICON: Record<string, typeof FileSearch> = {
  file_tool: FileSearch,
  git_tool: GitBranch,
  terminal_tool: Terminal,
  search_tool: Search,
};

const TOOL_LABEL: Record<string, string> = {
  file_tool: "Reading file",
  git_tool: "Checking git",
  terminal_tool: "Running command",
  search_tool: "Searching codebase",
};

/**
 * The product's signature motion: when the agent invokes a tool mid-stream,
 * a quiet badge appears showing exactly what it's doing — not a generic
 * "thinking..." spinner. This is the moment that should make Atlas feel
 * different from a chatbot wrapper: the user sees the agent actually
 * working the codebase.
 */
export function ToolCallIndicator({ call }: { call: ActiveToolCall | null }) {
  return (
    <AnimatePresence mode="wait">
      {call && (
        <motion.div
          key={call.toolName + call.startedAt}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2 rounded-md border border-signal/20 bg-signal/5 px-3 py-1.5 text-xs text-signal-glow"
        >
          <ToolIcon name={call.toolName} />
          <span className="font-mono">{TOOL_LABEL[call.toolName] ?? call.toolName}</span>
          {call.rationale && (
            <span className="text-text-tertiary truncate max-w-[280px]">— {call.rationale}</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToolIcon({ name }: { name: string }) {
  const Icon = TOOL_ICON[name] ?? Search;
  return <Icon className="size-3.5 animate-signal-pulse" />;
}
