/**
 * Launch Session Dialog
 *
 * Enhanced dialog for launching Claude Code sessions with
 * better UX, validation, and loading states.
 */

import {
  AlertCircle,
  Box,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Layers,
  Link2,
  ListTodo,
  Loader2,
  RotateCcw,
  Shield,
  SplitSquareHorizontal,
  SquarePlus,
  Terminal,
  Ticket,
  Zap,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useClaudeSessionStore } from "@/stores/claudeSessionStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useProjectSettingsStore } from "@/stores/projectSettingsStore";
import { useTaskStore } from "@/stores/taskStore";
import { useTicketStore } from "@/stores/ticketStore";
import type { WindowMode } from "@sidstack/shared";

// Entity linking types
type EntityType = "none" | "task" | "module" | "ticket";

interface EntityOption {
  value: EntityType;
  label: string;
  icon: React.ReactNode;
}

const ENTITY_OPTIONS: EntityOption[] = [
  { value: "none", label: "None", icon: <Link2 className="w-4 h-4" /> },
  { value: "task", label: "Task", icon: <ListTodo className="w-4 h-4" /> },
  { value: "module", label: "Module", icon: <Box className="w-4 h-4" /> },
  { value: "ticket", label: "Ticket", icon: <Ticket className="w-4 h-4" /> },
];

// Default prompt templates based on entity type
const DEFAULT_PROMPTS: Record<EntityType, (entityTitle?: string) => string> = {
  none: () => "",
  task: (title) => title
    ? `Please work on the task: "${title}"\n\nRead the task context above and implement it following the acceptance criteria.`
    : "Please work on the linked task. Read the task context and implement it following the acceptance criteria.",
  module: (name) => name
    ? `Please review and work on the "${name}" module.\n\nExplore the module structure and help with any improvements or bug fixes.`
    : "Please review and work on the linked module. Explore the structure and help with improvements.",
  ticket: (title) => title
    ? `Please resolve the ticket: "${title}"\n\nRead the ticket description and implement the required changes.`
    : "Please resolve the linked ticket. Read the description and implement the required changes.",
};

interface LaunchSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspacePath?: string;
  // Pre-selected entities (from context menu actions)
  taskId?: string;
  moduleId?: string;
  ticketId?: string;
  onLaunch: (options: {
    prompt?: string;
    terminal: string;
    mode: string;
    windowMode?: WindowMode;
    // Entity linking
    taskId?: string;
    moduleId?: string;
    ticketId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

interface TerminalOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

interface ModeOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  variant?: "default" | "warning";
}

// rendering-hoist-jsx: Hoist static data outside component
const TERMINAL_OPTIONS: TerminalOption[] = [
  { value: "iTerm", label: "iTerm", description: "Feature-rich terminal" },
  { value: "Terminal", label: "Terminal.app", description: "macOS default" },
  { value: "Warp", label: "Warp", description: "AI-powered terminal" },
  { value: "Alacritty", label: "Alacritty", description: "GPU-accelerated" },
  { value: "kitty", label: "Kitty", description: "Fast, feature-rich" },
  { value: "ghostty", label: "Ghostty", description: "Native performance" },
  { value: "Hyper", label: "Hyper", description: "Electron-based terminal" },
];

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "normal",
    label: "Normal",
    icon: <Terminal className="w-4 h-4" />,
    description: "Standard mode with permission prompts",
  },
  {
    value: "skip-permissions",
    label: "Skip Permissions",
    icon: <Zap className="w-4 h-4" />,
    description: "Auto-approve all tool calls",
    variant: "warning",
  },
  {
    value: "continue",
    label: "Continue",
    icon: <RotateCcw className="w-4 h-4" />,
    description: "Resume from last session",
  },
  {
    value: "verbose",
    label: "Verbose",
    icon: <FileText className="w-4 h-4" />,
    description: "Show detailed output",
  },
];

