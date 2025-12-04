/**
 * Phase Detector
 *
 * Parses tasks.md files to extract phases and tasks.
 * Auto-detects phase from task assignments when not explicitly marked.
 */

export interface ParsedTask {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  phase: string;
  assignedAgent?: string;
  priority: "low" | "medium" | "high";
  subtasks?: ParsedTask[];
}

export interface ParsedPhase {
  id: string;
  name: string;
  order: number;
  status: "pending" | "in_progress" | "completed";
  tasks: ParsedTask[];
}

// Agent role to phase mapping
const AGENT_PHASE_MAP: Record<string, string> = {
  backend: "Backend",
  "backend-dev": "Backend",
  dev: "Backend",
  frontend: "Frontend",
  "frontend-dev": "Frontend",
  ui: "Frontend",
  fullstack: "Integration",
  devops: "DevOps",
  qa: "Testing",
  test: "Testing",
  doc: "Documentation",
  docs: "Documentation",
  documentation: "Documentation",
};

// Default phase order
const PHASE_ORDER: Record<string, number> = {
  Backend: 1,
  Frontend: 2,
  Integration: 3,
  DevOps: 4,
  Testing: 5,
  Documentation: 6,
};

/**
 * Parse a tasks.md file content and extract phases and tasks
 */
export function parseTasksMarkdown(content: string): ParsedPhase[] {
  const lines = content.split("\n");
  const phases: ParsedPhase[] = [];
  let currentPhase: ParsedPhase | null = null;
  let phaseCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect phase headers: "## Phase 1: Backend" or "## 1. Backend Phase"
    const phaseMatch = line.match(/^##\s+(?:Phase\s+)?(\d+)?[.:]?\s*(.+?)(?:\s+Phase)?$/i);
    if (phaseMatch) {
      phaseCounter++;
      const phaseName = phaseMatch[2].trim();
      currentPhase = {
        id: `phase-${phaseCounter}`,
        name: phaseName,
        order: phaseMatch[1] ? parseInt(phaseMatch[1]) : phaseCounter,
        status: "pending",
        tasks: [],
      };
      phases.push(currentPhase);
      continue;
    }

    // Detect task items: "- [x] 1.1.1 Task title" or "- [ ] Task title"
    const taskMatch = line.match(/^-\s*\[([ xX])\]\s*(\d+(?:\.\d+)*)?\.?\s*(.+)$/);
    if (taskMatch && currentPhase) {
      const isCompleted = taskMatch[1].toLowerCase() === "x";
      const taskId = taskMatch[2] || `task-${currentPhase.tasks.length + 1}`;
      const title = taskMatch[3].trim();

      // Try to detect priority from title
      let priority: "low" | "medium" | "high" = "medium";
      if (title.toLowerCase().includes("critical") || title.toLowerCase().includes("urgent")) {
        priority = "high";
      } else if (title.toLowerCase().includes("optional") || title.toLowerCase().includes("nice to have")) {
        priority = "low";
      }

      // Try to detect assigned agent from title (e.g., "[backend]" or "@backend")
      let assignedAgent: string | undefined;
      const agentMatch = title.match(/\[(@?\w+)\]|@(\w+)/);
      if (agentMatch) {
        assignedAgent = (agentMatch[1] || agentMatch[2]).replace("@", "");
      }

      const task: ParsedTask = {
        id: `task-${taskId.replace(/\./g, "-")}`,
        title: title.replace(/\[.*?\]|@\w+/g, "").trim(),
        status: isCompleted ? "completed" : "pending",
        phase: currentPhase.name.toLowerCase(),
        assignedAgent,
        priority,
      };

      currentPhase.tasks.push(task);
    }
  }

  // Update phase status based on task completion
  for (const phase of phases) {
    const completedCount = phase.tasks.filter((t) => t.status === "completed").length;
    const blockedCount = phase.tasks.filter((t) => t.status === "blocked").length;

    if (phase.tasks.length === 0) {
      phase.status = "pending";
    } else if (completedCount === phase.tasks.length) {
      phase.status = "completed";
    } else if (completedCount > 0 || blockedCount > 0) {
      phase.status = "in_progress";
    } else {
      phase.status = "pending";
    }
  }

  return phases;
}

/**
 * Detect phase from agent assignment
 */
export function detectPhaseFromAgent(agentRole: string): string {
  const normalized = agentRole.toLowerCase().trim();
  return AGENT_PHASE_MAP[normalized] || "General";
}

/**
 * Get phase order for sorting
 */
export function getPhaseOrder(phaseName: string): number {
  return PHASE_ORDER[phaseName] || 99;
}

/**
 * Organize tasks by phase based on agent assignments
 */
export function organizeTasksByPhase(
  tasks: Array<{ id: string; title: string; assignedAgent?: string; status: string }>
): ParsedPhase[] {
  const phaseMap = new Map<string, ParsedPhase>();

  for (const task of tasks) {
    const phaseName = task.assignedAgent
      ? detectPhaseFromAgent(task.assignedAgent)
      : "General";

    if (!phaseMap.has(phaseName)) {
      phaseMap.set(phaseName, {
        id: `phase-${phaseName.toLowerCase()}`,
        name: phaseName,
        order: getPhaseOrder(phaseName),
        status: "pending",
        tasks: [],
      });
    }

    const phase = phaseMap.get(phaseName)!;
    phase.tasks.push({
      id: task.id,
      title: task.title,
      status: task.status as ParsedTask["status"],
      phase: phaseName.toLowerCase(),
      assignedAgent: task.assignedAgent,
      priority: "medium",
    });
  }

  // Convert to array and sort by order
  const phases = Array.from(phaseMap.values()).sort((a, b) => a.order - b.order);

  // Update phase statuses
  for (const phase of phases) {
    const completedCount = phase.tasks.filter((t) => t.status === "completed").length;
    if (phase.tasks.length > 0 && completedCount === phase.tasks.length) {
      phase.status = "completed";
    } else if (completedCount > 0) {
      phase.status = "in_progress";
    }
  }

  return phases;
}

export default {
  parseTasksMarkdown,
  detectPhaseFromAgent,
  getPhaseOrder,
  organizeTasksByPhase,
};
