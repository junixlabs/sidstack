/**
 * TeamCreateDialog Component
 *
 * Dialog for creating a new agent team with configuration options.
 */

import {
  Users,
  AlertCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Plus,
  X,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";

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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useTeamStore, CreateTeamInput } from "@/stores/teamStore";

// Available agent types
const AGENT_TYPES = [
  { id: "dev", label: "Developer", description: "Code implementation" },
  { id: "qa", label: "QA", description: "Testing & validation" },
  { id: "frontend", label: "Frontend", description: "UI development" },
  { id: "backend", label: "Backend", description: "API & services" },
  { id: "devops", label: "DevOps", description: "Infrastructure" },
  { id: "docs", label: "Docs", description: "Documentation" },
];

interface MemberInput {
  role: string;
  agentType: string;
}

interface TeamCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (teamId: string) => void;
}

export function TeamCreateDialog({ isOpen, onClose, onSuccess }: TeamCreateDialogProps) {
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [autoRecovery, setAutoRecovery] = useState(true);
  const [maxRecoveryAttempts, setMaxRecoveryAttempts] = useState(3);
  const [members, setMembers] = useState<MemberInput[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { projectPath } = useAppStore();
  const { createTeam } = useTeamStore();

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setTeamName("");
      setDescription("");
      setAutoRecovery(true);
      setMaxRecoveryAttempts(3);
      setMembers([]);
      setShowAdvanced(false);
      setError(null);
    }
  }, [isOpen]);

  const handleAddMember = useCallback((agentType: string) => {
    const roleIndex = members.filter((m) => m.agentType === agentType).length + 1;
    const role = roleIndex > 1 ? `${agentType}-${roleIndex}` : agentType;
    setMembers([...members, { role, agentType }]);
  }, [members]);

  const handleRemoveMember = useCallback((index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  }, [members]);

  const handleCreate = useCallback(async () => {
    if (!teamName.trim()) {
      setError("Team name is required");
      return;
    }

    if (!projectPath) {
      setError("Please open a project first");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const input: CreateTeamInput = {
        name: teamName.trim(),
        projectPath,
        autoRecovery,
        maxRecoveryAttempts,
        members: members.length > 0 ? members : undefined,
        description: description.trim() || undefined,
      };

      const result = await createTeam(input);
      onSuccess?.(result.config.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCreating(false);
    }
  }, [teamName, description, projectPath, autoRecovery, maxRecoveryAttempts, members, createTeam, onSuccess, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && projectPath && teamName.trim()) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--surface-2)]">
              <Users className="w-5 h-5 text-[var(--text-secondary)]" />
            </div>
            <div>
              <DialogTitle>Create Team</DialogTitle>
              <DialogDescription>
                Create a coordinated team of AI agents
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4 max-h-[60vh] overflow-y-auto">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-muted)]">
              <AlertCircle className="w-5 h-5 text-[var(--text-secondary)] shrink-0" />
              <span className="text-sm text-[var(--text-secondary)]">{error}</span>
            </div>
          )}

          {/* Warning: No project */}
          {!projectPath && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-muted)]">
              <AlertTriangle className="w-5 h-5 text-[var(--text-secondary)] shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--text-secondary)]">No project open</p>
                <p className="text-xs mt-0.5 text-[var(--text-muted)]">
                  Please open a project first before creating a team
                </p>
              </div>
            </div>
          )}

          {/* Team Name Input */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--text-muted)]" />
              Team Name
              <span className="text-[var(--text-secondary)]">*</span>
            </Label>
            <Input
              ref={inputRef}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Feature Team Alpha"
              disabled={!projectPath}
              className={cn(!projectPath && "opacity-50 cursor-not-allowed")}
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Description
              <span className="text-xs font-normal text-[var(--text-muted)]">(optional)</span>
            </Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the team's purpose"
              disabled={!projectPath}
              className={cn(!projectPath && "opacity-50 cursor-not-allowed")}
            />
          </div>

          {/* Auto Recovery Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-2)]">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-[var(--text-secondary)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Auto Recovery</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Automatically restart failed agents
                </p>
              </div>
            </div>
            <Switch
              checked={autoRecovery}
              onCheckedChange={setAutoRecovery}
              disabled={!projectPath}
            />
          </div>

          {/* Members Section */}
          <div className="space-y-3">
            <Label>Team Members</Label>

            {/* Add member buttons */}
            <div className="flex flex-wrap gap-2">
              {AGENT_TYPES.map((type) => (
                <Button
                  key={type.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleAddMember(type.id)}
                  disabled={!projectPath}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {type.label}
                </Button>
              ))}
            </div>

            {/* Member list */}
            {members.length > 0 && (
              <div className="space-y-2 mt-3">
                {members.map((member, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded bg-[var(--surface-2)]"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {member.agentType}
                      </Badge>
                      <span className="text-sm text-[var(--text-secondary)]">
                        @{member.role}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6"
                      onClick={() => handleRemoveMember(index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {members.length === 0 && (
              <p className="text-xs text-[var(--text-muted)]">
                Add members now or later. Orchestrator is created automatically.
              </p>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {showAdvanced ? "Hide" : "Show"} advanced settings
            </button>

            {showAdvanced && (
              <div className="space-y-3 p-3 rounded-lg bg-[var(--surface-2)]">
                <div className="space-y-2">
                  <Label className="text-xs">Max Recovery Attempts</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={maxRecoveryAttempts}
                    onChange={(e) => setMaxRecoveryAttempts(parseInt(e.target.value) || 3)}
                    disabled={!projectPath || !autoRecovery}
                    className="h-8 text-sm"
                  />
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Number of times to attempt recovery before giving up
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !projectPath || !teamName.trim()}
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-1" />
                Create Team
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TeamCreateDialog;
