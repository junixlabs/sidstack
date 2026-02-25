/**
 * RelatedIncidentsSection Component
 *
 * Displays incidents linked to a task via context.taskId.
 * Collapsible section following LinkedKnowledgeSection pattern.
 */

import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import { getApiBaseUrl, apiFetch } from "@/lib/api-config";

const API_BASE = getApiBaseUrl();

interface Incident {
  id: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  createdAt: number;
}

interface RelatedIncidentsSectionProps {
  taskId: string;
}

export function RelatedIncidentsSection({ taskId }: RelatedIncidentsSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    setLoading(true);

    apiFetch(`${API_BASE}/api/training/incidents?taskId=${encodeURIComponent(taskId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.incidents) {
          setIncidents(data.incidents);
        }
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [taskId]);

  if (!loading && incidents.length === 0) return null;

  const severityColor: Record<string, string> = {
    critical: "text-red-400",
    high: "text-orange-400",
    medium: "text-amber-400",
    low: "text-[var(--text-muted)]",
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
        )}
        <AlertTriangle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-xs text-[var(--text-muted)]">
          Related Incidents {incidents.length > 0 && `(${incidents.length})`}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 ml-5 space-y-1">
          {loading ? (
            <div className="text-xs text-[var(--text-muted)] italic">Loading...</div>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
                    incident.status === "open" ? "bg-amber-400" : "bg-green-400"
                  )}
                />
                <span className="flex-1 text-xs text-[var(--text-secondary)] truncate">
                  {incident.title}
                </span>
                <span
                  className={cn(
                    "text-[10px] flex-shrink-0",
                    severityColor[incident.severity] || "text-[var(--text-muted)]"
                  )}
                >
                  {incident.severity}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
