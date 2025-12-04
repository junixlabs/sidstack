import { Shield, Loader2, Check, X, BookOpen, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useGovernanceCheck } from "@/hooks/useGovernanceCheck";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";

export function GovernancePrompt() {
  const { status, installGovernance, dismissPrompt, showPrompt } = useGovernanceCheck();
  const projectPath = useAppStore((state) => state.projectPath);
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === "dark";

  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  const handleInstall = async () => {
    setIsInstalling(true);
    setInstallError(null);

    const success = await installGovernance();

    setIsInstalling(false);

    if (success) {
      setInstallSuccess(true);
      // Auto-close after success
      setTimeout(() => {
        setInstallSuccess(false);
      }, 2000);
    } else {
      setInstallError(status.error || "Installation failed");
    }
  };

  const handleDismiss = () => {
    dismissPrompt();
  };

  // Don't show if no project or prompt already dismissed
  if (!projectPath || !showPrompt) {
    return null;
  }

  const projectName = projectPath.split("/").pop() || "Project";

  return (
    <Dialog open={showPrompt && !installSuccess} onOpenChange={() => handleDismiss()}>
      <DialogContent
        className={cn(
          "max-w-lg",
          isDark ? "" : "bg-white border-gray-200"
        )}
      >
        <DialogHeader className={cn(isDark ? "" : "border-gray-200")}>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-lg",
                isDark ? "bg-[var(--surface-2)]" : "bg-gray-50"
              )}
            >
              <Shield
                className={cn(
                  "w-5 h-5",
                  isDark ? "text-[var(--text-secondary)]" : "text-gray-600"
                )}
              />
            </div>
            <div>
              <DialogTitle className={cn(isDark ? "" : "text-gray-900")}>
                Enable Governance for {projectName}?
              </DialogTitle>
              <DialogDescription className={cn("mt-1", isDark ? "" : "text-gray-500")}>
                Enhance agent quality with principles, skills, and workflows
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className={cn("px-6 py-4", isDark ? "" : "bg-gray-50")}>
          {/* Benefits list */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "p-1.5 rounded-md mt-0.5",
                  isDark ? "bg-[var(--surface-2)]" : "bg-gray-50"
                )}
              >
                <Check
                  className={cn(
                    "w-3.5 h-3.5",
                    isDark ? "text-[var(--text-secondary)]" : "text-gray-600"
                  )}
                />
              </div>
              <div>
                <div
                  className={cn(
                    "text-sm font-medium",
                    isDark ? "text-[var(--text-primary)]" : "text-gray-900"
                  )}
                >
                  Agent Principles
                </div>
                <div
                  className={cn(
                    "text-xs mt-0.5",
                    isDark ? "text-[var(--text-muted)]" : "text-gray-500"
                  )}
                >
                  Code quality, testing, security, and collaboration standards
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "p-1.5 rounded-md mt-0.5",
                  isDark ? "bg-[var(--surface-2)]" : "bg-gray-50"
                )}
              >
                <Sparkles
                  className={cn(
                    "w-3.5 h-3.5",
                    isDark ? "text-[var(--text-secondary)]" : "text-gray-600"
                  )}
                />
              </div>
              <div>
                <div
                  className={cn(
                    "text-sm font-medium",
                    isDark ? "text-[var(--text-primary)]" : "text-gray-900"
                  )}
                >
                  Role-Based Skills
                </div>
                <div
                  className={cn(
                    "text-xs mt-0.5",
                    isDark ? "text-[var(--text-muted)]" : "text-gray-500"
                  )}
                >
                  Structured processes for dev, QA, BA, and DA agents
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "p-1.5 rounded-md mt-0.5",
                  isDark ? "bg-[var(--surface-2)]" : "bg-gray-50"
                )}
              >
                <BookOpen
                  className={cn(
                    "w-3.5 h-3.5",
                    isDark ? "text-[var(--text-secondary)]" : "text-gray-600"
                  )}
                />
              </div>
              <div>
                <div
                  className={cn(
                    "text-sm font-medium",
                    isDark ? "text-[var(--text-primary)]" : "text-gray-900"
                  )}
                >
                  Slash Commands
                </div>
                <div
                  className={cn(
                    "text-xs mt-0.5",
                    isDark ? "text-[var(--text-muted)]" : "text-gray-500"
                  )}
                >
                  /sidstack:agent, /sidstack:assistant, and more
                </div>
              </div>
            </div>
          </div>

          {/* Error message */}
          {installError && (
            <div
              className={cn(
                "mt-4 p-3 rounded-lg text-sm",
                isDark ? "bg-[var(--surface-2)] text-[var(--text-secondary)]" : "bg-gray-50 text-gray-600"
              )}
            >
              {installError}
            </div>
          )}
        </div>

        <DialogFooter className={cn(isDark ? "" : "border-gray-200 bg-white")}>
          <Button
            variant="ghost"
            onClick={handleDismiss}
            disabled={isInstalling}
            className={cn(
              isDark
                ? "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                : "text-gray-500 hover:text-gray-900"
            )}
          >
            <X className="w-4 h-4 mr-1.5" />
            Skip for now
          </Button>
          <Button
            onClick={handleInstall}
            disabled={isInstalling}
            className={cn(
              isDark
                ? "bg-[var(--surface-3)] hover:bg-[var(--surface-4)] text-[var(--text-primary)]"
                : "bg-gray-600 hover:bg-gray-700 text-white"
            )}
          >
            {isInstalling ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-1.5" />
                Enable Governance
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