interface WindowModeOption {
  value: WindowMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const WINDOW_MODE_OPTIONS: WindowModeOption[] = [
  {
    value: "always-new",
    label: "New Window",
    icon: <SquarePlus className="w-4 h-4" />,
    description: "Always create a new terminal window",
  },
  {
    value: "per-project-tabs",
    label: "Project Tabs",
    icon: <Layers className="w-4 h-4" />,
    description: "One window per project, sessions as tabs",
  },
  {
    value: "per-project-splits",
    label: "Split Panes",
    icon: <SplitSquareHorizontal className="w-4 h-4" />,
    description: "One window per project, split into panes (iTerm only)",
  },
];

// rerender-memo: Memoize component
export const LaunchSessionDialog = memo(function LaunchSessionDialog({
  open,
  onOpenChange,
  workspacePath,
  taskId: propTaskId,
  moduleId: propModuleId,
  ticketId: propTicketId,
  onLaunch,
}: LaunchSessionDialogProps) {
  const { windowMode: storeWindowMode, setWindowMode: setStoreWindowMode } = useClaudeSessionStore();
  const { settings: projectSettings, loadSettings } = useProjectSettingsStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { tickets, fetchTickets } = useTicketStore();
  const modules: Array<{ id: string; name: string; description?: string; totalSessions?: number; totalDecisions?: number }> = [];
  const loadModules = () => {};
  const { completeMilestone } = useOnboardingStore();

  const [prompt, setPrompt] = useState("");
  const [terminal, setTerminal] = useState(projectSettings.session.defaultTerminal);
  const [mode, setMode] = useState(projectSettings.session.defaultMode);
  const [windowMode, setWindowMode] = useState<WindowMode>(
    projectSettings.session.windowMode || storeWindowMode
  );
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Entity selection state
  const [entityType, setEntityType] = useState<EntityType>("none");
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(propTaskId);
  const [selectedModuleId, setSelectedModuleId] = useState<string | undefined>(propModuleId);
  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>(propTicketId);

  // Context preview state
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Determine initial entity type from props
  useEffect(() => {
    if (propTaskId) {
      setEntityType("task");
      setSelectedTaskId(propTaskId);
    } else if (propModuleId) {
      setEntityType("module");
      setSelectedModuleId(propModuleId);
    } else if (propTicketId) {
      setEntityType("ticket");
      setSelectedTicketId(propTicketId);
    }
  }, [propTaskId, propModuleId, propTicketId]);

  // Fetch entities when dialog opens
  useEffect(() => {
    if (open) {
      fetchTasks();
      fetchTickets();
      loadModules();
    }
  }, [open, fetchTasks, fetchTickets, loadModules]);

  // Load project settings when dialog opens and workspace is available
  useEffect(() => {
    if (open && workspacePath && !settingsLoaded) {
      loadSettings(workspacePath).then(() => {
        setSettingsLoaded(true);
      });
    }
  }, [open, workspacePath, settingsLoaded, loadSettings]);

  // Apply project defaults when settings are loaded
  useEffect(() => {
    if (settingsLoaded) {
      setTerminal(projectSettings.session.defaultTerminal);
      setMode(projectSettings.session.defaultMode);
      setWindowMode(projectSettings.session.windowMode);
    }
  }, [settingsLoaded, projectSettings.session]);

  // Reset settingsLoaded when workspace changes
  useEffect(() => {
    setSettingsLoaded(false);
  }, [workspacePath]);

  // js-cache-function-results: Memoize derived values
  const canLaunch = useMemo(
    () => !!workspacePath && !isLaunching,
    [workspacePath, isLaunching]
  );

  // Generate context preview based on selected entity
  const contextPreview = useMemo(() => {
    if (entityType === "none") return null;

    let title = "";
    let summary = "";
    let details: { label: string; value: string }[] = [];

    switch (entityType) {
      case "task": {
        const task = tasks.find(t => t.id === selectedTaskId);
        if (task) {
          title = task.title;
          summary = task.description?.slice(0, 200) || "No description";
          details = [
            { label: "Status", value: task.status },
            { label: "Priority", value: task.priority },
          ];
          if (task.acceptanceCriteria && Array.isArray(task.acceptanceCriteria)) {
            details.push({ label: "Criteria", value: `${task.acceptanceCriteria.length} items` });
          }
        }
        break;
      }
      case "module": {
        const mod = modules.find(m => m.id === selectedModuleId);
        if (mod) {
          title = mod.name;
          summary = mod.description || "No description";
          details = [
            { label: "Sessions", value: String(mod.totalSessions || 0) },
            { label: "Decisions", value: String(mod.totalDecisions || 0) },
          ];
        }
        break;
      }
      case "ticket": {
        const ticket = tickets.find(t => t.id === selectedTicketId);
        if (ticket) {
          title = ticket.title;
          summary = ticket.description?.slice(0, 200) || "No description";
          details = [
            { label: "Type", value: ticket.type },
            { label: "Priority", value: ticket.priority },
            { label: "Status", value: ticket.status },
          ];
        }
        break;
      }
    }

    if (!title) return null;

    return { title, summary, details };
  }, [entityType, selectedTaskId, selectedModuleId, selectedTicketId, tasks, modules, tickets]);

  // rerender-functional-setstate: Stable callbacks
  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(e.target.value);
      setError(null);
    },
    []
  );

