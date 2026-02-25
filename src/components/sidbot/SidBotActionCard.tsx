import {
  ChevronRight,
  LayoutDashboard,
  BookOpen,
  ListTodo,
  Shield,
  Settings,
  FileText,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { SidBotAction, SidBotActionType } from "@/stores/sidBotStore";

interface SidBotActionCardProps {
  action: SidBotAction;
  onExecute: (action: SidBotAction) => void;
}

const actionIcons: Record<SidBotActionType, typeof LayoutDashboard> = {
  navigate: LayoutDashboard,
  open_knowledge: BookOpen,
  create_task: ListTodo,
  run_impact: Shield,
  open_config: Settings,
  open_doc: FileText,
};

export function SidBotActionCard({ action, onExecute }: SidBotActionCardProps) {
  const Icon = actionIcons[action.type] || LayoutDashboard;

  return (
    <button
      onClick={() => onExecute(action)}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-2 rounded-lg",
        "text-xs text-[var(--text-secondary)]",
        "bg-[var(--surface-2)] border border-[var(--border-muted)]",
        "hover:bg-[var(--surface-3)] hover:border-[var(--border-default)]",
        "transition-colors text-left group",
      )}
    >
      <Icon className="w-3.5 h-3.5 text-[var(--accent-primary)] flex-none" />
      <span className="flex-1 truncate">{action.label}</span>
      <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] flex-none group-hover:translate-x-0.5 transition-transform" />
    </button>
  );
}
