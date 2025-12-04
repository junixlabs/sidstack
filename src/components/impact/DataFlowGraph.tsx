/**
 * Data Flow Graph
 *
 * Visual representation of data flows using Mermaid diagrams.
 * Shows entities, modules, and their relationships with flow strength colors.
 */

import { GitBranch, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { memo, useMemo } from "react";

import MermaidDiagram from "@/components/MermaidDiagram";
import { cn } from "@/lib/utils";
import type { ImpactDataFlow } from "@sidstack/shared";

// =============================================================================
// Types
// =============================================================================

interface DataFlowGraphProps {
  dataFlows: ImpactDataFlow[];
  className?: string;
  title?: string;
  showLegend?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getStrengthStyle(strength: ImpactDataFlow["strength"]): string {
  switch (strength) {
    case "critical":
      return "stroke:#ef4444,stroke-width:3px";
    case "important":
      return "stroke:#f59e0b,stroke-width:2px";
    case "optional":
      return "stroke:#6b7280,stroke-width:1px";
  }
}

function getFlowArrow(flowType: ImpactDataFlow["flowType"]): string {
  switch (flowType) {
    case "read":
      return "-->";
    case "write":
      return "==>";
    case "bidirectional":
      return "<-->";
  }
}

function sanitizeId(id: string): string {
  // Replace special characters with underscores for Mermaid compatibility
  return id.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
}

function generateMermaidDiagram(dataFlows: ImpactDataFlow[]): string {
  if (dataFlows.length === 0) {
    return `graph LR
    empty[No data flows]`;
  }

  const lines: string[] = ["graph LR"];
  const nodes = new Set<string>();
  const linkStyles: string[] = [];
  let linkIndex = 0;

  // Collect all nodes
  for (const flow of dataFlows) {
    nodes.add(flow.from);
    nodes.add(flow.to);
  }

  // Define nodes with styling based on type
  for (const node of nodes) {
    const sanitizedNode = sanitizeId(node);
    // Simple node definition
    lines.push(`    ${sanitizedNode}[${node}]`);
  }

  lines.push("");

  // Define connections
  for (const flow of dataFlows) {
    const fromNode = sanitizeId(flow.from);
    const toNode = sanitizeId(flow.to);
    const arrow = getFlowArrow(flow.flowType);
    const label = flow.entities.length > 0 ? flow.entities[0] : flow.flowType;

    lines.push(`    ${fromNode} ${arrow}|${label}| ${toNode}`);
    linkStyles.push(`    linkStyle ${linkIndex} ${getStrengthStyle(flow.strength)}`);
    linkIndex++;
  }

  // Add link styles
  if (linkStyles.length > 0) {
    lines.push("");
    lines.push(...linkStyles);
  }

  // Add node styles
  lines.push("");
  lines.push("    classDef default fill:var(--surface-1),stroke:var(--surface-3),color:var(--text-primary)");
  lines.push("    classDef critical fill:var(--surface-2),stroke:var(--border-default),color:var(--text-secondary)");
  lines.push("    classDef important fill:var(--surface-2),stroke:var(--border-default),color:var(--text-secondary)");

  return lines.join("\n");
}

// =============================================================================
// Component
// =============================================================================

export const DataFlowGraph = memo(function DataFlowGraph({
  dataFlows,
  className,
  title = "Data Flow Diagram",
  showLegend = true,
}: DataFlowGraphProps) {
  const mermaidCode = useMemo(
    () => generateMermaidDiagram(dataFlows),
    [dataFlows]
  );

  if (dataFlows.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8",
          "rounded-xl border border-[var(--border-muted)] bg-[var(--surface-0)]",
          className
        )}
      >
        <GitBranch className="h-8 w-8 text-[var(--text-muted)]" />
        <span className="mt-2 text-[var(--text-muted)]">No data flows to visualize</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border-muted)] bg-[var(--surface-0)] overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-4 py-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[var(--text-secondary)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
          <span className="text-xs text-[var(--text-muted)]">
            ({dataFlows.length} flows)
          </span>
        </div>

        {/* Controls placeholder - could be enhanced with zoom */}
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            title="Fit to view"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Diagram */}
      <div className="p-4">
        <MermaidDiagram
          chart={mermaidCode}
          className="min-h-[200px]"
        />
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center gap-6 border-t border-[var(--border-muted)] px-4 py-2">
          <div className="text-xs text-[var(--text-muted)]">Strength:</div>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-4 bg-[var(--surface-3)] rounded" style={{ height: "3px" }} />
            <span className="text-xs text-[var(--text-secondary)]">Critical</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-4 bg-[var(--surface-3)] rounded" style={{ height: "2px" }} />
            <span className="text-xs text-[var(--text-secondary)]">Important</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-4 bg-[var(--surface-3)] rounded" style={{ height: "1px" }} />
            <span className="text-xs text-[var(--text-muted)]">Optional</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default DataFlowGraph;
