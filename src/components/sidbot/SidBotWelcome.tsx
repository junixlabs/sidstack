import { Bot, ListTodo, Code2, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

interface SidBotWelcomeProps {
  onQuickAction: (prompt: string) => void;
}

const quickActions = [
  { icon: Bot, label: "What can SidStack do?", prompt: "What can SidStack do?" },
  { icon: ListTodo, label: "Create a task", prompt: "Create a task" },
  { icon: Code2, label: "Analyze my code", prompt: "Analyze my code" },
  { icon: Settings, label: "Show settings", prompt: "Show settings" },
];

export function SidBotWelcome({ onQuickAction }: SidBotWelcomeProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
      <div className="w-10 h-10 rounded-full bg-[var(--surface-3)] flex items-center justify-center">
        <Bot className="w-5 h-5 text-[var(--text-muted)]" />
      </div>
      <div className="text-center">
        <p className="text-[var(--text-primary)] text-sm font-medium">
          Hi, I'm SidBot
        </p>
        <p className="text-[var(--text-muted)] text-xs mt-1">
          Your project intelligence assistant
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full px-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onQuickAction(action.prompt)}
            className={cn(
              "flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg text-center",
              "text-xs text-[var(--text-secondary)]",
              "bg-[var(--surface-2)] border border-[var(--border-muted)]",
              "hover:bg-[var(--surface-3)] hover:border-[var(--border-default)]",
              "hover:shadow-sm",
              "transition-all cursor-pointer",
            )}
          >
            <action.icon className="w-4 h-4 text-[var(--accent-primary)] flex-none" />
            <span className="leading-tight">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
