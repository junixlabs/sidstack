import { Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSidBotStore, type SidBotTab } from "@/stores/sidBotStore";

const tabs: { id: SidBotTab; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "config", label: "Config" },
];

export function SidBotHeader() {
  const activeTab = useSidBotStore((s) => s.activeTab);
  const connectionOk = useSidBotStore((s) => s.connectionOk);
  const setActiveTab = useSidBotStore((s) => s.setActiveTab);
  const clearConversation = useSidBotStore((s) => s.clearConversation);
  const togglePanel = useSidBotStore((s) => s.togglePanel);
  const messages = useSidBotStore((s) => s.messages);

  return (
    <div className="flex-none border-b border-[var(--border-muted)] px-3 py-2">
      <div className="flex items-center gap-2">
        {/* Title + connection dot */}
        <span className="text-sm font-medium text-[var(--text-primary)]">
          SidBot
        </span>
        {connectionOk !== null && (
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              connectionOk
                ? "bg-[var(--color-success)]"
                : "bg-[var(--color-error)]",
            )}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear conversation */}
        {activeTab === "chat" && messages.length > 0 && (
          <button
            onClick={clearConversation}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-colors"
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Close panel button */}
        <button
          onClick={togglePanel}
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors"
          title="Close panel (Esc)"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mt-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              activeTab === tab.id
                ? "bg-[var(--surface-3)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
