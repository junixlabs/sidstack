/**
 * RecoveryNotification Component
 *
 * Toast notification displayed when an agent recovery event occurs.
 * Shows agent name, reason, and links to recovery details.
 */

import { RefreshCw, X, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTeamStore, RecoveryEvent } from "@/stores/teamStore";

interface NotificationItem {
  id: string;
  event: RecoveryEvent;
  visible: boolean;
  dismissed: boolean;
}

interface RecoveryNotificationProps {
  className?: string;
  autoHideMs?: number;
  maxVisible?: number;
  onViewDetails?: (event: RecoveryEvent) => void;
}

export function RecoveryNotification({
  className,
  autoHideMs = 10000,
  maxVisible = 3,
  onViewDetails,
}: RecoveryNotificationProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const subscribeToEvents = useTeamStore((state) => state.subscribeToEvents);
  const recoveryHistory = useTeamStore((state) => state.recoveryHistory);

  // Subscribe to recovery events
  useEffect(() => {
    let unlistenFns: (() => void)[] = [];

    const setup = async () => {
      unlistenFns = await subscribeToEvents();
    };

    setup();

    return () => {
      unlistenFns.forEach((fn) => fn());
    };
  }, [subscribeToEvents]);

  // Watch for new recovery events
  useEffect(() => {
    if (recoveryHistory.length === 0) return;

    const latestEvent = recoveryHistory[0];

    // Check if we already have this notification
    if (notifications.some((n) => n.id === latestEvent.id)) {
      return;
    }

    // Add new notification
    setNotifications((prev) => [
      {
        id: latestEvent.id,
        event: latestEvent,
        visible: true,
        dismissed: false,
      },
      ...prev.slice(0, maxVisible - 1),
    ]);
  }, [recoveryHistory, notifications, maxVisible]);

  // Auto-hide notifications
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    notifications
      .filter((n) => n.visible && !n.dismissed)
      .forEach((n) => {
        const timer = setTimeout(() => {
          setNotifications((prev) =>
            prev.map((item) =>
              item.id === n.id ? { ...item, visible: false } : item
            )
          );
        }, autoHideMs);
        timers.push(timer);
      });

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [notifications, autoHideMs]);

  const handleDismiss = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, dismissed: true, visible: false } : n
      )
    );
  }, []);

  const handleDismissAll = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, dismissed: true, visible: false }))
    );
  }, []);

  const visibleNotifications = notifications.filter((n) => n.visible && !n.dismissed);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm",
        className
      )}
    >
      {visibleNotifications.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="self-end text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          onClick={handleDismissAll}
        >
          Dismiss all
        </Button>
      )}

      {visibleNotifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          event={notification.event}
          onDismiss={() => handleDismiss(notification.id)}
          onViewDetails={() => onViewDetails?.(notification.event)}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Notification Card
// =============================================================================

interface NotificationCardProps {
  event: RecoveryEvent;
  onDismiss: () => void;
  onViewDetails?: () => void;
}

function NotificationCard({ event, onDismiss, onViewDetails }: NotificationCardProps) {
  const isSuccess = event.success;

  return (
    <div
      className={cn(
        "p-4 rounded-lg shadow-lg border backdrop-blur-sm animate-in slide-in-from-right-5",
        "bg-[var(--surface-1)]/95 border-[var(--border-default)]",
        isSuccess && "border-l-4 border-l-green-500",
        !isSuccess && "border-l-4 border-l-red-500"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          <span className="font-medium text-[var(--text-primary)]">
            {isSuccess ? "Agent Recovered" : "Recovery Failed"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6 -mr-1 -mt-1"
          onClick={onDismiss}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-[var(--text-secondary)]">
            <strong>@{event.failedMemberRole}</strong> was replaced
          </span>
        </div>

        <p className="text-[var(--text-muted)] text-xs">
          Reason: {event.reason}
        </p>

        {event.recoveryContext && (
          <div className="text-xs text-[var(--text-muted)]">
            Progress: {event.recoveryContext.progress}%
            {event.recoveryContext.artifacts.length > 0 && (
              <span> • {event.recoveryContext.artifacts.length} artifacts</span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {onViewDetails && (
        <div className="mt-3 pt-2 border-t border-[var(--border-default)]">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs w-full justify-center"
            onClick={onViewDetails}
          >
            View Details
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default RecoveryNotification;
