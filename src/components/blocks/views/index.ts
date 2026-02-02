// Block view registration
// Uses setBlockViews() to pass component references directly,
// preventing Rollup from tree-shaking the registrations.

import { setBlockViews } from "../BlockRegistry";
import { KnowledgeBrowserBlockView } from "./KnowledgeBrowserBlockView";
import { TaskManagerBlockView } from "./TaskManagerBlockView";
import { WorktreeStatusBlockView } from "./WorktreeStatusBlockView";
import { WorktreeOverviewBlockView } from "./WorktreeOverviewBlockView";
import { TicketQueueBlockView } from "./TicketQueueBlockView";
import { SettingsBlockView } from "./SettingsBlockView";
import { TrainingRoomBlockView } from "./TrainingRoomBlockView";
import ProjectHubBlockView from "./ProjectHubBlockView";

export function ensureBlockViewsRegistered(): void {
  setBlockViews({
    "knowledge-browser": KnowledgeBrowserBlockView,
    "task-manager": TaskManagerBlockView,
    "worktree-status": WorktreeStatusBlockView,
    "worktree-overview": WorktreeOverviewBlockView,
    "ticket-queue": TicketQueueBlockView,
    "settings": SettingsBlockView,
    "training-room": TrainingRoomBlockView,
    "project-hub": ProjectHubBlockView,
  });
}
