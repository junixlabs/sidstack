/**
 * RequestInputPanel - Submit requests to the orchestrator
 *
 * Features:
 * - Text input for user requests
 * - Preview mode shows task breakdown before submission
 * - Submit creates tasks and delegates to agents
 */

import { invoke } from "@tauri-apps/api/core";
import {
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowRight,
  User,
  Rocket,
  Bot,
} from "lucide-react";
import { useState, useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ipcRequest } from "@/lib/ipcClient";
import { showError, showSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface RequestAnalysisResult {
  intent: string;
  keywords: string[];
  affectedAreas: string[];
  suggestedRoles: string[];
  specContext: string;
}

interface TaskBreakdownResult {
  parentTask: {
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
  };
  subtasks: Array<{
    title: string;
    description: string;
    suggestedRole: string;
    dependencies: string[];
  }>;
}

interface RequestPreview {
  analysis: RequestAnalysisResult;
  breakdown: TaskBreakdownResult;
}

interface RequestSubmitResult {
  success: boolean;
  requestId: string;
  createdTaskCount: number;
  error?: string;
}

interface RequestInputPanelProps {
  projectPath: string | null;
  isDark?: boolean;
  onRequestSubmitted?: (result: RequestSubmitResult) => void;
}

// ============================================================================
// Main Component
// ============================================================================


export function RequestInputPanel({
  projectPath,
  isDark = true,
  onRequestSubmitted,
}: RequestInputPanelProps) {
  const [request, setRequest] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<RequestPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showLaunchPanel, setShowLaunchPanel] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchedRoles, setLaunchedRoles] = useState<string[]>([]);

  const handleAnalyze = useCallback(async () => {
    if (!projectPath || !request.trim()) return;

    setIsAnalyzing(true);
    setError(null);
    setPreview(null);

    try {
      const result = await invoke<RequestPreview>("analyze_request", {
        projectPath,
        request: request.trim(),
      });
      setPreview(result);
      setIsExpanded(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Analysis failed";
      setError(errorMsg);
      showError("Analysis Failed", errorMsg);
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectPath, request]);

  const handleSubmit = useCallback(async () => {
    if (!projectPath || !request.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await invoke<RequestSubmitResult>("submit_request", {
        projectPath,
        request: request.trim(),
      });

      if (result.success) {
        setSubmitted(true);
        setShowLaunchPanel(true);
        setLaunchedRoles([]);
        showSuccess("Request Submitted", `Created ${result.createdTaskCount} task(s)`);
        onRequestSubmitted?.(result);
      } else {
        const errorMsg = result.error || "Failed to submit request";
        setError(errorMsg);
        showError("Submission Failed", errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Submission failed";
      setError(errorMsg);
      showError("Submission Failed", errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  }, [projectPath, request, onRequestSubmitted]);

  const handleLaunchAgent = useCallback(async (role: string) => {
    if (!projectPath || launchedRoles.includes(role)) return;

    setIsLaunching(true);
    try {
      // Build initial prompt from task context
      const taskDescription = preview?.breakdown.parentTask.description || request;
      const subtask = preview?.breakdown.subtasks.find(s => s.suggestedRole === role);
      const initialPrompt = subtask
        ? `Task assigned: ${subtask.title}\n\nDescription: ${subtask.description}\n\nPlease work on this task.`
        : `Task: ${taskDescription}\n\nYou are the ${role} agent. Please help with this request.`;

      await ipcRequest("terminal.spawn", {
        cwd: projectPath,
        role,
        auto_launch: initialPrompt,
      });

      setLaunchedRoles(prev => [...prev, role]);
      showSuccess(`Agent Launched`, `@${role} is now working`);
    } catch (err) {
      console.error("Failed to launch agent:", err);
      const errorMsg = `Failed to launch ${role} agent`;
      setError(errorMsg);
      showError("Launch Failed", errorMsg);
    } finally {
      setIsLaunching(false);
    }
  }, [projectPath, preview, request, launchedRoles]);

  const handleLaunchAllAgents = useCallback(async () => {
    if (!projectPath || !preview) return;

    const roles = preview.analysis.suggestedRoles.filter(r => !launchedRoles.includes(r));
    for (const role of roles) {
      await handleLaunchAgent(role);
    }
  }, [projectPath, preview, launchedRoles, handleLaunchAgent]);

  const handleReset = useCallback(() => {
    setRequest("");
    setPreview(null);
    setSubmitted(false);
    setShowLaunchPanel(false);
    setIsExpanded(false);
    setLaunchedRoles([]);
    setError(null);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) {
      if (preview) {
        handleSubmit();
      } else {
        handleAnalyze();
      }
    }
  };

  if (!projectPath) return null;

  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        isDark ? "bg-[var(--surface-1)] border-[var(--border-default)]" : "bg-white border-gray-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Sparkles className={cn("w-5 h-5", isDark ? "text-[var(--text-secondary)]" : "text-gray-600")} />
        <span className={cn("text-[14px] font-medium", isDark ? "text-[var(--text-primary)]" : "text-gray-900")}>
          New Request
        </span>
        <Badge variant="outline" className={cn("text-[11px]", isDark ? "border-[var(--border-default)] text-[var(--text-secondary)]" : "border-gray-300 text-gray-600")}>
          O2A
        </Badge>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* Input Area */}
      <div className="px-4 pb-3">
        <div className="relative">
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build or fix..."
            rows={isExpanded ? 3 : 1}
            className={cn(
              "w-full px-3 py-2 rounded-md text-[13px] resize-none transition-all",
              isDark
                ? "bg-[var(--surface-0)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-hover)]"
                : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-400",
              "border focus:outline-none focus:ring-1 focus:ring-[var(--border-default)]"
            )}
          />
          {!isExpanded && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAnalyze}
                disabled={!request.trim() || isAnalyzing}
                className="h-7 text-[11px]"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-1" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Expanded Actions */}
        {isExpanded && (
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={!request.trim() || isAnalyzing}
              className="text-[11px]"
            >
              {isAnalyzing ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3 mr-1" />
              )}
              Preview Tasks
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!request.trim() || isSubmitting || !preview}
              className={cn(
                "text-[11px]",
                isDark ? "bg-[var(--surface-3)] hover:bg-[var(--surface-4)]" : "bg-gray-600 hover:bg-gray-700"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : submitted ? (
                <CheckCircle2 className="w-3 h-3 mr-1" />
              ) : (
                <Send className="w-3 h-3 mr-1" />
              )}
              {submitted ? "Created!" : "Submit Request"}
            </Button>
            <span className={cn("text-[11px] ml-auto", isDark ? "text-[var(--text-muted)]" : "text-gray-400")}>
              ⌘+Enter to {preview ? "submit" : "analyze"}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className={cn("px-4 pb-3")}>
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-md text-[12px]", isDark ? "bg-[var(--surface-2)] text-[var(--text-secondary)]" : "bg-gray-50 text-gray-600")}>
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && isExpanded && !showLaunchPanel && (
        <div className={cn("border-t px-4 py-3", isDark ? "border-[var(--border-muted)]" : "border-gray-100")}>
          <TaskBreakdownPreview preview={preview} isDark={isDark} />
        </div>
      )}

      {/* Launch Agents Panel */}
      {showLaunchPanel && preview && (
        <div className={cn("border-t px-4 py-3", isDark ? "border-[var(--border-muted)]" : "border-gray-100")}>
          <div className="space-y-4">
            {/* Success message */}
            <div className={cn("flex items-center gap-2 px-3 py-2 rounded-md", isDark ? "bg-[var(--surface-2)]" : "bg-gray-50")}>
              <CheckCircle2 className={cn("w-4 h-4", isDark ? "text-[var(--text-secondary)]" : "text-gray-600")} />
              <span className={cn("text-[12px]", isDark ? "text-[var(--text-secondary)]" : "text-gray-600")}>
                Tasks created successfully! Launch agents to start working.
              </span>
            </div>

            {/* Agent roles to launch */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={cn("text-[11px] font-medium", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}>
                  Agents to Launch
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLaunchAllAgents}
                  disabled={isLaunching || launchedRoles.length === preview.analysis.suggestedRoles.length}
                  className="text-[11px] h-6"
                >
                  <Rocket className="w-3 h-3 mr-1" />
                  Launch All
                </Button>
              </div>

              <div className="space-y-1">
                {preview.analysis.suggestedRoles.map((role) => {
                  const isLaunched = launchedRoles.includes(role);
                  const subtask = preview.breakdown.subtasks.find(s => s.suggestedRole === role);
                  return (
                    <div
                      key={role}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md",
                        isDark ? "bg-[var(--surface-0)]" : "bg-gray-50"
                      )}
                    >
                      <Bot className={cn("w-4 h-4", isDark ? "text-[var(--text-secondary)]" : "text-gray-600")} />
                      <div className="flex-1 min-w-0">
                        <span className={cn("text-[12px] font-medium", isDark ? "text-[var(--text-primary)]" : "text-gray-900")}>
                          {role}
                        </span>
                        {subtask && (
                          <p className={cn("text-[11px] truncate", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}>
                            {subtask.title}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={isLaunched ? "ghost" : "outline"}
                        onClick={() => handleLaunchAgent(role)}
                        disabled={isLaunching || isLaunched}
                        className={cn("text-[11px] h-6", isLaunched && "opacity-50")}
                      >
                        {isLaunched ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Launched
                          </>
                        ) : (
                          <>
                            <Rocket className="w-3 h-3 mr-1" />
                            Launch
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReset}
                className="text-[11px]"
              >
                New Request
              </Button>
              {launchedRoles.length > 0 && (
                <span className={cn("text-[11px]", isDark ? "text-[var(--text-muted)]" : "text-gray-400")}>
                  {launchedRoles.length} agent(s) launched
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Task Breakdown Preview
// ============================================================================

interface TaskBreakdownPreviewProps {
  preview: RequestPreview;
  isDark: boolean;
}

function TaskBreakdownPreview({ preview, isDark }: TaskBreakdownPreviewProps) {
  const { analysis, breakdown } = preview;

  const roleColors: Record<string, string> = {
    frontend: isDark ? "bg-[var(--surface-2)] text-[var(--text-secondary)]" : "bg-gray-100 text-gray-700",
    backend: isDark ? "bg-[var(--surface-2)] text-[var(--text-secondary)]" : "bg-gray-100 text-gray-700",
    orchestrator: isDark ? "bg-[var(--surface-2)] text-[var(--text-secondary)]" : "bg-gray-100 text-gray-700",
    default: isDark ? "bg-[var(--surface-2)] text-[var(--text-muted)]" : "bg-gray-100 text-gray-600",
  };

  const priorityColors: Record<string, string> = {
    high: isDark ? "text-[var(--text-secondary)]" : "text-gray-600",
    medium: isDark ? "text-[var(--text-secondary)]" : "text-gray-600",
    low: isDark ? "text-[var(--text-muted)]" : "text-gray-500",
  };

  return (
    <div className="space-y-4">
      {/* Analysis Summary */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={cn("text-[11px]", priorityColors[breakdown.parentTask.priority])}>
          {breakdown.parentTask.priority} priority
        </Badge>
        <Badge variant="outline" className={cn("text-[11px]", isDark ? "border-[var(--border-default)] text-[var(--text-muted)]" : "border-gray-300 text-gray-500")}>
          Intent: {analysis.intent}
        </Badge>
        {analysis.affectedAreas.map((area) => (
          <Badge key={area} variant="outline" className={cn("text-[11px]", roleColors[area] || roleColors.default)}>
            {area}
          </Badge>
        ))}
      </div>

      {/* Parent Task */}
      <div className={cn("p-3 rounded-md", isDark ? "bg-[var(--surface-0)]" : "bg-gray-50")}>
        <div className="flex items-start gap-2">
          <Layers className={cn("w-4 h-4 mt-0.5", isDark ? "text-[var(--text-secondary)]" : "text-gray-600")} />
          <div className="flex-1 min-w-0">
            <p className={cn("text-[13px] font-medium", isDark ? "text-[var(--text-primary)]" : "text-gray-900")}>
              {breakdown.parentTask.title}
            </p>
            <p className={cn("text-[11px] mt-0.5 line-clamp-2", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}>
              {breakdown.parentTask.description}
            </p>
          </div>
        </div>
      </div>

      {/* Subtasks */}
      {breakdown.subtasks.length > 0 && (
        <div className="space-y-2">
          <p className={cn("text-[11px] font-medium", isDark ? "text-[var(--text-muted)]" : "text-gray-500")}>
            Subtasks ({breakdown.subtasks.length})
          </p>
          {breakdown.subtasks.map((subtask, i) => (
            <div
              key={i}
              className={cn("flex items-center gap-2 p-2 rounded-md", isDark ? "bg-[var(--surface-0)]" : "bg-gray-50")}
            >
              <ArrowRight className={cn("w-3 h-3", isDark ? "text-[var(--text-muted)]" : "text-gray-400")} />
              <span className={cn("text-[12px] flex-1", isDark ? "text-[var(--text-primary)]" : "text-gray-900")}>
                {subtask.title}
              </span>
              <Badge className={cn("text-[11px] px-1.5", roleColors[subtask.suggestedRole] || roleColors.default)}>
                <User className="w-2.5 h-2.5 mr-0.5" />
                {subtask.suggestedRole}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Suggested Roles */}
      <div className="flex items-center gap-2">
        <span className={cn("text-[11px]", isDark ? "text-[var(--text-muted)]" : "text-gray-400")}>
          Will delegate to:
        </span>
        {analysis.suggestedRoles.map((role) => (
          <Badge key={role} variant="outline" className={cn("text-[11px]", roleColors[role] || roleColors.default)}>
            {role}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default RequestInputPanel;
