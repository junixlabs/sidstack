/**
 * ServiceHealthBanner - Shows critical service connection errors
 * Displays a prominent banner when required services are down
 */

import { AlertTriangle, RefreshCw, X, Server, Wifi } from "lucide-react";
import { useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { useVisibilityPolling } from "@/hooks/useVisibility";
import { ipcClient } from "@/lib/ipcClient";
import { cn } from "@/lib/utils";

interface ServiceStatus {
  name: string;
  url: string;
  type: "http" | "ws";
  healthy: boolean;
  description: string;
  icon: typeof Server;
}

const SERVICES: Omit<ServiceStatus, "healthy">[] = [
  {
    name: "API Server",
    url: "http://localhost:19432/health",
    type: "http",
    description: "Task management, orchestrator APIs",
    icon: Server,
  },
  {
    name: "IPC Server",
    url: "ws://localhost:17432",
    type: "ws",
    description: "Terminal spawning, agent coordination",
    icon: Wifi,
  },
];

async function checkHttpHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Use the shared ipcClient connection state instead of creating new WebSocket
function checkWsHealth(_url: string): boolean {
  // ipcClient maintains a persistent connection, just check its state
  return ipcClient.connected;
}

interface ServiceHealthBannerProps {
  className?: string;
}

export function ServiceHealthBanner({ className }: ServiceHealthBannerProps) {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkAllServices = useCallback(async () => {
    setChecking(true);

    const results: ServiceStatus[] = await Promise.all(
      SERVICES.map(async (service) => {
        const healthy = service.type === "http"
          ? await checkHttpHealth(service.url)
          : checkWsHealth(service.url); // Sync function, no await needed

        return { ...service, healthy };
      })
    );

    setServices(results);
    setLastCheck(new Date());
    setChecking(false);

    // If all services are healthy now, undismiss
    if (results.every((s) => s.healthy)) {
      setDismissed(false);
    }
  }, []);

  // Performance: Use visibility-based polling - pauses when tab is hidden
  const { pollNow } = useVisibilityPolling(checkAllServices, 30000, { immediate: true });

  const unhealthyServices = services.filter((s) => !s.healthy);
  const hasErrors = unhealthyServices.length > 0;

  // Don't show if dismissed or no errors
  if (dismissed || !hasErrors) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex-none border-b",
        "bg-[var(--surface-2)] border-[var(--border-default)] text-[var(--text-primary)]",
        className
      )}
    >
      <div className="px-4 py-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="font-medium text-[13px]">
              Service Connection Error
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              ({unhealthyServices.length} service{unhealthyServices.length > 1 ? "s" : ""} down)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={pollNow}
              disabled={checking}
              className="h-6 px-2 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
            >
              <RefreshCw className={cn("w-3 h-3 mr-1", checking && "animate-spin animation-infinite")} />
              Retry
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDismissed(true)}
              className="h-6 w-6 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Service details */}
        <div className="mt-2 space-y-1.5">
          {unhealthyServices.map((service) => (
            <div
              key={service.name}
              className="flex items-center gap-3 text-[12px] bg-[var(--surface-1)] rounded px-2 py-1.5"
            >
              <service.icon className="w-3.5 h-3.5 text-[var(--text-secondary)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{service.name}</span>
                <span className="text-[var(--text-muted)] ml-2">— {service.description}</span>
              </div>
              <code className="text-[11px] text-[var(--text-secondary)] font-mono">
                {service.url.replace("http://", "").replace("ws://", "")}
              </code>
            </div>
          ))}
        </div>

        {/* Fix instructions */}
        <div className="mt-2 text-[11px] text-[var(--text-muted)] bg-[var(--surface-1)] rounded px-2 py-1.5">
          <strong>To fix:</strong>
          <ul className="mt-1 space-y-0.5 list-disc list-inside">
            {unhealthyServices.some((s) => s.name === "IPC Server") && (
              <li>Make sure Agent Manager app is running</li>
            )}
            {unhealthyServices.some((s) => s.name === "API Server") && (
              <li>
                Run: <code className="bg-[var(--surface-0)] px-1 rounded">pnpm --filter @sidstack/api-server start</code>
              </li>
            )}
          </ul>
        </div>

        {/* Last check time */}
        {lastCheck && (
          <div className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            Last checked: {lastCheck.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

export default ServiceHealthBanner;
