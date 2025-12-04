/**
 * Hook to manage agent messages and notifications
 *
 * Listens for ipc-groupchat-message events from the Tauri backend
 * and provides message state and actions for a specific agent role.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useCallback, useState, useMemo, useRef } from "react";

export interface GroupChatMessageEvent {
  from_role: string;
  from_id: string;
  content: string;
  mentions: string[];
  timestamp: string;
  target_ids: string[];
  reply_to?: string;
}

export interface PendingMessage {
  id: string;
  from_role: string;
  content: string;
  timestamp: string;
  reply_to?: string;
  read: boolean;
}

export interface UseAgentMessagesOptions {
  /** Callback when a new message arrives (for auto-submit) */
  onNewMessage?: (message: PendingMessage) => void;
  /** Auto-dismiss messages after processing */
  autoDismiss?: boolean;
}

export interface UseAgentMessagesReturn {
  /** All messages for this agent */
  messages: PendingMessage[];
  /** Number of unread messages */
  unreadCount: number;
  /** Whether hook is loading initial data */
  isLoading: boolean;
  /** Mark all messages as read */
  markAllRead: () => void;
  /** Mark a specific message as read */
  markRead: (messageId: string) => void;
  /** Send a reply to the group chat */
  sendReply: (content: string, replyTo?: string) => Promise<void>;
  /** Dismiss/remove a message */
  dismiss: (messageId: string) => void;
  /** Clear all messages */
  clearAll: () => void;
}

/**
 * Hook to manage agent messages and notifications
 *
 * @param role - The agent's role (e.g., "dev", "frontend")
 * @param terminalId - The terminal ID of this agent
 * @param options - Additional options including onNewMessage callback
 */
export function useAgentMessages(
  role: string | null,
  terminalId: string,
  options?: UseAgentMessagesOptions
): UseAgentMessagesReturn {
  const { onNewMessage, autoDismiss = false } = options || {};
  const [messages, setMessages] = useState<PendingMessage[]>([]);
  const [isLoading] = useState(false);
  const messageIdCounter = useRef(0);

  // Keep stable refs for callbacks
  const onNewMessageRef = useRef(onNewMessage);
  const autoDismissRef = useRef(autoDismiss);

  // Update refs when options change
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    autoDismissRef.current = autoDismiss;
  }, [onNewMessage, autoDismiss]);

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  }, []);

  // Listen for group chat messages
  useEffect(() => {
    if (!role) return;

    const roleLower = role.toLowerCase();
    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      unlisten = await listen<GroupChatMessageEvent>(
        "ipc-groupchat-message",
        (event) => {
          const msg = event.payload;

          // Check if this message is for our role
          const isMentioned = msg.mentions.some(
            (m) => m.toLowerCase() === roleLower
          );
          const isTarget = msg.target_ids.includes(terminalId);

          // Skip if message is from ourselves
          if (msg.from_role.toLowerCase() === roleLower) {
            return;
          }

          // Add message if we're mentioned or targeted
          if (isMentioned || isTarget) {
            const pendingMsg: PendingMessage = {
              id: generateMessageId(),
              from_role: msg.from_role,
              content: msg.content,
              timestamp: msg.timestamp,
              reply_to: msg.reply_to,
              read: false,
            };

            // Call onNewMessage callback for auto-submit functionality
            if (onNewMessageRef.current) {
              onNewMessageRef.current(pendingMsg);
            }

            // If autoDismiss is enabled, don't store the message
            if (autoDismissRef.current) {
              return;
            }

            setMessages((prev) => {
              // Avoid duplicates (same content + timestamp)
              const exists = prev.some(
                (m) =>
                  m.content === pendingMsg.content &&
                  m.timestamp === pendingMsg.timestamp
              );
              if (exists) return prev;

              // Keep last 50 messages
              const updated = [...prev, pendingMsg];
              if (updated.length > 50) {
                return updated.slice(-50);
              }
              return updated;
            });
          }
        }
      );
    };

    setupListener();

    return () => {
      unlisten?.();
    };
  }, [role, terminalId, generateMessageId]);

  // Calculate unread count
  const unreadCount = useMemo(
    () => messages.filter((m) => !m.read).length,
    [messages]
  );

  // Mark all messages as read
  const markAllRead = useCallback(() => {
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
  }, []);

  // Mark a specific message as read
  const markRead = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, read: true } : m))
    );
  }, []);

  // Dismiss a message
  const dismiss = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  // Clear all messages
  const clearAll = useCallback(() => {
    setMessages([]);
  }, []);

  // Send a reply via IPC
  const sendReply = useCallback(
    async (content: string, replyTo?: string) => {
      if (!role) {
        throw new Error("No role set for this agent");
      }

      try {
        // Use the IPC WebSocket to send the message
        // The message format follows GroupChatSend request
        await invoke("send_group_chat_message", {
          fromRole: role,
          fromId: terminalId,
          content,
          replyTo,
        });
      } catch (error) {
        console.error("[useAgentMessages] Failed to send reply:", error);
        throw error;
      }
    },
    [role, terminalId]
  );

  return {
    messages,
    unreadCount,
    isLoading,
    markAllRead,
    markRead,
    sendReply,
    dismiss,
    clearAll,
  };
}

export default useAgentMessages;
