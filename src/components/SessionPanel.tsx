/**
 * SessionPanel - Collapsible panel showing saved sessions
 *
 * Features:
 * - List sessions grouped by project
 * - Show active vs saved sessions
 * - Quick resume on double-click
 * - Context menu for actions (rename, delete, export)
 */

import {
  ChevronDown,
  ChevronRight,
  Play,
  Trash2,
  Edit2,
  Download,
  Clock,
  FolderOpen,
  Search,
  RefreshCw,
  MoreVertical,
} from "lucide-react";
import { useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useSessionStorage, SessionMeta } from "@/hooks/useSessionStorage";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface SessionPanelProps {
  currentProject: string;
  onSessionResume: (session: SessionMeta) => void;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle future dates or invalid dates
  if (diffMs < 0 || isNaN(diffMs)) return "unknown";

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateShort(date);
}

function formatDateShort(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Invalid date";
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getProjectName(projectPath: string): string {
  return projectPath.split("/").pop() || projectPath;
}

// ============================================================================
// SessionItem Component
// ============================================================================

interface SessionItemProps {
  session: SessionMeta;
  isCurrentProject: boolean;
  onResume: () => void;
  onRename: () => void;
  onDelete: () => void;
  onExport: () => void;
}

function SessionItem({
  session,
  isCurrentProject,
  onResume,
  onRename,
  onDelete,
  onExport,
}: SessionItemProps) {
  const displayName =
    session.displayName || session.role || `Session ${session.sessionId.slice(0, 8)}`;
  const isActive = session.status === "active";
  const shortSessionId = session.claudeSessionId
    ? session.claudeSessionId.slice(0, 8)
    : session.sessionId.slice(0, 8);

  return (
    <div
      className={cn(
        "group flex items-start gap-2 px-2 py-2 rounded-md cursor-pointer",
        "hover:bg-accent/50 transition-colors border border-transparent",
        isCurrentProject && "bg-accent/30",
        isActive && "border-[var(--border-default)] bg-[var(--surface-2)]"
      )}
      onDoubleClick={onResume}
      title={`Session ID: ${session.claudeSessionId || session.sessionId}\nCreated: ${formatDateTime(session.createdAt)}`}
    >
      {/* Status indicator */}
      <div
        className={cn(
          "w-2 h-2 rounded-full flex-shrink-0 mt-1.5",
          isActive ? "bg-[var(--text-secondary)] animate-pulse" : "bg-[var(--text-muted)]"
        )}
        title={isActive ? "Active" : "Saved"}
      />

      {/* Session info */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Name + Role badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {session.role && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)] font-medium flex-shrink-0">
              {session.role}
            </span>
          )}
          {isActive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)] font-medium flex-shrink-0">
              active
            </span>
          )}
        </div>

        {/* Row 2: Time info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <Clock className="h-3 w-3 flex-shrink-0" />
          <span>{formatTimeAgo(session.lastActiveAt)}</span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-muted-foreground/60">
            {formatBytes(session.logSizeBytes)}
          </span>
        </div>

        {/* Row 3: Session ID */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50 mt-0.5 font-mono">
          <span>ID: {shortSessionId}...</span>
        </div>
      </div>

      {/* Quick resume button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onResume();
        }}
        title="Resume session"
      >
        <Play className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
      </Button>

      {/* Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onResume}>
            <Play className="h-4 w-4 mr-2" />
            Resume
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>
            <Edit2 className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================================================
// ProjectGroup Component
// ============================================================================

interface ProjectGroupProps {
  projectPath: string;
  sessions: SessionMeta[];
  isCurrentProject: boolean;
  defaultExpanded?: boolean;
  onSessionResume: (session: SessionMeta) => void;
  onSessionRename: (session: SessionMeta) => void;
  onSessionDelete: (session: SessionMeta) => void;
  onSessionExport: (session: SessionMeta) => void;
}

function ProjectGroup({
  projectPath,
  sessions,
  isCurrentProject,
  defaultExpanded = false,
  onSessionResume,
  onSessionRename,
  onSessionDelete,
  onSessionExport,
}: ProjectGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || isCurrentProject);
  const projectName = getProjectName(projectPath);
  const activeCount = sessions.filter((s) => s.status === "active").length;

  // Sort sessions: active first, then by lastActiveAt (most recent first)
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      // Active sessions first
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;
      // Then by lastActiveAt (most recent first)
      return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
    });
  }, [sessions]);

  return (
    <div className="mb-2">
      {/* Project header */}
      <button
        className={cn(
          "flex items-center gap-2 w-full px-2 py-1 rounded-md",
          "hover:bg-accent/50 transition-colors text-left",
          isCurrentProject && "font-medium"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}
        <FolderOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm">{projectName}</span>
        {activeCount > 0 && (
          <span className="text-xs bg-[var(--surface-2)] text-[var(--text-secondary)] px-1.5 rounded">
            {activeCount} active
          </span>
        )}
        <span className="text-xs text-muted-foreground">{sessions.length}</span>
      </button>

      {/* Sessions list */}
      {expanded && (
        <div className="ml-4 mt-1 space-y-0.5">
          {sortedSessions.map((session) => (
            <SessionItem
              key={session.sessionId}
              session={session}
              isCurrentProject={isCurrentProject}
              onResume={() => onSessionResume(session)}
              onRename={() => onSessionRename(session)}
              onDelete={() => onSessionDelete(session)}
              onExport={() => onSessionExport(session)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SessionPanel Component
// ============================================================================

export function SessionPanel({
  currentProject,
  onSessionResume,
  className,
}: SessionPanelProps) {
  const {
    sessionsByProject,
    loading,
    refresh,
    renameSession,
    deleteSession,
    exportSession,
  } = useSessionStorage();

  const [searchQuery, setSearchQuery] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState<SessionMeta | null>(null);
  const [sessionToRename, setSessionToRename] = useState<SessionMeta | null>(null);
  const [newName, setNewName] = useState("");

  // Filter sessions by search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return sessionsByProject;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, SessionMeta[]> = {};

    for (const [project, sessions] of Object.entries(sessionsByProject)) {
      const matchingSessions = sessions.filter(
        (s) =>
          s.displayName?.toLowerCase().includes(query) ||
          s.role?.toLowerCase().includes(query) ||
          s.sessionId.toLowerCase().includes(query) ||
          project.toLowerCase().includes(query)
      );
      if (matchingSessions.length > 0) {
        filtered[project] = matchingSessions;
      }
    }

    return filtered;
  }, [sessionsByProject, searchQuery]);

  // Sort projects: current project first
  const sortedProjects = useMemo(() => {
    return Object.entries(filteredProjects).sort(([a], [b]) => {
      if (a === currentProject) return -1;
      if (b === currentProject) return 1;
      return a.localeCompare(b);
    });
  }, [filteredProjects, currentProject]);

  // Handle rename
  const handleRename = async () => {
    if (!sessionToRename || !newName.trim()) return;
    await renameSession(sessionToRename.sessionId, newName.trim());
    setSessionToRename(null);
    setNewName("");
  };

  // Handle delete
  const handleDelete = async () => {
    if (!sessionToDelete) return;
    await deleteSession(sessionToDelete.sessionId, true);
    setSessionToDelete(null);
  };

  // Handle export
  const handleExport = async (session: SessionMeta) => {
    const markdown = await exportSession(session.sessionId);
    if (markdown) {
      // Create download
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${session.displayName || session.sessionId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const totalSessions = Object.values(sessionsByProject).flat().length;

  return (
    <div className={cn("flex flex-col h-full max-h-full overflow-hidden", className)}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">Sessions</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{totalSessions}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Session list - use native scroll for reliability */}
      <div className="flex-1 h-0 overflow-y-auto overflow-x-hidden px-2">
        {sortedProjects.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            {searchQuery ? "No matching sessions" : "No saved sessions"}
          </div>
        ) : (
          sortedProjects.map(([project, sessions]) => (
            <ProjectGroup
              key={project}
              projectPath={project}
              sessions={sessions}
              isCurrentProject={project === currentProject}
              defaultExpanded={project === currentProject}
              onSessionResume={onSessionResume}
              onSessionRename={(s) => {
                setSessionToRename(s);
                setNewName(s.displayName || s.role || "");
              }}
              onSessionDelete={(s) => setSessionToDelete(s)}
              onSessionExport={handleExport}
            />
          ))
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog
        open={!!sessionToRename}
        onOpenChange={() => setSessionToRename(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Session</DialogTitle>
            <DialogDescription>
              Enter a new name for this session.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Session name"
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSessionToRename(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!sessionToDelete}
        onOpenChange={() => setSessionToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this session? This will also delete
              the log files. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSessionToDelete(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              variant="destructive"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
