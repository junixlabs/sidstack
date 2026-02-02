import { Check, CheckCircle2, Circle, ExternalLink, GitBranch, History, User, X } from "lucide-react";
import { useEffect } from "react";
import { useTask } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";
import type { Task, TaskProgressLog } from "@/stores/taskStore";
import { useUnifiedContextStore } from "@/stores/unifiedContextStore";

import { LinkedKnowledgeSection } from "./LinkedKnowledgeSection";
import { LinkedSpecsSection } from "./LinkedSpecsSection";

import { PriorityBadge, StatusBadge, StatusIcon, TaskTypeBadge } from "./badges";

interface TaskDetailPanelProps {
  task: Task;
  progressHistory: TaskProgressLog[];
  onClose: () => void;
  onNavigateToProgressTracker?: (taskId: string) => void;
  onNavigateToSpec?: (specPath: string) => void;
  onNavigateToKnowledge?: (knowledgePath: string) => void;
  onLaunchSession?: (taskId: string) => void;
  workspacePath?: string;
}

export function TaskDetailPanel({
  task,
  progressHistory,
  onClose,
  onNavigateToProgressTracker,
  onNavigateToSpec,
  onNavigateToKnowledge,
}: TaskDetailPanelProps) {
  const { subtasks, parentTask } = useTask(task.id);

  // Load linked specs and knowledge from unified context store
  const {
    specLinks,
    knowledgeLinks,
    suggestions,
    loadLinksForTask,
    loadSuggestions,
    unlinkSpec,
    unlinkKnowledge,
    acceptSuggestion,
    dismissSuggestion,
    isLoading: linksLoading,
  } = useUnifiedContextStore();

  // Load links and suggestions when task changes
  useEffect(() => {
    loadLinksForTask(task.id);
    loadSuggestions(task.id);
  }, [task.id, loadLinksForTask, loadSuggestions]);

  // Filter links for current task
  const taskSpecLinks = specLinks.filter((l) => l.taskId === task.id);
  const taskKnowledgeLinks = knowledgeLinks.filter((l) => l.taskId === task.id);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-muted)]">
        <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
          Task Details
        </span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded transition-colors"
          aria-label="Close task details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Title and status */}
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">
            {task.title}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.taskType && <TaskTypeBadge taskType={task.taskType} />}
            {task.assignedAgent && (
              <span className="text-xs px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[var(--text-muted)] flex items-center gap-1">
                <User className="w-3 h-3" />
                {task.assignedAgent}
              </span>
            )}
          </div>
        </div>

        {/* Branch */}
        {task.branch && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Branch</div>
            <div className="flex items-center gap-1.5 text-sm text-purple-400">
              <GitBranch className="w-3.5 h-3.5" />
              <span className="font-mono text-xs">{task.branch}</span>
            </div>
          </div>
        )}

        {/* Quick navigation links */}
        <div className="flex items-center gap-2 flex-wrap">
          {onNavigateToProgressTracker && progressHistory.length > 0 && (
            <button
              onClick={() => onNavigateToProgressTracker(task.id)}
              className="text-xs px-2 py-1 bg-[var(--surface-2)] text-[var(--text-secondary)] rounded hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition-colors"
            >
              <History className="w-3 h-3" />
              <span>Full History</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Linked Specs Section */}
        {onNavigateToSpec && (
          <LinkedSpecsSection
            links={taskSpecLinks}
            onNavigate={onNavigateToSpec}
            onUnlink={unlinkSpec}
            isLoading={linksLoading}
          />
        )}

        {/* Linked Knowledge Section */}
        {onNavigateToKnowledge && (
          <LinkedKnowledgeSection
            links={taskKnowledgeLinks}
            suggestions={suggestions}
            onNavigate={onNavigateToKnowledge}
            onUnlink={unlinkKnowledge}
            onAcceptSuggestion={acceptSuggestion}
            onDismissSuggestion={dismissSuggestion}
            isLoading={linksLoading}
          />
        )}

        {/* Progress bar */}
        {task.progress > 0 && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">
              Progress: {task.progress}%
            </div>
            <div
              className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={task.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Task progress: ${task.progress}%`}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${task.progress}%`,
                  backgroundColor:
                    task.status === "completed"
                      ? "var(--status-completed)"
                      : task.status === "in_progress"
                      ? "var(--status-in-progress)"
                      : "var(--text-muted)",
                }}
              />
            </div>
          </div>
        )}

        {/* Description */}
        {task.description && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Description</div>
            <p className="text-sm text-[var(--text-secondary)]">{task.description}</p>
          </div>
        )}

        {/* Notes */}
        {task.notes && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Notes</div>
            <p className="text-sm text-[var(--text-secondary)]">{task.notes}</p>
          </div>
        )}

        {/* Acceptance Criteria */}
        {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-2">
              Acceptance Criteria ({task.acceptanceCriteria.filter(c => c.completed).length}/{task.acceptanceCriteria.length})
            </div>
            <div className="space-y-2">
              {task.acceptanceCriteria.map((criterion) => (
                <div
                  key={criterion.id}
                  className="flex items-start gap-3"
                >
                  <div
                    role="checkbox"
                    aria-checked={criterion.completed}
                    aria-label={criterion.description}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                      criterion.completed
                        ? "bg-[var(--color-success)] border-[var(--color-success)]"
                        : "border-[var(--border-muted)]"
                    )}
                  >
                    {criterion.completed && <Check className="w-3 h-3 text-[var(--surface-0)]" />}
                  </div>
                  <span
                    className={cn(
                      "text-sm",
                      criterion.completed
                        ? "text-[var(--text-secondary)] line-through"
                        : "text-[var(--text-secondary)]"
                    )}
                  >
                    {criterion.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Governance Info */}
        {task.governance && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Governance</div>
            <div className="space-y-2 text-xs">
              {task.governance.qualityGates && task.governance.qualityGates.length > 0 && (
                <div>
                  <div className="text-[var(--text-muted)]">Quality Gates:</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {task.governance.qualityGates.map((gate) => (
                      <span
                        key={gate.id}
                        className={cn(
                          "px-1.5 py-0.5 rounded flex items-center gap-1",
                          gate.passedAt
                            ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                            : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                        )}
                        title={gate.command}
                      >
                        {gate.id}
                        {gate.passedAt && <Check className="w-3 h-3" />}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {task.governance.principles && task.governance.principles.length > 0 && (
                <div>
                  <div className="text-[var(--text-muted)]">Principles:</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {task.governance.principles.map((p) => (
                      <span
                        key={p}
                        className="px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[var(--text-muted)]"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Validation Status */}
        {task.validation && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Validation</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                {task.validation.progressHistoryCount >= 2 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                )}
                <span className="text-[var(--text-secondary)]">
                  Progress: {task.validation.progressHistoryCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {task.validation.titleFormatValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                )}
                <span className="text-[var(--text-secondary)]">Title format</span>
              </div>
              <div className="flex items-center gap-1">
                {task.validation.qualityGatesPassed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                )}
                <span className="text-[var(--text-secondary)]">Quality gates</span>
              </div>
              <div className="flex items-center gap-1">
                {task.validation.acceptanceCriteriaValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                )}
                <span className="text-[var(--text-secondary)]">Criteria</span>
              </div>
            </div>
          </div>
        )}

        {/* Parent task */}
        {parentTask && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Parent Task</div>
            <div className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
              <StatusIcon status={parentTask.status} className="w-3.5 h-3.5" />
              <span className="truncate">{parentTask.title}</span>
            </div>
          </div>
        )}

        {/* Subtasks */}
        {subtasks.length > 0 && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">
              Subtasks ({subtasks.length})
            </div>
            <div className="space-y-1">
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  className="text-sm text-[var(--text-secondary)] flex items-center gap-2"
                >
                  <StatusIcon status={st.status} className="w-3.5 h-3.5" />
                  <span className="truncate">{st.title}</span>
                  {st.progress > 0 && (
                    <span className="text-xs text-[var(--text-muted)]">
                      {st.progress}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress history */}
        {progressHistory.length > 0 && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-2">Progress History</div>
            <div className="space-y-2">
              {progressHistory.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="bg-[var(--surface-0)] rounded p-2 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[var(--text-secondary)]">
                      {log.progress}%
                    </span>
                    <StatusBadge status={log.status} small />
                  </div>
                  {log.currentStep && (
                    <p className="text-[var(--text-muted)]">{log.currentStep}</p>
                  )}
                  <p className="text-[var(--text-muted)] mt-1">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="text-xs text-[var(--text-muted)] space-y-1">
          <div>Created: {new Date(task.createdAt).toLocaleString()}</div>
          <div>Updated: {new Date(task.updatedAt).toLocaleString()}</div>
          <div>Created by: {task.createdBy}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-[var(--border-muted)]">
        <span
          className="px-1.5 py-0.5 bg-[var(--surface-2)] text-[var(--text-muted)] rounded text-xs"
          title="Tasks are managed via CLI or agents. This view is read-only."
        >
          View Only
        </span>
      </div>
    </div>
  );
}