  const handleTerminalChange = useCallback((value: string) => {
    setTerminal(value as typeof terminal);
  }, []);

  const handleModeChange = useCallback((value: string) => {
    setMode(value as typeof mode);
  }, []);

  const handleWindowModeChange = useCallback((value: string) => {
    const newMode = value as WindowMode;
    setWindowMode(newMode);
    // Also save to store for persistence
    setStoreWindowMode(newMode);
  }, [setStoreWindowMode]);

  const handleEntityTypeChange = useCallback((value: string) => {
    const newType = value as EntityType;
    setEntityType(newType);
    // Clear selections when changing type
    if (newType !== "task") setSelectedTaskId(undefined);
    if (newType !== "module") setSelectedModuleId(undefined);
    if (newType !== "ticket") setSelectedTicketId(undefined);
    // Clear prompt when switching to none
    if (newType === "none") {
      setPrompt("");
    }
  }, []);

  const handleTaskSelect = useCallback((value: string) => {
    setSelectedTaskId(value);
    // Find task title and set default prompt
    const task = tasks.find(t => t.id === value);
    if (task) {
      setPrompt(DEFAULT_PROMPTS.task(task.title));
    }
  }, [tasks]);

  const handleModuleSelect = useCallback((value: string) => {
    setSelectedModuleId(value);
    // Find module name and set default prompt
    const mod = modules.find(m => m.id === value);
    setPrompt(DEFAULT_PROMPTS.module(mod?.name || value));
  }, [modules]);

  const handleTicketSelect = useCallback((value: string) => {
    setSelectedTicketId(value);
    // Find ticket title and set default prompt
    const ticket = tickets.find(t => t.id === value);
    if (ticket) {
      setPrompt(DEFAULT_PROMPTS.ticket(ticket.title));
    }
  }, [tickets]);

  // Get current entity IDs based on selection
  const getSelectedEntityIds = useCallback(() => {
    switch (entityType) {
      case "task":
        return { taskId: selectedTaskId };
      case "module":
        return { moduleId: selectedModuleId };
      case "ticket":
        return { ticketId: selectedTicketId };
      default:
        return {};
    }
  }, [entityType, selectedTaskId, selectedModuleId, selectedTicketId]);

