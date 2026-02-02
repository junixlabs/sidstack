import {
  Sparkles,
  Bug,
  RefreshCw,
  TestTube,
  FileText,
  Settings,
  Shield,
  Zap,
  Wrench,
  Microscope,
} from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { TaskType } from "@/stores/taskStore";

interface TaskTypeBadgeProps {
  taskType: TaskType;
  showIcon?: boolean;
}

const TASK_TYPE_CONFIG: Record<TaskType, { bgVar: string; textVar: string; icon: ReactNode }> = {
  feature:  { bgVar: "var(--task-feature-bg)",  textVar: "var(--task-feature)",  icon: <Sparkles className="w-3 h-3" /> },
  bugfix:   { bgVar: "var(--task-bugfix-bg)",   textVar: "var(--task-bugfix)",   icon: <Bug className="w-3 h-3" /> },
  refactor: { bgVar: "var(--task-refactor-bg)", textVar: "var(--task-refactor)", icon: <RefreshCw className="w-3 h-3" /> },
  test:     { bgVar: "var(--task-test-bg)",     textVar: "var(--task-test)",     icon: <TestTube className="w-3 h-3" /> },
  docs:     { bgVar: "var(--task-docs-bg)",     textVar: "var(--task-docs)",     icon: <FileText className="w-3 h-3" /> },
  infra:    { bgVar: "var(--task-infra-bg)",    textVar: "var(--task-infra)",    icon: <Settings className="w-3 h-3" /> },
  security: { bgVar: "var(--task-security-bg)", textVar: "var(--task-security)", icon: <Shield className="w-3 h-3" /> },
  perf:     { bgVar: "var(--task-perf-bg)",     textVar: "var(--task-perf)",     icon: <Zap className="w-3 h-3" /> },
  debt:     { bgVar: "var(--task-debt-bg)",     textVar: "var(--task-debt)",     icon: <Wrench className="w-3 h-3" /> },
  spike:    { bgVar: "var(--task-spike-bg)",    textVar: "var(--task-spike)",    icon: <Microscope className="w-3 h-3" /> },
};

export function TaskTypeBadge({ taskType, showIcon = false }: TaskTypeBadgeProps) {
  const config = TASK_TYPE_CONFIG[taskType];

  return (
    <span
      className={cn("text-[11px] px-1.5 py-0.5 rounded font-medium uppercase flex-shrink-0 flex items-center gap-1 border")}
      style={{
        backgroundColor: config.bgVar,
        color: config.textVar,
        borderColor: `color-mix(in srgb, ${config.textVar} 40%, transparent)`,
      }}
    >
      {showIcon && config.icon}
      {taskType}
    </span>
  );
}
