import { Send, Square } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";

import { cn } from "@/lib/utils";

interface SidBotInputProps {
  onSend: (text: string) => void;
  onCancel: () => void;
  isStreaming: boolean;
  isClaudeWorking: boolean;
  disabled?: boolean;
}

export function SidBotInput({
  onSend,
  onCancel,
  isStreaming,
  isClaudeWorking,
  disabled,
}: SidBotInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isBusy = isStreaming || isClaudeWorking;

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isBusy) return;
    onSend(trimmed);
    setValue("");
    // Re-focus textarea after send
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [value, isBusy, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex items-end gap-2 p-3 border-t border-[var(--border-muted)]">
      <TextareaAutosize
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isBusy ? "Waiting..." : "Ask SidBot..."}
        disabled={disabled || isBusy}
        minRows={1}
        maxRows={4}
        className={cn(
          "flex-1 resize-none bg-[var(--surface-2)] text-[var(--text-primary)]",
          "text-sm rounded-lg px-3 py-2",
          "border border-[var(--border-muted)]",
          "placeholder:text-[var(--text-placeholder)]",
          "focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-all",
        )}
      />

      {isBusy ? (
        <button
          onClick={onCancel}
          className={cn(
            "flex-none w-8 h-8 rounded-lg flex items-center justify-center",
            "bg-[var(--color-error)]/20 text-[var(--color-error)]",
            "hover:bg-[var(--color-error)]/30 transition-colors",
          )}
          title="Cancel"
          aria-label="Cancel stream"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className={cn(
            "flex-none w-8 h-8 rounded-lg flex items-center justify-center",
            "transition-colors",
            value.trim()
              ? "bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)]"
              : "bg-[var(--surface-3)] text-[var(--text-muted)] cursor-not-allowed",
          )}
          title="Send (Enter)"
          aria-label="Send message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
