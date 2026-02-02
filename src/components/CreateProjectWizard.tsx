/**
 * CreateProjectWizard - Multi-step wizard for creating/initializing a SidStack project
 *
 * Steps:
 * 1. Select project directory
 * 2. Choose project template
 * 3. Configure project settings
 * 4. Initialize project
 */

import { open } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen,
  Layers,
  Settings,
  Rocket,
  Check,
  ChevronRight,
  ChevronLeft,
  Globe,
  Server,
  Smartphone,
  Wrench,
  Loader2,
} from "lucide-react";
import { useState, useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { mcpCall } from "@/lib/ipcClient";
import { cn } from "@/lib/utils";



interface CreateProjectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (projectPath: string) => void;
}

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: typeof Globe;
  tags: string[];
}

const TEMPLATES: ProjectTemplate[] = [
  {
    id: "generic",
    name: "Generic Project",
    description: "A blank project with basic SidStack configuration",
    icon: Layers,
    tags: ["any"],
  },
  {
    id: "web",
    name: "Web Application",
    description: "React/Vue/Next.js frontend with agents for UI development",
    icon: Globe,
    tags: ["frontend", "react", "typescript"],
  },
  {
    id: "api",
    name: "API Server",
    description: "Backend API with agents for endpoints, database, testing",
    icon: Server,
    tags: ["backend", "api", "node"],
  },
  {
    id: "mobile",
    name: "Mobile App",
    description: "React Native or Flutter mobile application",
    icon: Smartphone,
    tags: ["mobile", "react-native"],
  },
  {
    id: "devops",
    name: "DevOps/Infra",
    description: "Infrastructure as code with CI/CD pipelines",
    icon: Wrench,
    tags: ["devops", "terraform", "docker"],
  },
];

type WizardStep = "directory" | "template" | "settings" | "initializing";

const STEPS: { id: WizardStep; label: string; icon: typeof FolderOpen }[] = [
  { id: "directory", label: "Directory", icon: FolderOpen },
  { id: "template", label: "Template", icon: Layers },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "initializing", label: "Initialize", icon: Rocket },
];


