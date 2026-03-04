import { Check, CheckCircle2, Circle, ExternalLink, GitBranch, History, Play, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTask } from "@/hooks/useTasks";
import { useTaskDetailQuery } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { showSuccess, showError } from "@/lib/toast";
import { launchClaudeWithContext } from "@/services/claudeCodeLauncher";
import type { Task, TaskProgressLog } from "@/stores/taskStore";
import { useUnifiedContextStore } from "@/stores/unifiedContextStore";

import { LinkedKnowledgeSection } from "./LinkedKnowledgeSection";
import { LinkedSpecsSection } from "./LinkedSpecsSection";
import { RelatedIncidentsSection } from "./RelatedIncidentsSection";

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
  workspacePath,
}: TaskDetailPanelProps) {
  const [isLaunching, setIsLaunching] = useState(false);
  const { subtasks, parentTask } = useTask(task.id);
  const { data: detailTask } = useTaskDetailQuery(task.id);

  // Use detailTask for full fields, fall back to task for basic fields
  const isDetailLoaded = detailTask?.id === task.id;
  const governance = isDetailLoaded ? detailTask.governance : task.governance;
  const acceptanceCriteria = isDetailLoaded ? detailTask.acceptanceCriteria : task.acceptanceCriteria;
  const validation = isDetailLoaded ? detailTask.validation : task.validation;
  const solutionPlan = isDetailLoaded ? detailTask.solutionPlan : task.solutionPlan;
  const planStatus = isDetailLoaded ? detailTask.planStatus : task.planStatus;
  const planReviewNotes = isDetailLoaded ? detailTask.planReviewNotes : task.planReviewNotes;
  const implementSummary = isDetailLoaded ? detailTask.implementSummary : task.implementSummary;

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
          {workspacePath && (
            <button
              disabled={isLaunching}
              onClick={async () => {
                setIsLaunching(true);
                try {
                  await launchClaudeWithContext({
                    workingDir: workspacePath,
                    projectId: task.projectId,
                    taskId: task.id,
                  });
                  showSuccess("Claude Code launched with knowledge context");
                } catch (err) {
                  showError("Failed to launch Claude Code", err instanceof Error ? err.message : "Unknown error");
                } finally {
                  setIsLaunching(false);
                }
              }}
              className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              <span>{isLaunching ? "Launching..." : "Launch Claude Code"}</span>
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

        {/* Related Incidents Section */}
        <RelatedIncidentsSection taskId={task.id} />

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

        {/* Solution Plan */}
        {solutionPlan && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-[var(--text-muted)]">Solution Plan</span>
              {planStatus && (
                <span
                  className={cn(
                    "text-[11px] px-1.5 py-0.5 rounded font-medium",
                    planStatus === 'approved' && "bg-[var(--color-success)]/15 text-[var(--color-success)]",
                    planStatus === 'draft' && "bg-[var(--status-review)]/15 text-[var(--status-review)]",
                    planStatus === 'revision_requested' && "bg-[var(--status-blocked)]/15 text-[var(--status-blocked)]",
                  )}
                >
                  {planStatus === 'revision_requested' ? 'Revision Requested' : planStatus}
                </span>
              )}
            </div>
            <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap bg-[var(--surface-0)] rounded p-2 border border-[var(--border-muted)]">
              {solutionPlan}
            </div>
          </div>
        )}

        {/* Plan Review Notes */}
        {planReviewNotes && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Review Feedback</div>
            <div className="text-sm text-[var(--status-blocked)] bg-[var(--status-blocked)]/10 rounded p-2 border border-[var(--status-blocked)]/20">
              {planReviewNotes}
            </div>
          </div>
        )}

        {/* Implement Summary */}
        {implementSummary && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Implement Summary</div>
            <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap bg-[var(--color-success)]/5 rounded p-2 border border-[var(--color-success)]/20">
              {implementSummary}
            </div>
          </div>
        )}

        {/* Acceptance Criteria */}
        {Array.isArray(acceptanceCriteria) && acceptanceCriteria.length > 0 && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-2">
              Acceptance Criteria ({acceptanceCriteria.filter(c => c.completed).length}/{acceptanceCriteria.length})
            </div>
            <div className="space-y-2">
              {acceptanceCriteria.map((criterion) => (
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
        {governance && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Governance</div>
            <div className="space-y-2 text-xs">
              {governance.qualityGates && governance.qualityGates.length > 0 && (
                <div>
                  <div className="text-[var(--text-muted)]">Quality Gates:</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {governance.qualityGates.map((gate) => (
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
              {governance.principles && governance.principles.length > 0 && (
                <div>
                  <div className="text-[var(--text-muted)]">Principles:</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {governance.principles.map((p) => (
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
        {validation && (
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">Validation</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                {validation.progressHistoryCount >= 2 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                )}
                <span className="text-[var(--text-secondary)]">
                  Progress: {validation.progressHistoryCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {validation.titleFormatValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                )}
                <span className="text-[var(--text-secondary)]">Title format</span>
              </div>
              <div className="flex items-center gap-1">
                {validation.qualityGatesPassed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                )}
                <span className="text-[var(--text-secondary)]">Quality gates</span>
              </div>
              <div className="flex items-center gap-1">
                {validation.acceptanceCriteriaValid ? (
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
