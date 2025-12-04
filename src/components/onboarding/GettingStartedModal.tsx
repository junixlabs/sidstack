import {
  CheckSquare,
  BookOpen,
  Layers,
  ArrowRight,
  Sparkles,
  Shield,
  GraduationCap,
  Ticket,
} from "lucide-react";
import { useState, useCallback } from "react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useOnboardingStore } from "@/stores/onboardingStore";

// Feature cards data
const VALUE_PROPOSITIONS = [
  {
    icon: CheckSquare,
    title: "Task Management",
    description: "Organize and track tasks with Kanban, tree, and list views",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    viewId: "task-manager",
    shortcut: "3",
  },
  {
    icon: BookOpen,
    title: "Knowledge Browser",
    description: "Browse and search project knowledge, patterns, and APIs",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    viewId: "knowledge-browser",
    shortcut: "2",
  },
  {
    icon: GraduationCap,
    title: "Training Room",
    description: "Learn from incidents, build lessons, skills, and enforcement rules",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    viewId: "training-room",
    shortcut: "6",
  },
  {
    icon: Shield,
    title: "Impact Analysis",
    description: "Analyze risks and validate changes before implementation",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    viewId: "impact-analysis",
    shortcut: "7",
  },
  {
    icon: Ticket,
    title: "Ticket Queue",
    description: "Receive external tickets and convert them to tasks",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    viewId: "ticket-queue",
    shortcut: "4",
  },
];

// Quick start options (shown as primary actions at bottom)
const QUICK_START_OPTIONS = [
  {
    id: "project-hub",
    label: "Project Hub",
    shortcut: "1",
    icon: Layers,
    description: "View project intelligence",
    primary: true,
  },
  {
    id: "task-manager",
    label: "Task Manager",
    shortcut: "2",
    icon: CheckSquare,
    description: "Manage tasks",
  },
];

interface GettingStartedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (viewId: string) => void;
  projectPath: string;
}

export function GettingStartedModal({
  open,
  onOpenChange,
  onNavigate,
  projectPath,
}: GettingStartedModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const { skipOnboarding, markProjectOnboarded, setDontShowAgain: persistDontShowAgain } =
    useOnboardingStore();

  // Handle skip
  const handleSkip = useCallback(() => {
    if (dontShowAgain) {
      persistDontShowAgain(true);
    }
    skipOnboarding(projectPath);
    onOpenChange(false);
  }, [dontShowAgain, persistDontShowAgain, skipOnboarding, projectPath, onOpenChange]);

  // Handle quick start navigation
  const handleQuickStart = useCallback(
    (viewId: string) => {
      markProjectOnboarded(projectPath);
      onOpenChange(false);
      onNavigate(viewId);
    },
    [markProjectOnboarded, projectPath, onOpenChange, onNavigate]
  );

  // Handle "Get Started" - navigate to project hub as default
  const handleGetStarted = useCallback(() => {
    markProjectOnboarded(projectPath);
    onOpenChange(false);
    onNavigate("project-hub");
  }, [markProjectOnboarded, projectPath, onOpenChange, onNavigate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden overflow-y-auto">
        {/* Header with gradient background */}
        <div className="relative px-6 pt-8 pb-6 bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface-1)]">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4">
              <Logo size="lg" />
            </div>
            <DialogHeader className="p-0 border-0">
              <DialogTitle className="text-2xl font-bold text-[var(--text-primary)]">
                Welcome to SidStack!
              </DialogTitle>
              <DialogDescription className="text-sm text-[var(--text-secondary)] mt-2">
                Your AI-powered development orchestrator
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Value Proposition Cards */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              What you can do with SidStack
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {VALUE_PROPOSITIONS.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={() => handleQuickStart(item.viewId)}
                  className={cn(
                    "p-4 rounded-lg border transition-all duration-200 text-left cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]",
                    hoveredCard === index
                      ? "bg-[var(--surface-2)] border-[var(--border-default)] scale-[1.02]"
                      : "bg-[var(--surface-1)] border-[var(--border-muted)]"
                  )}
                  onMouseEnter={() => setHoveredCard(index)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        item.bgColor
                      )}
                    >
                      <Icon className={cn("w-5 h-5", item.color)} />
                    </div>
                    <kbd className="flex items-center justify-center w-6 h-6 text-[10px] font-mono rounded bg-[var(--surface-2)] text-[var(--text-muted)]">
                      {item.shortcut}
                    </kbd>
                  </div>
                  <h3 className="font-medium text-sm text-[var(--text-primary)] mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Start Options */}
        <div className="px-6 py-4 bg-[var(--surface-0)]/50 border-t border-[var(--border-muted)]">
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3 block">
            Quick Start
          </span>
          <div className="flex gap-2">
            {QUICK_START_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isPrimary = "primary" in option && option.primary;
              return (
                <button
                  key={option.id}
                  onClick={() => handleQuickStart(option.id)}
                  className={cn(
                    "flex-1 flex items-center gap-3 p-3 rounded-lg",
                    "transition-all duration-200 group text-left",
                    isPrimary
                      ? "bg-[var(--accent-primary)] border border-[var(--accent-primary)] hover:opacity-90"
                      : "bg-[var(--surface-1)] border border-[var(--border-muted)] hover:bg-[var(--surface-2)] hover:border-[var(--border-default)]"
                  )}
                >
                  <Icon className={cn(
                    "w-4 h-4",
                    isPrimary
                      ? "text-white"
                      : "text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-sm font-medium truncate",
                      isPrimary ? "text-white" : "text-[var(--text-primary)]"
                    )}>
                      {option.label}
                    </div>
                    <div className={cn(
                      "text-xs",
                      isPrimary ? "text-white/90" : "text-[var(--text-muted)]"
                    )}>
                      {option.description}
                    </div>
                  </div>
                  <kbd className={cn(
                    "hidden sm:flex items-center justify-center w-6 h-6 text-[10px] font-mono rounded",
                    isPrimary
                      ? "bg-white/20 text-white"
                      : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                  )}>
                    {option.shortcut}
                  </kbd>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <span className="text-xs text-[var(--text-muted)]">
              Don't show this again for new projects
            </span>
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip for now
            </Button>
            <Button size="sm" onClick={handleGetStarted} className="gap-2">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GettingStartedModal;