export function CreateProjectWizard({
  open: isOpen,
  onOpenChange,
  onComplete,
}: CreateProjectWizardProps) {
  const [step, setStep] = useState<WizardStep>("directory");
  const [projectPath, setProjectPath] = useState<string>("");
  const [projectName, setProjectName] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("generic");
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog closes
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setStep("directory");
      setProjectPath("");
      setProjectName("");
      setSelectedTemplate("generic");
      setInitializing(false);
      setError(null);
    }
    onOpenChange(open);
  }, [onOpenChange]);

  // Step 1: Select directory
  const handleSelectDirectory = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Directory",
      });
      if (selected && typeof selected === "string") {
        setProjectPath(selected);
        // Extract project name from path
        const name = selected.split("/").pop() || "my-project";
        setProjectName(name);
      }
    } catch (err) {
      console.error("Failed to select directory:", err);
    }
  }, []);

  // Navigate steps
  const goNext = useCallback(() => {
    const stepIndex = STEPS.findIndex((s) => s.id === step);
    if (stepIndex < STEPS.length - 1) {
      setStep(STEPS[stepIndex + 1].id);
    }
  }, [step]);

  const goBack = useCallback(() => {
    const stepIndex = STEPS.findIndex((s) => s.id === step);
    if (stepIndex > 0) {
      setStep(STEPS[stepIndex - 1].id);
    }
  }, [step]);

  // Step 4: Initialize project
  const handleInitialize = useCallback(async () => {
    setInitializing(true);
    setError(null);
    try {
      // Call MCP to initialize project
      await mcpCall("knowledge_store", {
        title: `Project: ${projectName}`,
        content: JSON.stringify({
          name: projectName,
          path: projectPath,
          template: selectedTemplate,
          createdAt: new Date().toISOString(),
        }),
        type: "reference",
        tags: ["project", selectedTemplate],
      });

      // Complete the wizard
      onComplete(projectPath);
      handleOpenChange(false);
    } catch (err) {
      console.error("Failed to initialize project:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize project");
      // Still complete even if MCP fails - the main thing is setting the project path
      onComplete(projectPath);
      handleOpenChange(false);
    } finally {
      setInitializing(false);
    }
  }, [projectPath, projectName, selectedTemplate, onComplete, handleOpenChange]);

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const canProceed = {
    directory: !!projectPath,
    template: !!selectedTemplate,
    settings: !!projectName,
    initializing: false,
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Set up a new SidStack project with agents and orchestration
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4 border-b border-[var(--border-muted)]">
          {STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isCompleted = index < currentStepIndex;

            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors",
                    isActive
                      ? "bg-[var(--surface-3)] text-[var(--text-secondary)]"
                      : isCompleted
                      ? "bg-[var(--surface-2)] text-[var(--text-secondary)]"
                      : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                  {s.label}
                </div>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[280px] py-4 px-6">
          {/* Step 1: Directory */}
          {step === "directory" && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <FolderOpen className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                <h3 className="text-[14px] font-medium text-[var(--text-primary)] mb-2">
                  Select Project Directory
                </h3>
                <p className="text-[12px] text-[var(--text-muted)] mb-4">
                  Choose a folder for your new project or select an existing project
                </p>
                <Button onClick={handleSelectDirectory}>
                  <FolderOpen className="w-4 h-4" />
                  Browse...
                </Button>
              </div>
              {projectPath && (
                <div className="p-3 rounded-lg bg-[var(--surface-0)] border border-[var(--border-muted)]">
                  <span className="text-[11px] text-[var(--text-muted)]">Selected:</span>
                  <p className="text-[12px] text-[var(--text-primary)] font-mono truncate">
                    {projectPath}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Template */}
          {step === "template" && (
            <div className="space-y-3">
              <p className="text-[12px] text-[var(--text-muted)] mb-4">
                Choose a template that best matches your project type
              </p>
              {TEMPLATES.map((template) => {
                const Icon = template.icon;
                const isSelected = selectedTemplate === template.id;

                return (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                      isSelected
                        ? "bg-[var(--surface-3)] border-[var(--border-default)]"
                        : "bg-[var(--surface-0)] border-[var(--border-muted)] hover:border-[var(--border-default)]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5 flex-shrink-0",
                        isSelected ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={cn(
                            "text-[13px] font-medium",
                            isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                          )}
                        >
                          {template.name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">{template.description}</p>
                      <div className="flex gap-1 mt-1.5">
                        {template.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[11px] px-1.5 py-0"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 3: Settings */}
          {step === "settings" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] text-[var(--text-muted)] mb-1.5">
                  Project Name
                </label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="my-awesome-project"
                  className="bg-[var(--surface-0)]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--text-muted)] mb-1.5">
                  Project Path
                </label>
                <Input
                  value={projectPath}
                  disabled
                  className="bg-[var(--surface-0)] font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[12px] text-[var(--text-muted)] mb-1.5">
                  Template
                </label>
                <div className="p-3 rounded-lg bg-[var(--surface-0)] border border-[var(--border-muted)]">
                  <span className="text-[12px] text-[var(--text-primary)]">
                    {TEMPLATES.find((t) => t.id === selectedTemplate)?.name}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Initializing */}
          {step === "initializing" && (
            <div className="text-center py-8">
              {initializing ? (
                <>
                  <Loader2 className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-4 animate-spin" />
                  <h3 className="text-[14px] font-medium text-[var(--text-primary)] mb-2">
                    Initializing Project...
                  </h3>
                  <p className="text-[12px] text-[var(--text-muted)]">
                    Setting up agents and configuration
                  </p>
                </>
              ) : error ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center mx-auto mb-4">
                    <span className="text-[var(--text-secondary)] text-2xl">!</span>
                  </div>
                  <h3 className="text-[14px] font-medium text-[var(--text-primary)] mb-2">
                    Initialization Warning
                  </h3>
                  <p className="text-[12px] text-[var(--text-muted)] mb-4">{error}</p>
                </>
              ) : (
                <>
                  <Rocket className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                  <h3 className="text-[14px] font-medium text-[var(--text-primary)] mb-2">
                    Ready to Initialize
                  </h3>
                  <p className="text-[12px] text-[var(--text-muted)] mb-4">
                    Click Initialize to set up your SidStack project
                  </p>
                  <div className="text-left p-3 rounded-lg bg-[var(--surface-0)] border border-[var(--border-muted)] text-[11px] space-y-1">
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-[var(--text-secondary)]" />
                      <span className="text-[var(--text-muted)]">
                        Directory: <span className="text-[var(--text-primary)] font-mono">{projectPath}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-[var(--text-secondary)]" />
                      <span className="text-[var(--text-muted)]">
                        Template: <span className="text-[var(--text-primary)]">{TEMPLATES.find((t) => t.id === selectedTemplate)?.name}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-[var(--text-secondary)]" />
                      <span className="text-[var(--text-muted)]">
                        Name: <span className="text-[var(--text-primary)]">{projectName}</span>
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          {step !== "directory" && step !== "initializing" && (
            <Button variant="ghost" onClick={goBack}>
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step === "initializing" ? (
            <Button
              onClick={handleInitialize}
              disabled={initializing}
            >
              {initializing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  Initialize
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              disabled={!canProceed[step]}
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateProjectWizard;
