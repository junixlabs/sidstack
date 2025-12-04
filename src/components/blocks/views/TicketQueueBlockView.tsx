import {
  RotateCw,
  Inbox,
  Eye,
  CheckCircle,
  Play,
  XCircle,
  Clock,
  Tag,
  ExternalLink,
  MessageSquare,
  Bug,
  Lightbulb,
  Zap,
  ListTodo,
  Layers,
  AlertTriangle,
  Plus,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { memo, useEffect, useCallback, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useBlockNavigation } from "@/hooks/useBlockNavigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useProjectSettingsStore } from "@/stores/projectSettingsStore";
import {
  useTicketStore,
  useFilteredTickets,
  useSelectedTicket,
  useTicketStats,
  type Ticket,
  type TicketStatus,
  type TicketStatusFilter,
} from "@/stores/ticketStore";
import { useTunnelStore } from "@/stores/tunnelStore";
import type { BlockViewProps } from "@/types/block";

import { registerBlockView } from "../BlockRegistry";

/**
 * Strip markdown formatting and clean description for preview
 */
function cleanDescription(text: string | undefined, maxLength = 120): string {
  if (!text) return "";

  // Remove markdown formatting
  let clean = text
    .replace(/#{1,6}\s*/g, "") // Headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
    .replace(/\*([^*]+)\*/g, "$1") // Italic
    .replace(/__([^_]+)__/g, "$1") // Bold alt
    .replace(/_([^_]+)_/g, "$1") // Italic alt
    .replace(/`([^`]+)`/g, "$1") // Inline code
    .replace(/```[\s\S]*?```/g, "") // Code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
    .replace(/^[-*+]\s+/gm, "") // List items
    .replace(/^\d+\.\s+/gm, "") // Numbered lists
    .replace(/\n+/g, " ") // Newlines to spaces
    .replace(/\s+/g, " ") // Multiple spaces
    .trim();

  // Truncate
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength).trim() + "...";
  }

  return clean;
}

/**
 * Ticket Queue Block View
 *
 * Displays incoming tickets for review and processing.
 * Supports starting Claude sessions and converting to tasks.
 */
export const TicketQueueBlockView = memo(function TicketQueueBlockView(
  _props: BlockViewProps
) {
  const { projectPath } = useAppStore();
  const projectId = projectPath?.split("/").pop() || "default";

  const {
    isLoading,
    error,
    filters,
    fetchTickets,
    selectTicket,
    setStatusFilter,
    setSearchQuery,
    startSession,
    convertToTask,
    updateTicketStatus,
    clearError,
  } = useTicketStore();

  const tickets = useFilteredTickets();
  const selectedTicket = useSelectedTicket();
  const stats = useTicketStats();

  // Navigation helpers for cross-feature links
  const { navigateToTaskManager } = useBlockNavigation();

  // Tunnel and settings for integration guide
  const { info: tunnelInfo } = useTunnelStore();
  const { settings } = useProjectSettingsStore();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showIntegrationGuide, setShowIntegrationGuide] = useState(false);
  const [copiedExample, setCopiedExample] = useState<string | null>(null);

  // Copy example to clipboard
  const handleCopyExample = useCallback(async (example: string, label: string) => {
    try {
      await navigator.clipboard.writeText(example);
      setCopiedExample(label);
      setTimeout(() => setCopiedExample(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  // Fetch tickets on mount
  useEffect(() => {
    fetchTickets(projectId);
  }, [projectId, fetchTickets]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    fetchTickets(projectId);
  }, [projectId, fetchTickets]);

  // Auto-refresh
  const { isActive: autoRefreshActive } = useAutoRefresh({
    onRefresh: handleRefresh,
  });

  // Start session handler
  const handleStartSession = useCallback(
    async (ticket: Ticket) => {
      if (!projectPath) return;

      setActionLoading(ticket.id);
      const result = await startSession(ticket.id, projectPath);
      setActionLoading(null);

      if (result.error) {
        toast.error(`Failed to start session: ${result.error}`);
        return;
      }

      toast.success("Claude session launched", {
        description: `Analyzing: ${ticket.title}`,
      });
    },
    [projectPath, startSession]
  );

  // Convert to task handler
  const handleConvertToTask = useCallback(
    async (ticket: Ticket) => {
      setActionLoading(ticket.id);
      const result = await convertToTask(ticket.id);
      setActionLoading(null);

      if (result.error) {
        toast.error(`Failed to convert: ${result.error}`);
        return;
      }

      if (result.taskId) {
        toast.success(`Task created: ${result.taskId.slice(0, 12)}...`, {
          description: ticket.title,
          action: {
            label: "View Task",
            onClick: () => navigateToTaskManager({ selectedTaskId: result.taskId }),
          },
        });
      }
    },
    [convertToTask, navigateToTaskManager]
  );

  // Status update handler
  const handleStatusChange = useCallback(
    async (ticket: Ticket, status: TicketStatus) => {
      await updateTicketStatus(ticket.id, status);
    },
    [updateTicketStatus]
  );

  // Status filter tabs
  const statusTabs: { value: TicketStatusFilter; label: string; icon: React.ReactNode }[] = [
    { value: "all", label: "All", icon: <Inbox className="w-3.5 h-3.5" /> },
    { value: "new", label: "New", icon: <Clock className="w-3.5 h-3.5" /> },
    { value: "reviewing", label: "Reviewing", icon: <Eye className="w-3.5 h-3.5" /> },
    { value: "approved", label: "Approved", icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { value: "in_progress", label: "In Progress", icon: <Play className="w-3.5 h-3.5" /> },
    { value: "completed", label: "Completed", icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { value: "rejected", label: "Rejected", icon: <XCircle className="w-3.5 h-3.5" /> },
  ];

  // Type icons - muted colors per Design Guidelines
  const typeIcons: Record<string, React.ReactNode> = {
    bug: <Bug className="w-4 h-4 text-[var(--color-error)]" />,
    feature: <Lightbulb className="w-4 h-4 text-[var(--color-warning)]" />,
    improvement: <Zap className="w-4 h-4 text-[var(--accent-primary)]" />,
    task: <ListTodo className="w-4 h-4 text-[var(--text-muted)]" />,
    epic: <Layers className="w-4 h-4 text-[var(--text-secondary)]" />,
  };

  // Priority colors - muted per Design Guidelines
  const priorityColors: Record<string, string> = {
    low: "bg-[var(--surface-2)] text-[var(--text-muted)]",
    medium: "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]",
    high: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    critical: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
  };

  // Status colors - muted per Design Guidelines
  const statusColors: Record<string, string> = {
    new: "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]",
    reviewing: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    approved: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
    in_progress: "bg-[var(--text-secondary)]/15 text-[var(--text-secondary)]",
    completed: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
    rejected: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border p-3 space-y-3 overflow-hidden">
        {/* Title and actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-sm font-medium">Ticket Queue</h2>
            <Badge variant="secondary" className="text-xs">
              {stats.total} tickets
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {autoRefreshActive && (
              <span className="text-[10px] text-[var(--text-muted)]">Auto</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              title={autoRefreshActive ? "Auto-refresh enabled" : "Refresh"}
            >
              <RotateCw className={cn("w-4 h-4", (isLoading || autoRefreshActive) && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span className="text-[var(--accent-primary)]">{stats.new} new</span>
          <span className="text-[var(--color-warning)]">{stats.reviewing} reviewing</span>
          <span className="text-[var(--color-success)]">{stats.approved} approved</span>
          <span className="text-[var(--text-secondary)]">{stats.inProgress} in progress</span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search tickets..."
            value={filters.searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-8 text-xs"
          />
        </div>

        {/* Status tabs */}
        <div role="tablist" aria-label="Ticket status filter" className="flex items-center gap-1 overflow-x-auto">
          {statusTabs.map((tab) => (
            <Button
              key={tab.value}
              role="tab"
              aria-selected={filters.status === tab.value}
              variant={filters.status === tab.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1.5 flex-shrink-0"
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.icon}
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-500/10 border-b border-red-500/20">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4" />
            {error}
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Ticket list */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {isLoading && tickets.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <EmptyState
                icon={<Inbox className="w-full h-full" />}
                title="No tickets in queue"
                description="Connect your issue tracker (Jira, GitHub, Linear) to automatically import tickets, or create them manually."
                actions={[
                  {
                    label: "Create via API",
                    onClick: () => {
                      setShowIntegrationGuide(true);
                    },
                    icon: <Plus className="w-4 h-4" />,
                  },
                ]}
                tips={[]}
              />

              {/* Integration Guide Toggle */}
              <div className="mt-4 w-full max-w-lg">
                <button
                  onClick={() => setShowIntegrationGuide(!showIntegrationGuide)}
                  aria-expanded={showIntegrationGuide}
                  className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] mx-auto"
                >
                  {showIntegrationGuide ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  Integration Guide
                </button>

                {showIntegrationGuide && (
                  <div className="mt-3 bg-[var(--surface-1)] border border-[var(--border-muted)] rounded-lg overflow-hidden text-left">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-[var(--border-muted)] bg-[var(--surface-2)]/50">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-[var(--text-primary)]">
                          Connect Your Issue Tracker
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-secondary)]">
                            {settings.ticket?.source === 'sidstack-cloud' ? 'SidStack Cloud' : 'Self-hosted'}
                          </span>
                          {tunnelInfo.status === 'running' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-500">
                              Tunnel Active
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4">
                      {/* Self-hosted Section */}
                      {settings.ticket?.source === 'self-hosted' && (
                        <>
                          {/* Webhook URL */}
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-[var(--text-secondary)]">
                              Webhook URL
                            </label>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-[var(--surface-2)] px-3 py-2 rounded font-mono truncate border border-[var(--border-muted)]">
                                {tunnelInfo.status === 'running' && tunnelInfo.publicUrl
                                  ? `${tunnelInfo.publicUrl}/api/tickets`
                                  : 'http://localhost:19432/api/tickets'}
                              </code>
                              <button
                                onClick={() => handleCopyExample(
                                  tunnelInfo.status === 'running' && tunnelInfo.publicUrl
                                    ? `${tunnelInfo.publicUrl}/api/tickets`
                                    : 'http://localhost:19432/api/tickets',
                                  "url"
                                )}
                                className="p-2 rounded bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border-muted)] transition-colors"
                                title="Copy URL"
                              >
                                {copiedExample === "url" ? (
                                  <Check className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {tunnelInfo.status !== 'running' && (
                              <p className="text-[10px] text-[var(--text-muted)]">
                                Enable tunnel in Settings → Ticket Source for public URL
                              </p>
                            )}
                          </div>

                          {/* Example Payload */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-[var(--text-secondary)]">
                                Example Request
                              </label>
                              <button
                                onClick={() => handleCopyExample(`curl -X POST ${tunnelInfo.status === 'running' && tunnelInfo.publicUrl ? tunnelInfo.publicUrl : 'http://localhost:19432'}/api/tickets \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "${projectId}",
    "title": "Fix login bug",
    "type": "bug",
    "priority": "high",
    "source": "jira",
    "externalId": "PROJ-123"
  }'`, "curl")}
                                className="flex items-center gap-1.5 px-2 py-1 text-[10px] rounded bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border-muted)] transition-colors"
                              >
                                {copiedExample === "curl" ? (
                                  <>
                                    <Check className="w-3 h-3 text-green-500" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    Copy curl
                                  </>
                                )}
                              </button>
                            </div>
                            <pre className="text-[10px] bg-[var(--surface-2)] p-3 rounded font-mono overflow-x-auto border border-[var(--border-muted)]">
{`{
  "projectId": "${projectId}",
  "title": "Fix login bug",
  "type": "bug",        // bug | feature | improvement | task
  "priority": "high",   // low | medium | high | critical
  "source": "jira",     // jira | github | linear | api | manual
  "externalId": "PROJ-123"  // Optional: link to original
}`}
                            </pre>
                          </div>
                        </>
                      )}

                      {/* SidStack Cloud Section */}
                      {settings.ticket?.source === 'sidstack-cloud' && (
                        <div className="p-4 rounded-lg bg-[var(--surface-2)] border border-[var(--border-muted)] text-center space-y-2">
                          <p className="text-xs text-[var(--text-muted)]">
                            Connect to SidStack Cloud in Settings to get your webhook URL.
                          </p>
                          {settings.ticket?.cloud?.connected ? (
                            <code className="inline-block text-xs bg-[var(--surface-3)] px-3 py-1.5 rounded font-mono border border-[var(--border-muted)]">
                              {settings.ticket.cloud.webhookUrl}
                            </code>
                          ) : (
                            <span className="text-xs text-[var(--color-warning)]">
                              Not connected - Go to Settings → Ticket Source
                            </span>
                          )}
                        </div>
                      )}

                      {/* Platform-specific tips */}
                      <div className="pt-4 border-t border-[var(--border-muted)]">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">
                          Configure webhooks in:
                        </label>
                        <div className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                          <p><span className="text-[var(--text-secondary)]">Jira:</span> Project Settings → Automation → Webhook action</p>
                          <p><span className="text-[var(--text-secondary)]">GitHub:</span> Repository Settings → Webhooks → Add webhook</p>
                          <p><span className="text-[var(--text-secondary)]">Linear:</span> Settings → API → Webhooks</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={cn(
                    "p-3 cursor-pointer hover:bg-[var(--surface-1)] transition-colors",
                    selectedTicket?.id === ticket.id && "bg-[var(--surface-2)] border-l-2 border-l-[var(--accent-primary)]"
                  )}
                  onClick={() => selectTicket(ticket.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Type icon */}
                    <div className="flex-shrink-0 mt-1">
                      {typeIcons[ticket.type] || typeIcons.task}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title row with status/priority badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-[10px] px-1.5 py-0", statusColors[ticket.status])}>
                          {ticket.status.replace("_", " ")}
                        </Badge>
                        <Badge className={cn("text-[10px] px-1.5 py-0", priorityColors[ticket.priority])}>
                          {ticket.priority}
                        </Badge>
                        {ticket.externalId && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            #{ticket.externalId}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-medium mt-1 line-clamp-1">
                        {ticket.title}
                      </h4>

                      {/* Description - cleaned */}
                      {ticket.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {cleanDescription(ticket.description, 100)}
                        </p>
                      )}

                      {/* Labels row */}
                      {ticket.labels.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {ticket.labels.slice(0, 3).map((label) => (
                            <span key={label} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {label}
                            </span>
                          ))}
                          {ticket.labels.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{ticket.labels.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      {ticket.status === "new" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(ticket, "reviewing");
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {(ticket.status === "reviewing" || ticket.status === "approved") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={actionLoading === ticket.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartSession(ticket);
                          }}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {ticket.status === "approved" && !ticket.taskId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={actionLoading === ticket.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConvertToTask(ticket);
                          }}
                        >
                          <ListTodo className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedTicket && (
          <div className="w-80 flex-shrink-0 border-l border-border overflow-y-auto">
            <TicketDetailPanel
              ticket={selectedTicket}
              onStartSession={() => handleStartSession(selectedTicket)}
              onConvertToTask={() => handleConvertToTask(selectedTicket)}
              onStatusChange={(status) => handleStatusChange(selectedTicket, status)}
              isLoading={actionLoading === selectedTicket.id}
            />
          </div>
        )}
      </div>
    </div>
  );
});

// Detail panel component
interface TicketDetailPanelProps {
  ticket: Ticket;
  onStartSession: () => void;
  onConvertToTask: () => void;
  onStatusChange: (status: TicketStatus) => void;
  isLoading: boolean;
}

const TicketDetailPanel = memo(function TicketDetailPanel({
  ticket,
  onStartSession,
  onConvertToTask,
  onStatusChange,
  isLoading,
}: TicketDetailPanelProps) {
  // Type icons - muted colors per Design Guidelines
  const typeIcons: Record<string, React.ReactNode> = {
    bug: <Bug className="w-5 h-5 text-[var(--color-error)]" />,
    feature: <Lightbulb className="w-5 h-5 text-[var(--color-warning)]" />,
    improvement: <Zap className="w-5 h-5 text-[var(--accent-primary)]" />,
    task: <ListTodo className="w-5 h-5 text-[var(--text-muted)]" />,
    epic: <Layers className="w-5 h-5 text-[var(--text-secondary)]" />,
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        {typeIcons[ticket.type]}
        <div className="flex-1">
          <h3 className="text-sm font-medium">{ticket.title}</h3>
          {ticket.externalId && (
            <p className="text-xs text-muted-foreground mt-0.5">
              #{ticket.externalId} from {ticket.source}
            </p>
          )}
        </div>
      </div>

      {/* Status select */}
      <div>
        <label className="text-xs text-muted-foreground">Status</label>
        <Select value={ticket.status} onValueChange={(v) => onStatusChange(v as TicketStatus)}>
          <SelectTrigger className="h-8 text-xs mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs text-muted-foreground">Description</label>
        <p className="text-sm mt-1 whitespace-pre-wrap">
          {ticket.description || "No description"}
        </p>
      </div>

      {/* Labels */}
      {ticket.labels.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground">Labels</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {ticket.labels.map((label) => (
              <Badge key={label} variant="outline" className="text-xs">
                <Tag className="w-3 h-3 mr-1" />
                {label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* External URLs */}
      {ticket.externalUrls.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground">Links</label>
          <div className="space-y-1 mt-1">
            {ticket.externalUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                {url}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Linked issues */}
      {ticket.linkedIssues.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground">Linked Issues</label>
          <div className="space-y-1 mt-1">
            {ticket.linkedIssues.map((issue) => (
              <div key={issue.id} className="text-xs">
                <span className="text-muted-foreground">{issue.type}:</span>{" "}
                {issue.id}
                {issue.title && ` - ${issue.title}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task link */}
      {ticket.taskId && (
        <div>
          <label className="text-xs text-muted-foreground">Linked Task</label>
          <div className="text-xs mt-1 text-[var(--color-success)]">
            <CheckCircle className="w-3 h-3 inline mr-1" />
            {ticket.taskId}
          </div>
        </div>
      )}

      {/* Session link */}
      {ticket.sessionId && (
        <div>
          <label className="text-xs text-muted-foreground">Claude Session</label>
          <div className="text-xs mt-1 text-[var(--text-secondary)]">
            <MessageSquare className="w-3 h-3 inline mr-1" />
            {ticket.sessionId}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 border-t border-border space-y-2">
        {(ticket.status === "reviewing" || ticket.status === "approved") && (
          <Button
            className="w-full"
            size="sm"
            disabled={isLoading}
            onClick={onStartSession}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Start Claude Session
          </Button>
        )}
        {ticket.status === "approved" && !ticket.taskId && (
          <Button
            className="w-full"
            variant="secondary"
            size="sm"
            disabled={isLoading}
            onClick={onConvertToTask}
          >
            <ListTodo className="w-4 h-4 mr-2" />
            Convert to Task
          </Button>
        )}
      </div>

      {/* Metadata */}
      <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
        <div>
          Created: {new Date(ticket.createdAt).toLocaleString()}
        </div>
        <div>
          Updated: {new Date(ticket.updatedAt).toLocaleString()}
        </div>
        {ticket.reporter && <div>Reporter: {ticket.reporter}</div>}
        {ticket.assignee && <div>Assignee: {ticket.assignee}</div>}
      </div>
    </div>
  );
});

// Register the block view
registerBlockView("ticket-queue", TicketQueueBlockView);
