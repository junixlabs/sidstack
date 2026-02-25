// Block view registration
// Uses setBlockViews() to pass component references directly,
// preventing Rollup from tree-shaking the registrations.

import { setBlockViews } from "../BlockRegistry";
import { AgentDeskBlockView } from "./AgentDeskBlockView";
import { DocsBlockView } from "./DocsBlockView";
import { KnowledgeBrowserBlockView } from "./KnowledgeBrowserBlockView";
import { TaskManagerBlockView } from "./TaskManagerBlockView";
import { TicketQueueBlockView } from "./TicketQueueBlockView";
import { SettingsBlockView } from "./SettingsBlockView";
import { TrainingRoomBlockView } from "./TrainingRoomBlockView";
import ProjectHubBlockView from "./ProjectHubBlockView";
import { TraceabilityBlockView } from "./TraceabilityBlockView";

export function ensureBlockViewsRegistered(): void {
  setBlockViews({
    "agent-desk": AgentDeskBlockView,
    "docs": DocsBlockView,
    "knowledge-browser": KnowledgeBrowserBlockView,
    "task-manager": TaskManagerBlockView,
    "ticket-queue": TicketQueueBlockView,
    "settings": SettingsBlockView,
    "training-room": TrainingRoomBlockView,
    "project-hub": ProjectHubBlockView,
    "traceability": TraceabilityBlockView,
  });
}
