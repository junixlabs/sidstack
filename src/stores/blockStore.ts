import { create } from "zustand";

import type { BlockData, BlockState, BlockViewType } from "@/types/block";

/**
 * Generate a unique block ID
 */
function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Per-workspace state storage
interface WorkspaceBlockState {
  blocks: Record<string, BlockData>;
  blockStates: Record<string, BlockState>;
  activeBlockId: string | null;
}

interface BlockStore {
  // Block data (persisted) - current workspace
  blocks: Record<string, BlockData>;

  // Block runtime state (not persisted) - current workspace
  blockStates: Record<string, BlockState>;

  // Active block - current workspace
  activeBlockId: string | null;

  // Per-workspace storage (for workspace switching)
  workspaceStates: Record<string, WorkspaceBlockState>;

  // Actions
  addBlock: (data: Partial<BlockData> & { viewType: BlockViewType }, reuseId?: string) => string;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, data: Partial<BlockData>) => void;
  setActiveBlock: (id: string | null) => void;

  // State actions
  updateBlockState: (id: string, state: Partial<BlockState>) => void;
  getBlockState: (id: string) => BlockState;

  // Utilities
  getBlock: (id: string) => BlockData | undefined;
  getAllBlocks: () => BlockData[];
  getBlocksByType: (type: BlockViewType) => BlockData[];

  // Bulk operations
  clearAllBlocks: () => void;
  clearBlocksForSwitch: () => void; // Clear UI only, don't kill PTYs (for workspace switch)

  // Workspace switching
  saveWorkspaceState: (workspacePath: string) => void;
  restoreWorkspaceState: (workspacePath: string) => boolean;
  hasWorkspaceState: (workspacePath: string) => boolean;
  clearWorkspaceState: (workspacePath: string) => void;
}

const defaultBlockState: BlockState = {
  isFocused: false,
  isMaximized: false,
  isLoading: false,
};

// NOTE: Block persistence is handled by useWorkspacePersistence hook
// which saves/restores per-workspace sessions. Global persistence is disabled
// to prevent cross-workspace data accumulation.
export const useBlockStore = create<BlockStore>()((set, get) => ({
      blocks: {},
      blockStates: {},
      activeBlockId: null,
      workspaceStates: {},

      addBlock: (data, reuseId) => {
        const id = reuseId || generateBlockId();
        const block: BlockData = {
          id,
          viewType: data.viewType,
          title: data.title,
          cwd: data.cwd,
          filePath: data.filePath,
          url: data.url,
          createdAt: Date.now(),
        };

        set((state) => ({
          blocks: { ...state.blocks, [id]: block },
          blockStates: { ...state.blockStates, [id]: { ...defaultBlockState } },
          activeBlockId: id,
        }));

        return id;
      },

      removeBlock: (id) => {
        set((state) => {
          const { [id]: _removed, ...remainingBlocks } = state.blocks;
          const { [id]: _removedState, ...remainingStates } = state.blockStates;

          // If removing active block, set active to another block or null
          let newActiveId = state.activeBlockId;
          if (state.activeBlockId === id) {
            const blockIds = Object.keys(remainingBlocks);
            newActiveId = blockIds.length > 0 ? blockIds[0] : null;
          }

          return {
            blocks: remainingBlocks,
            blockStates: remainingStates,
            activeBlockId: newActiveId,
          };
        });
      },

      updateBlock: (id, data) => {
        set((state) => ({
          blocks: {
            ...state.blocks,
            [id]: { ...state.blocks[id], ...data },
          },
        }));
      },

      setActiveBlock: (id) => {
        set((state) => {
          // Update focus states
          const newStates = { ...state.blockStates };

          // Unfocus all
          Object.keys(newStates).forEach((blockId) => {
            if (newStates[blockId]) {
              newStates[blockId] = { ...newStates[blockId], isFocused: false };
            }
          });

          // Focus the active one
          if (id && newStates[id]) {
            newStates[id] = { ...newStates[id], isFocused: true };
          }

          return {
            activeBlockId: id,
            blockStates: newStates,
          };
        });
      },

      updateBlockState: (id, stateUpdate) => {
        set((state) => ({
          blockStates: {
            ...state.blockStates,
            [id]: { ...(state.blockStates[id] || defaultBlockState), ...stateUpdate },
          },
        }));
      },

      getBlockState: (id) => {
        return get().blockStates[id] || defaultBlockState;
      },

      getBlock: (id) => {
        return get().blocks[id];
      },

      getAllBlocks: () => {
        return Object.values(get().blocks);
      },

      getBlocksByType: (type) => {
        return Object.values(get().blocks).filter((b) => b.viewType === type);
      },

  clearAllBlocks: () => {
    set({
      blocks: {},
      blockStates: {},
      activeBlockId: null,
    });
  },

  // Clear blocks for workspace switch
  clearBlocksForSwitch: () => {
    set({
      blocks: {},
      blockStates: {},
      activeBlockId: null,
    });
  },

  // Save current state to workspace storage
  saveWorkspaceState: (workspacePath) => {
    const { blocks, blockStates, activeBlockId } = get();
    // Only save if there's content
    if (Object.keys(blocks).length > 0) {
      set((state) => ({
        workspaceStates: {
          ...state.workspaceStates,
          [workspacePath]: {
            blocks: { ...blocks },
            blockStates: { ...blockStates },
            activeBlockId,
          },
        },
      }));
      console.log("[BlockStore] Saved workspace state:", workspacePath, Object.keys(blocks).length, "blocks");
    }
  },

  // Restore state from workspace storage
  restoreWorkspaceState: (workspacePath) => {
    const { workspaceStates } = get();
    const savedState = workspaceStates[workspacePath];
    if (savedState) {
      set({
        blocks: savedState.blocks,
        blockStates: savedState.blockStates,
        activeBlockId: savedState.activeBlockId,
      });
      console.log("[BlockStore] Restored workspace state:", workspacePath, Object.keys(savedState.blocks).length, "blocks");
      return true;
    }
    return false;
  },

  // Check if workspace has saved state
  hasWorkspaceState: (workspacePath) => {
    return !!get().workspaceStates[workspacePath];
  },

  // Clear saved workspace state
  clearWorkspaceState: (workspacePath) => {
    set((state) => {
      const { [workspacePath]: _, ...rest } = state.workspaceStates;
      return { workspaceStates: rest };
    });
  },
}));
