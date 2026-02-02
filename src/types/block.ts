// Block System Types for SidStack
// Inspired by WaveTerm's block architecture

export type BlockViewType = "preview" | "webview" | "settings" | "specs-browser" | "knowledge-browser" | "training-room" | "task-manager" | "worktree-status" | "worktree-overview" | "ticket-queue" | "project-hub";

/**
 * Block data stored per block instance
 */
export interface BlockData {
  id: string;
  viewType: BlockViewType;
  title?: string;

  // Sidebar navigation - tracks which sidebar item created this block
  // Used to find existing block when clicking same sidebar item again
  sidebarItemId?: string;

  // Working directory (for sessions, etc.)
  cwd?: string;

  // Preview-specific
  filePath?: string;

  // WebView-specific
  url?: string;

  // Knowledge Browser-specific
  knowledgePath?: string; // Path to knowledge folder (relative to project root)
  selectedDocPath?: string; // Currently selected document

  // Training Room-specific
  trainingSessionId?: string; // ID of the training session
  trainingModuleId?: string; // Module ID for the training session

  // Worktree Status-specific
  worktreePath?: string; // Path to the worktree

  // Cross-feature navigation - used when navigating from other views
  selectedTaskId?: string; // Pre-select this task in Task Manager
  filterByModule?: string; // Filter Task Manager by this module

  // Metadata
  createdAt: number;
}

/**
 * Block runtime state (not persisted)
 */
export interface BlockState {
  isFocused: boolean;
  isMaximized: boolean;
  isLoading: boolean;
}

/**
 * Layout node in the tree structure
 * Leaf nodes have blockId, branch nodes have children
 */
export interface LayoutNode {
  id: string;
  type: "leaf" | "branch";

  // For branch nodes
  direction?: "horizontal" | "vertical";
  children?: LayoutNode[];
  sizes?: number[]; // Percentage sizes for each child

  // For leaf nodes
  blockId?: string;

  // For React key stability: when a leaf is wrapped in a branch,
  // this tracks the original blockId to prevent React remounting.
  // Used as React key for branches instead of node.id
  primaryBlockId?: string;
}

/**
 * Position for drag-drop operations
 */
export type DropPosition = "left" | "right" | "top" | "bottom" | "center";

/**
 * Session data for persistence
 */
export interface SessionData {
  claudeSessionId?: string;
  cwd: string;
  title?: string;
  lastActive: number;
}

/**
 * Props for block view components
 */
export interface BlockViewProps {
  block: BlockData;
  blockState: BlockState;
  onTitleChange?: (title: string) => void;
}

/**
 * Block frame header action
 */
export interface BlockAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}
