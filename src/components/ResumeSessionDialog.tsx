/**
 * ResumeSessionDialog - Prompt user to resume previous Claude Code sessions
 *
 * Shows when saved role-session mappings are found on app startup.
 * User can select which roles to resume or start fresh.
 */

import { RefreshCw, Play, X, Clock, User } from "lucide-react";
import { useState, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
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

export interface SessionInfo {
  sessionId: string;
  sessionName?: string;
  lastActive: string;
}

export interface RoleSessionMapping {
  projectPath: string;
  savedAt: string;
  roles: Record<string, SessionInfo>;
}

interface ResumeSessionDialogProps {
  isOpen: boolean;
  mapping: RoleSessionMapping;
  onResume: (roles: string[]) => void;
  onFreshStart: () => void;
  onClose: () => void;
}

/**
 * Format time distance in a human-readable way
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
}

export function ResumeSessionDialog({
  isOpen,
  mapping,
  onResume,
  onFreshStart,
  onClose,
}: ResumeSessionDialogProps) {
  const roleNames = useMemo(() => Object.keys(mapping.roles), [mapping.roles]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(
    () => new Set(roleNames)
  );

  const savedAgo = useMemo(() => formatTimeAgo(mapping.savedAt), [mapping.savedAt]);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const handleResumeSelected = () => {
    onResume(Array.from(selectedRoles));
  };

  const handleResumeAll = () => {
    onResume(roleNames);
  };

  const selectedCount = selectedRoles.size;
  const totalCount = roleNames.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-500" />
            Resume Previous Session?
          </DialogTitle>
          <DialogDescription>
            Found a saved session from {savedAgo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project path */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Project:</span>
            <code className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono truncate max-w-[280px]">
              {mapping.projectPath}
            </code>
          </div>

          {/* Role checkboxes */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select roles to resume:
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {roleNames.map((role) => {
                const info = mapping.roles[role];
                return (
                  <label
                    key={role}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                      "hover:bg-gray-100 dark:hover:bg-gray-800",
                      selectedRoles.has(role) && "bg-blue-50 dark:bg-blue-900/20"
                    )}
                  >
                    <Checkbox
                      checked={selectedRoles.has(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">@{role}</span>
                        {info.sessionName && (
                          <Badge variant="secondary" className="text-xs">
                            {info.sessionName}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(info.lastActive)}</span>
                        <span className="text-gray-400">•</span>
                        <code className="text-gray-400">
                          {info.sessionId.slice(0, 8)}...
                        </code>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onFreshStart} className="w-full sm:w-auto">
            <X className="w-4 h-4 mr-2" />
            Start Fresh
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            {selectedCount !== totalCount && selectedCount > 0 && (
              <Button
                variant="outline"
                onClick={handleResumeSelected}
                className="flex-1 sm:flex-none"
              >
                Resume {selectedCount}
              </Button>
            )}
            <Button
              onClick={handleResumeAll}
              className="flex-1 sm:flex-none"
              disabled={totalCount === 0}
            >
              <Play className="w-4 h-4 mr-2" />
              Resume All ({totalCount})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ResumeSessionDialog;
