import {
  CheckSquare,
  BookOpen,
  ArrowRight,
  Sparkles,
  GraduationCap,
  Ticket,
  Terminal,
  Copy,
  Check,
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
    title: "Task Manager",
    description: "Organize and track tasks with Kanban, tree, and list views",
    color: "text-[var(--feature-tasks)]",
    bgColor: "bg-[var(--feature-tasks)]/10",
    viewId: "task-manager",
    shortcut: "2",
  },
  {
    icon: BookOpen,
    title: "Knowledge Browser",
    description: "Browse and search project knowledge, patterns, and APIs",
    color: "text-[var(--feature-knowledge)]",
    bgColor: "bg-[var(--feature-knowledge)]/10",
    viewId: "knowledge",
    shortcut: "3",
  },
  {
    icon: Ticket,
    title: "Ticket Queue",
    description: "Receive external tickets and convert them to tasks",
    color: "text-[var(--feature-tickets)]",
    bgColor: "bg-[var(--feature-tickets)]/10",
    viewId: "ticket-queue",
    shortcut: "4",
  },
  {
    icon: GraduationCap,
    title: "Training Room",
    description: "Learn from incidents, build lessons, skills, and enforcement rules",
    color: "text-[var(--feature-training)]",
    bgColor: "bg-[var(--feature-training)]/10",
    viewId: "training-room",
    shortcut: "5",
  },
];

const SETUP_STEPS = [
  {
    label: "Initialize your project",
    command: "npx @sidstack/cli init --scan",
    description: "Sets up governance, MCP config, and generates knowledge docs with AI",
  },
  {
    label: "Use in Claude Code",
    command: "/sidstack",
    description: "Project dashboard — tasks, tickets, impact, focus, and governance",
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
  const [copied, setCopied] = useState(false);

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
                AI-Powered Project Intelligence Platform
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
          <div className="grid grid-cols-2 gap-3">
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
                    <kbd className="flex items-center justify-center w-6 h-6 text-[11px] font-mono rounded bg-[var(--surface-2)] text-[var(--text-muted)]">
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

        {/* Use with Claude Code */}
        <div className="px-6 py-4 bg-[var(--surface-0)]/50 border-t border-[var(--border-muted)]">
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Use with Claude Code
            </span>
          </div>
          <div className="space-y-3">
            {SETUP_STEPS.map((step, index) => (
              <div key={index} className="flex gap-3">
                <div className="shrink-0 w-5 h-5 rounded-full bg-[var(--accent-primary)] text-white text-xs flex items-center justify-center font-medium mt-0.5">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[var(--text-primary)] mb-1">
                    {step.label}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <code className="bg-[var(--surface-2)] rounded px-2 py-0.5 text-xs font-mono text-[var(--accent-primary)]">
                      {step.command}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(step.command);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors"
                      aria-label={`Copy ${step.command}`}
                    >
                      {copied
                        ? <Check className="w-3 h-3 text-[var(--color-success)]" />
                        : <Copy className="w-3 h-3 text-[var(--text-muted)]" />
                      }
                    </button>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {step.description}
                  </div>
                </div>
              </div>
            ))}
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
