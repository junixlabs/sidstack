import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useSidBotStore } from "@/stores/sidBotStore";

import { SidBotActionCard } from "./SidBotActionCard";
import { SidBotMessage } from "./SidBotMessage";
import { SidBotProgressCard } from "./SidBotProgressCard";

function SidBotThinking() {
  return (
    <div className="flex gap-2 px-3">
      <div className="w-6 h-6 rounded-full flex-none flex items-center justify-center mt-0.5 bg-[var(--surface-2)] border border-[var(--border-muted)]">
        <Bot className="w-3 h-3 text-[var(--text-muted)]" />
      </div>
      <div className="flex items-center gap-1 py-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-[sidbot-dot_1.4s_ease-in-out_infinite]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-[sidbot-dot_1.4s_ease-in-out_0.2s_infinite]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-[sidbot-dot_1.4s_ease-in-out_0.4s_infinite]" />
      </div>
    </div>
  );
}

export function SidBotMessages() {
  const messages = useSidBotStore((s) => s.messages);
  const isStreaming = useSidBotStore((s) => s.isStreaming);
  const streamingText = useSidBotStore((s) => s.streamingText);
  const claudeStatus = useSidBotStore((s) => s.claudeStatus);
  const claudeStep = useSidBotStore((s) => s.claudeStep);
  const claudeDetail = useSidBotStore((s) => s.claudeDetail);
  const claudeElapsed = useSidBotStore((s) => s.claudeElapsed);
  const cancelStream = useSidBotStore((s) => s.cancelStream);
  const executeAction = useSidBotStore((s) => s.executeAction);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages or streaming text
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingText, claudeStatus]);

  return (
    <ScrollArea className="flex-1 min-w-0 [&>div>div]:!overflow-x-hidden">
      <div data-sidbot-messages className="flex flex-col gap-3 py-3 overflow-x-hidden">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-2">
            <SidBotMessage message={msg} />
            {/* Action cards for bot messages */}
            {msg.role === "bot" && msg.actions && msg.actions.length > 0 && (
              <div className="flex flex-col gap-1.5 px-3 ml-8">
                {msg.actions.map((action, i) => (
                  <SidBotActionCard
                    key={i}
                    action={action}
                    onExecute={executeAction}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Thinking indicator — shows when streaming but no text yet */}
        {isStreaming && !streamingText && claudeStatus === "idle" && (
          <SidBotThinking />
        )}

        {/* Streaming message (in-progress) */}
        {isStreaming && streamingText && (
          <SidBotMessage
            message={{
              id: "streaming",
              role: "bot",
              content: streamingText,
              timestamp: Date.now(),
            }}
            isStreaming
          />
        )}

        {/* Claude progress card */}
        {claudeStatus !== "idle" && (
          <SidBotProgressCard
            status={claudeStatus}
            step={claudeStep}
            detail={claudeDetail}
            elapsed={claudeElapsed}
            onCancel={cancelStream}
          />
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
