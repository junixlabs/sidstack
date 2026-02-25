import { Bot, User } from "lucide-react";

import { MarkdownPreview } from "@/components/MarkdownPreview";
import { cn } from "@/lib/utils";
import type { SidBotMessage as SidBotMessageType } from "@/stores/sidBotStore";

interface SidBotMessageProps {
  message: SidBotMessageType;
  isStreaming?: boolean;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function SidBotMessage({ message, isStreaming }: SidBotMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn(
      "flex gap-2 px-3",  // Equal padding both sides
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar - flex-shrink-0 to prevent shrinking */}
      <div
        className={cn(
          "w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5",
          isUser
            ? "bg-[var(--surface-3)]"
            : "bg-[var(--surface-2)] border border-[var(--border-muted)]",
        )}
      >
        {isUser ? (
          <User className="w-3 h-3 text-[var(--text-muted)]" />
        ) : (
          <Bot className="w-3 h-3 text-[var(--text-muted)]" />
        )}
      </div>

      {/* Content - min-w-0 to allow shrinking below content size */}
      <div
        className={cn(
          "rounded-lg text-sm min-w-0 overflow-hidden",
          isUser
            ? "max-w-[85%] bg-[var(--surface-3)] text-[var(--text-primary)] px-3 py-2"
            : "flex-1 text-[var(--text-secondary)]",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <>
            <MarkdownPreview
              content={message.content + (isStreaming ? "▊" : "")}
              compact
              className="text-sm"
            />
            {/* Token usage badge */}
            {!isStreaming && message.usage && message.usage.totalTokens > 0 && (
              <div className="flex items-center flex-wrap gap-1.5 mt-2 text-[11px] text-[var(--text-muted)]">
                <span className="px-1.5 py-0.5 rounded bg-[var(--surface-3)] font-medium">
                  {message.route || "gemini"}
                </span>
                <span className="text-[var(--text-muted)]/60">·</span>
                <span>{formatTokens(message.usage.totalTokens)} tokens</span>
                <span className="text-[var(--text-muted)]/40">
                  ({formatTokens(message.usage.promptTokens)}↑ {formatTokens(message.usage.completionTokens)}↓)
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
