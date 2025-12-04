import { describe, it, expect, beforeEach } from "vitest";

import type { LayoutNode } from "@/types/block";

import { useBlockStore } from "../blockStore";
import { useLayoutStore } from "../layoutStore";

// Reset stores before each test
beforeEach(() => {
  useLayoutStore.setState({
    rootNode: null,
    maximizedBlockId: null,
    savedLayout: null,
  });
  useBlockStore.setState({
    blocks: {},
    blockStates: {},
    activeBlockId: null,
  });
});

describe("layoutStore", () => {
  describe("initLayout", () => {
    it("creates a branch with single leaf child", () => {
      // ROOT IS ALWAYS A BRANCH to prevent React remounting on split
      const { initLayout } = useLayoutStore.getState();

      initLayout("block-1");

      const { rootNode } = useLayoutStore.getState();
      expect(rootNode).not.toBeNull();
      expect(rootNode?.type).toBe("branch");
      expect(rootNode?.direction).toBe("horizontal");
      expect(rootNode?.children?.length).toBe(1);
      expect(rootNode?.children?.[0]?.type).toBe("leaf");
      expect(rootNode?.children?.[0]?.blockId).toBe("block-1");
      expect(rootNode?.id).toMatch(/^node-/);
    });
  });

  describe("splitBlock", () => {
    it("adds sibling when same direction (flat tree)", () => {
      // Setup: Create a block and init layout
      // Root starts as branch with direction: "horizontal"
      const blockId = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockId);

      const { rootNode: originalRoot } = useLayoutStore.getState();
      // Original leaf is child of root
      const originalLeafId = originalRoot?.children?.[0]?.id;

      // Split horizontally - same direction as root, so add sibling
      const newBlockId = useLayoutStore.getState().splitBlock(blockId, "horizontal", {
        viewType: "preview",
      });

      // Verify: root should have 2 children now (flat tree)
      const { rootNode } = useLayoutStore.getState();
      expect(rootNode?.type).toBe("branch");
      expect(rootNode?.direction).toBe("horizontal");
      expect(rootNode?.children?.length).toBe(2);

      // Original leaf should keep its ID
      const firstChild = rootNode?.children?.[0];
      expect(firstChild?.id).toBe(originalLeafId);
      expect(firstChild?.blockId).toBe(blockId);

      // New node should be a sibling
      const secondChild = rootNode?.children?.[1];
      expect(secondChild?.blockId).toBe(newBlockId);
    });

    it("creates nested branch when different direction", () => {
      // Setup: Create a block and init layout
      // Root starts as branch with direction: "horizontal"
      const blockId = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockId);

      // Split vertically - different direction, so create nested branch
      useLayoutStore.getState().splitBlock(blockId, "vertical", {
        viewType: "preview",
      });

      // Verify: root still has 1 child, but it's now a branch
      const { rootNode } = useLayoutStore.getState();
      expect(rootNode?.type).toBe("branch");
      expect(rootNode?.direction).toBe("horizontal");
      expect(rootNode?.children?.length).toBe(1);

      // First child should be a vertical branch
      const nestedBranch = rootNode?.children?.[0];
      expect(nestedBranch?.type).toBe("branch");
      expect(nestedBranch?.direction).toBe("vertical");
      expect(nestedBranch?.children?.length).toBe(2);
    });

    it("creates horizontal split correctly", () => {
      const blockId = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockId);

      useLayoutStore.getState().splitBlock(blockId, "horizontal", {
        viewType: "preview",
      });

      const { rootNode } = useLayoutStore.getState();
      // Root is always horizontal, split horizontal adds sibling
      expect(rootNode?.direction).toBe("horizontal");
      expect(rootNode?.children?.length).toBe(2);
    });

    it("creates vertical split correctly", () => {
      const blockId = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockId);

      useLayoutStore.getState().splitBlock(blockId, "vertical", {
        viewType: "preview",
      });

      const { rootNode } = useLayoutStore.getState();
      // Root is still horizontal, but child is now vertical branch
      expect(rootNode?.direction).toBe("horizontal");
      expect(rootNode?.children?.[0]?.direction).toBe("vertical");
    });

    it("sets primaryBlockId on nested branch for React key stability", () => {
      // This is critical for preventing terminal remount on vertical split
      const blockId = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockId);

      // Verify root has primaryBlockId
      const { rootNode: initialRoot } = useLayoutStore.getState();
      expect(initialRoot?.primaryBlockId).toBe(blockId);

      // Split vertically - creates nested branch
      useLayoutStore.getState().splitBlock(blockId, "vertical", {
        viewType: "preview",
      });

      const { rootNode } = useLayoutStore.getState();
      // Nested branch should have primaryBlockId = original blockId
      const nestedBranch = rootNode?.children?.[0];
      expect(nestedBranch?.type).toBe("branch");
      expect(nestedBranch?.primaryBlockId).toBe(blockId);
    });

    it("preserves primaryBlockId when nesting multiple times", () => {
      const blockId = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockId);

      // Split vertically first
      useLayoutStore.getState().splitBlock(blockId, "vertical", {
        viewType: "preview",
      });

      // Then split horizontally on the same block
      useLayoutStore.getState().splitBlock(blockId, "horizontal", {
        viewType: "preview",
      });

      // Find the branch containing blockId
      const { rootNode } = useLayoutStore.getState();
      const findBranchContaining = (node: any, targetBlockId: string): any => {
        if (node.type === "leaf") return null;
        for (const child of node.children || []) {
          if (child.type === "leaf" && child.blockId === targetBlockId) {
            return node; // This branch contains the target
          }
          const found = findBranchContaining(child, targetBlockId);
          if (found) return found;
        }
        return null;
      };

      const branchContainingBlock = findBranchContaining(rootNode, blockId);
      // The innermost branch containing blockId should have primaryBlockId = blockId
      expect(branchContainingBlock?.primaryBlockId).toBe(blockId);
    });
  });

  describe("closeBlock", () => {
    it("keeps sibling node IDs when closing a block", () => {
      // Setup: Create two blocks
      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);
      useLayoutStore.getState().splitBlock(blockA, "horizontal", {
        viewType: "preview",
      });

      // Get sibling node ID before close
      const { rootNode: beforeRoot } = useLayoutStore.getState();
      const siblingNodeId = beforeRoot?.children?.[1]?.id; // blockB's node ID

      // Close blockA
      useLayoutStore.getState().closeBlock(blockA);

      // Verify sibling kept its ID
      const { rootNode: afterRoot } = useLayoutStore.getState();
      // At root level, we don't promote, so it's still a branch with 1 child
      expect(afterRoot?.type).toBe("branch");
      expect(afterRoot?.children?.length).toBe(1);
      expect(afterRoot?.children?.[0]?.id).toBe(siblingNodeId);
    });

    it("does NOT promote single child at root level", () => {
      // Setup: Create two blocks then close one
      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);
      useLayoutStore.getState().splitBlock(blockA, "horizontal", {
        viewType: "preview",
      });

      useLayoutStore.getState().closeBlock(blockA);

      const { rootNode } = useLayoutStore.getState();
      // Root should still be a branch (not promoted to leaf)
      expect(rootNode?.type).toBe("branch");
      expect(rootNode?.children?.length).toBe(1);
    });

    it("DOES promote single child at non-root level", () => {
      // Setup: Create complex tree
      // branch-1
      //   ├── leaf-A
      //   └── branch-2
      //         ├── leaf-B
      //         └── leaf-C

      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);

      const blockB = useLayoutStore.getState().splitBlock(blockA, "horizontal", {
        viewType: "preview",
      });

      useLayoutStore.getState().splitBlock(blockB!, "vertical", {
        viewType: "preview",
      });

      // Close blockB - branch-2 should promote its remaining child (leaf-C)
      useLayoutStore.getState().closeBlock(blockB!);

      const { rootNode } = useLayoutStore.getState();
      // After promotion, root should have 2 children: leaf-A and leaf-C
      expect(rootNode?.children?.length).toBe(2);
      expect(rootNode?.children?.[0]?.type).toBe("leaf");
      expect(rootNode?.children?.[1]?.type).toBe("leaf");
    });

    it("syncs activeBlockId after close", () => {
      // Setup: Create two blocks, make first active
      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);
      const blockB = useLayoutStore.getState().splitBlock(blockA, "horizontal", {
        viewType: "preview",
      });

      // blockB is now active (from addBlock)
      useBlockStore.getState().setActiveBlock(blockA);

      // Close active block (blockA)
      useLayoutStore.getState().closeBlock(blockA);

      // activeBlockId should now be blockB
      const { activeBlockId } = useBlockStore.getState();
      expect(activeBlockId).toBe(blockB);
    });

    it("sets rootNode to null when closing last block", () => {
      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);

      useLayoutStore.getState().closeBlock(blockA);

      const { rootNode } = useLayoutStore.getState();
      expect(rootNode).toBeNull();
    });
  });

  describe("moveBlock", () => {
    it("preserves source node ID when moving", () => {
      // Setup: Create two blocks
      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);
      const blockB = useLayoutStore.getState().splitBlock(blockA, "horizontal", {
        viewType: "preview",
      });

      // Get source node ID
      const { rootNode: beforeRoot } = useLayoutStore.getState();
      const sourceNodeId = beforeRoot?.children?.[0]?.id; // blockA's node

      // Move blockA to bottom of blockB
      useLayoutStore.getState().moveBlock(blockA, blockB!, "bottom");

      // Find blockA's node in new tree
      const { rootNode } = useLayoutStore.getState();
      const findBlockNode = (node: LayoutNode | null, targetBlockId: string): LayoutNode | null => {
        if (!node) return null;
        if (node.type === "leaf" && node.blockId === targetBlockId) return node;
        if (node.children) {
          for (const child of node.children) {
            const found = findBlockNode(child, targetBlockId);
            if (found) return found;
          }
        }
        return null;
      };

      const movedNode = findBlockNode(rootNode, blockA);
      expect(movedNode?.id).toBe(sourceNodeId);
    });

    it("preserves target node ID when moving", () => {
      // Setup: Create two blocks
      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);
      const blockB = useLayoutStore.getState().splitBlock(blockA, "horizontal", {
        viewType: "preview",
      });

      // Get target node ID
      const { rootNode: beforeRoot } = useLayoutStore.getState();
      const targetNodeId = beforeRoot?.children?.[1]?.id; // blockB's node

      // Move blockA to bottom of blockB
      useLayoutStore.getState().moveBlock(blockA, blockB!, "bottom");

      // Find blockB's node in new tree
      const { rootNode } = useLayoutStore.getState();
      const findBlockNode = (node: LayoutNode | null, targetBlockId: string): LayoutNode | null => {
        if (!node) return null;
        if (node.type === "leaf" && node.blockId === targetBlockId) return node;
        if (node.children) {
          for (const child of node.children) {
            const found = findBlockNode(child, targetBlockId);
            if (found) return found;
          }
        }
        return null;
      };

      const targetNode = findBlockNode(rootNode, blockB!);
      expect(targetNode?.id).toBe(targetNodeId);
    });
  });

  describe("findFirstLeaf (via closeBlock)", () => {
    it("finds leftmost leaf in nested tree", () => {
      // Setup: Create complex tree
      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);

      const blockB = useLayoutStore.getState().splitBlock(blockA, "horizontal", {
        viewType: "preview",
      });

      const blockC = useLayoutStore.getState().splitBlock(blockB!, "vertical", {
        viewType: "preview",
      });

      // Make blockC active
      useBlockStore.getState().setActiveBlock(blockC!);

      // Close blockC
      useLayoutStore.getState().closeBlock(blockC!);

      // activeBlockId should be set to first leaf (blockA)
      const { activeBlockId } = useBlockStore.getState();
      expect(activeBlockId).toBe(blockA);
    });
  });

  describe("getNodeByBlockId", () => {
    it("finds leaf node by blockId", () => {
      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);

      const node = useLayoutStore.getState().getNodeByBlockId(blockA);
      expect(node).not.toBeNull();
      expect(node?.blockId).toBe(blockA);
    });

    it("returns null for non-existent blockId", () => {
      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);

      const node = useLayoutStore.getState().getNodeByBlockId("non-existent");
      expect(node).toBeNull();
    });
  });

  describe("resizeNodes", () => {
    it("updates sizes correctly", () => {
      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);
      useLayoutStore.getState().splitBlock(blockA, "horizontal", {
        viewType: "preview",
      });

      const { rootNode } = useLayoutStore.getState();
      const branchId = rootNode?.id;

      useLayoutStore.getState().resizeNodes(branchId!, [0.3, 0.7]);

      const { rootNode: updated } = useLayoutStore.getState();
      expect(updated?.sizes).toEqual([0.3, 0.7]);
    });
  });

  describe("maximizeBlock / restoreLayout", () => {
    it("maximizes block and saves previous layout", () => {
      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);
      useLayoutStore.getState().splitBlock(blockA, "horizontal", {
        viewType: "preview",
      });

      const { rootNode: originalLayout } = useLayoutStore.getState();

      useLayoutStore.getState().maximizeBlock(blockA);

      const { rootNode, savedLayout, maximizedBlockId } = useLayoutStore.getState();
      // Maximize also uses branch structure for consistency
      expect(rootNode?.type).toBe("branch");
      expect(rootNode?.children?.length).toBe(1);
      expect(rootNode?.children?.[0]?.blockId).toBe(blockA);
      expect(savedLayout).toEqual(originalLayout);
      expect(maximizedBlockId).toBe(blockA);
    });

    it("restores layout after maximize", () => {
      const blockA = useBlockStore.getState().addBlock({ viewType: "preview" });
      useLayoutStore.getState().initLayout(blockA);
      useLayoutStore.getState().splitBlock(blockA, "horizontal", {
        viewType: "preview",
      });

      const { rootNode: originalLayout } = useLayoutStore.getState();

      useLayoutStore.getState().maximizeBlock(blockA);
      useLayoutStore.getState().restoreLayout();

      const { rootNode, savedLayout, maximizedBlockId } = useLayoutStore.getState();
      expect(rootNode).toEqual(originalLayout);
      expect(savedLayout).toBeNull();
      expect(maximizedBlockId).toBeNull();
    });
  });
});
