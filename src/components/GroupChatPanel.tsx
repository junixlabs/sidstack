/**
 * Group Chat Panel - Displays messages between agents
 */

import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { MessageSquare, Users } from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface GroupChatMessage {
  from_role: string;
  from_id: string;
  content: string;
  mentions: string[];
  timestamp: string;
  target_ids: string[];
}

interface GroupChatPanelProps {
  isDark?: boolean;
  className?: string;
}

export function GroupChatPanel({ isDark = true, className }: GroupChatPanelProps) {
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Listen for group chat messages with deduplication
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<GroupChatMessage>("ipc-groupchat-message", (event) => {
        const newMsg = event.payload;
        setMessages((prev) => {
          // Deduplicate: check if message with same content + timestamp already exists
          const isDuplicate = prev.some(
            (m) =>
              m.content === newMsg.content &&
              m.timestamp === newMsg.timestamp &&
              m.from_role === newMsg.from_role
          );
          if (isDuplicate) {
            return prev;
          }
          // Keep last 100 messages
          const updated = [...prev, newMsg];
          if (updated.length > 100) {
            return updated.slice(-100);
          }
          return updated;
        });
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  // Highlight @mentions in content
  const renderContent = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("@")) {
        return (
          <span key={idx} className="text-[var(--text-secondary)] font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full",
        isDark ? "bg-[var(--surface-0)]" : "bg-white",
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 border-b flex-shrink-0",
          isDark ? "border-[var(--border-default)]" : "border-gray-200"
        )}
      >
        <MessageSquare className={cn("w-4 h-4", isDark ? "text-[var(--text-secondary)]" : "text-gray-600")} />
        <span className={cn("text-sm font-medium", isDark ? "text-[var(--text-primary)]" : "text-gray-900")}>
          Group Chat
        </span>
        <Badge variant="secondary" className="ml-auto">
          {messages.length} messages
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={scrollRef} className="p-3 space-y-3">
          {messages.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center py-8 text-center",
                isDark ? "text-[var(--text-muted)]" : "text-gray-500"
              )}
            >
              <Users className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">
                Use <code className="px-1 py-0.5 rounded bg-[var(--surface-2)]">group_chat_send</code> to send messages
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-lg p-3",
                  isDark ? "bg-[var(--surface-1)]" : "bg-gray-50"
                )}
              >
                {/* Message header */}
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      msg.from_role === "orchestrator"
                        ? "border-[var(--border-default)] text-[var(--text-secondary)]"
                        : "border-[var(--border-default)] text-[var(--text-secondary)]"
                    )}
                  >
                    @{msg.from_role}
                  </Badge>
                  <span
                    className={cn(
                      "text-xs",
                      isDark ? "text-[var(--text-muted)]" : "text-gray-500"
                    )}
                  >
                    {formatTime(msg.timestamp)}
                  </span>
                  {msg.target_ids.length > 0 && (
                    <span
                      className={cn(
                        "text-xs ml-auto",
                        isDark ? "text-[var(--text-muted)]" : "text-gray-500"
                      )}
                    >
                      → {msg.target_ids.length} target(s)
                    </span>
                  )}
                </div>

                {/* Message content */}
                <p className={cn("text-sm", isDark ? "text-[var(--text-primary)]" : "text-gray-900")}>
                  {renderContent(msg.content)}
                </p>

                {/* Mentions */}
                {msg.mentions.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {msg.mentions.map((mention, mIdx) => (
                      <Badge key={mIdx} variant="secondary" className="text-xs">
                        @{mention}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default GroupChatPanel;
