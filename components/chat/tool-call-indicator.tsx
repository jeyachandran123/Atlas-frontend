"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileSearch, GitBranch, Terminal, Search, Loader2 } from "lucide-react";
import type { ActiveToolCall } from "@/lib/stores/chat-store";

const TOOLS: Record<string, { icon: typeof Search; label: string; color: string; bg: string }> = {
  file_tool:     { icon: FileSearch, label: "Reading file",      color: "#60a5fa", bg: "rgba(96,165,250,0.08)" },
  git_tool:      { icon: GitBranch,  label: "Checking git",      color: "#fb923c", bg: "rgba(251,146,60,0.08)" },
  terminal_tool: { icon: Terminal,   label: "Running command",   color: "#4ade80", bg: "rgba(74,222,128,0.08)" },
  search_tool:   { icon: Search,     label: "Searching code",    color: "#818cf8", bg: "rgba(99,102,241,0.08)" },
};
const DEFAULT = { icon: Search, label: "Working", color: "#818cf8", bg: "rgba(99,102,241,0.08)" };

export function ToolCallIndicator({ call }: { call: ActiveToolCall | null }) {
  return (
    <AnimatePresence mode="wait">
      {call && (() => {
        const t = TOOLS[call.toolName] ?? DEFAULT;
        const Icon = t.icon;
        return (
          <motion.div
            key={call.toolName + call.startedAt}
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium"
            style={{ background: t.bg, border: `1px solid ${t.color}22`, color: t.color }}
          >
            <Loader2 className="size-3 animate-spin opacity-60" />
            <Icon className="size-3" />
            <span>{t.label}</span>
            {call.rationale && (
              <span className="max-w-[200px] truncate opacity-50">— {call.rationale}</span>
            )}
          </motion.div>
        );
      })()}
    </AnimatePresence>
  );
}
