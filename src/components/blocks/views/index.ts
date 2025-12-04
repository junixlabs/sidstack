// Block view exports
// Each view registers itself in BlockRegistry on import

export { KnowledgeBrowserBlockView } from "./KnowledgeBrowserBlockView";
export { TaskManagerBlockView } from "./TaskManagerBlockView";
export { WorktreeStatusBlockView } from "./WorktreeStatusBlockView";
export { TicketQueueBlockView } from "./TicketQueueBlockView";
export { SettingsBlockView } from "./SettingsBlockView";
export { TrainingRoomBlockView } from "./TrainingRoomBlockView";
export { default as ProjectHubBlockView } from "./ProjectHubBlockView";

// Import all views to trigger registration
import "./KnowledgeBrowserBlockView"; // Unified knowledge browser via REST API
import "./TaskManagerBlockView";
import "./WorktreeStatusBlockView";
import "./TicketQueueBlockView";
import "./SettingsBlockView";
import "./TrainingRoomBlockView";
import "./ProjectHubBlockView";
