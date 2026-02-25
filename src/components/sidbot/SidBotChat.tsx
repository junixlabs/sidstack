import { useSidBotStore } from "@/stores/sidBotStore";

import { SidBotInput } from "./SidBotInput";
import { SidBotMessages } from "./SidBotMessages";
import { SidBotWelcome } from "./SidBotWelcome";

export function SidBotChat() {
  const messages = useSidBotStore((s) => s.messages);
  const isStreaming = useSidBotStore((s) => s.isStreaming);
  const claudeStatus = useSidBotStore((s) => s.claudeStatus);
  const sendMessage = useSidBotStore((s) => s.sendMessage);
  const cancelStream = useSidBotStore((s) => s.cancelStream);

  const isClaudeWorking =
    claudeStatus === "starting" || claudeStatus === "working";
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      {hasMessages ? <SidBotMessages /> : <SidBotWelcome onQuickAction={sendMessage} />}
      <SidBotInput
        onSend={sendMessage}
        onCancel={cancelStream}
        isStreaming={isStreaming}
        isClaudeWorking={isClaudeWorking}
      />
    </div>
  );
}