  const handleLaunch = useCallback(async () => {
    if (!canLaunch) return;

    setIsLaunching(true);
    setError(null);

    try {
      const entityIds = getSelectedEntityIds();
      const result = await onLaunch({
        prompt: prompt.trim() || undefined,
        terminal,
        mode,
        windowMode,
        ...entityIds,
      });

      if (result.success) {
        // Track onboarding milestone
        completeMilestone("sessionLaunched");

        // Reset form to project defaults and close
        setPrompt("");
        setTerminal(projectSettings.session.defaultTerminal);
        setMode(projectSettings.session.defaultMode);
        // Keep windowMode as it's a preference
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to launch session");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLaunching(false);
    }
  }, [canLaunch, prompt, terminal, mode, windowMode, getSelectedEntityIds, onLaunch, onOpenChange, projectSettings.session, completeMilestone]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Reset state on close
        setError(null);
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Launch Claude Session
          </DialogTitle>
          <DialogDescription>
            Start a new Claude Code session in an external terminal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-6">
          {/* Entity Linking */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Link to Context</Label>
            <div className="grid grid-cols-2 gap-3">
              {/* Entity Type Selection */}
              <Select value={entityType} onValueChange={handleEntityTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} icon={opt.icon}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Entity Selector based on type */}
              {entityType === "task" ? (
                <Select value={selectedTaskId || ""} onValueChange={handleTaskSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select task..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((task) => (
                      <SelectItem
                        key={task.id}
                        value={task.id}
                        description={`${task.status} | ${task.priority}`}
                      >
                        {task.title.slice(0, 40)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : entityType === "module" ? (
                <Select value={selectedModuleId || ""} onValueChange={handleModuleSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select module..." />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.length > 0 ? (
                      modules.map((mod) => (
                        <SelectItem
                          key={mod.id}
                          value={mod.id}
                          description={mod.description || `${mod.totalSessions || 0} sessions`}
                        >
                          {mod.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-modules" disabled>
                        No modules defined
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : entityType === "ticket" ? (
                <Select value={selectedTicketId || ""} onValueChange={handleTicketSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ticket..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tickets.length > 0 ? (
                      tickets.map((ticket) => (
                        <SelectItem
                          key={ticket.id}
                          value={ticket.id}
                          description={`${ticket.type} | ${ticket.priority}`}
                        >
                          {ticket.title.slice(0, 40)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-tickets" disabled>
                        No tickets available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center justify-center text-sm text-[var(--text-muted)] bg-[var(--surface-1)] rounded-md border border-[var(--surface-3)]">
                  No context linked
                </div>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {entityType !== "none"
                ? "Claude will receive context from the linked entity"
                : "Link a task, module, or ticket to inject context"}
            </p>
          </div>

          {/* Context Preview */}
          {contextPreview ? (
            <div className="rounded-lg border border-[var(--surface-3)] bg-[var(--surface-1)] overflow-hidden">
              <button
                type="button"
                onClick={() => setPreviewExpanded(!previewExpanded)}
                className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-[var(--surface-2)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-sm font-medium">Context Preview</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    ({contextPreview.title.slice(0, 30)}{contextPreview.title.length > 30 ? "..." : ""})
                  </span>
                </div>
                {previewExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </button>
              {previewExpanded ? (
                <div className="px-3 pb-3 space-y-2 border-t border-[var(--surface-3)]">
                  <div className="pt-2">
                    <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                      {entityType}
                    </p>
                    <p className="text-sm font-medium mt-1">{contextPreview.title}</p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-3">
                    {contextPreview.summary}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {contextPreview.details.map((detail, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)]"
                      >
                        {detail.label}: {detail.value}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Initial Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt" className="text-sm font-medium">
              Initial Prompt
              <span className="ml-1 text-[var(--text-muted)] font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="prompt"
              placeholder="Enter instructions for Claude to start with..."
              value={prompt}
              onChange={handlePromptChange}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-[var(--text-muted)]">
              Claude will begin working on this prompt immediately after launch
            </p>
          </div>

          {/* Terminal & Mode Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Terminal Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Terminal</Label>
              <Select value={terminal} onValueChange={handleTerminalChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select terminal" />
                </SelectTrigger>
                <SelectContent>
                  {TERMINAL_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      description={opt.description}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mode Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Mode</Label>
              <Select value={mode} onValueChange={handleModeChange}>
                <SelectTrigger
                  className={cn(
                    mode === "skip-permissions" &&
                      "border-[var(--color-warning)]/50 text-[var(--color-warning)]"
                  )}
                >
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      icon={
                        <span className={opt.variant === "warning" ? "text-[var(--color-warning)]" : undefined}>
                          {opt.icon}
                        </span>
                      }
                      description={opt.description}
                      className={opt.variant === "warning" ? "text-[var(--color-warning)]" : undefined}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Window Mode Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Window Mode</Label>
            <Select value={windowMode} onValueChange={handleWindowModeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select window mode" />
              </SelectTrigger>
              <SelectContent>
                {WINDOW_MODE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    icon={opt.icon}
                    description={opt.description}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-muted)]">
              {windowMode === "always-new"
                ? "Each session opens in a new window"
                : windowMode === "per-project-tabs"
                  ? "Sessions for this project will open as tabs in the same window"
                  : "Sessions for this project will open as split panes (iTerm only)"}
            </p>
          </div>

          {/* Warning for skip-permissions */}
          {mode === "skip-permissions" ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
              <Shield className="w-4 h-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-[var(--color-warning)]">
                  Skip Permissions Mode
                </p>
                <p className="text-[var(--text-muted)] mt-0.5">
                  Claude will execute all tool calls without asking for
                  confirmation. Use with caution.
                </p>
              </div>
            </div>
          ) : null}

          {/* Error Message */}
          {error ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--color-error)]/15 border border-[var(--color-error)]/25">
              <AlertCircle className="w-4 h-4 text-[var(--color-error)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </div>
          ) : null}

          {/* Workspace Path Info */}
          {!workspacePath ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--surface-2)]">
              <AlertCircle className="w-4 h-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--text-muted)]">
                No workspace selected. Please select a project first.
              </p>
            </div>
          ) : null}

          {/* Launch Button */}
          <Button
            onClick={handleLaunch}
            disabled={!canLaunch}
            className="w-full h-11 text-sm font-medium"
            size="lg"
          >
            {isLaunching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Terminal className="w-4 h-4" />
                Launch Session
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default LaunchSessionDialog;
