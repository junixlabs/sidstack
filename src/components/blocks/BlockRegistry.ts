import type { ComponentType } from "react";

import type { BlockViewProps, BlockViewType } from "@/types/block";

/**
 * Registry of block view components.
 * Maps view type to the component that renders it.
 *
 * Inspired by WaveTerm's BlockRegistry pattern.
 */
export const BlockRegistry = new Map<BlockViewType, ComponentType<BlockViewProps>>();

/**
 * Register a block view component
 */
export function registerBlockView(
  viewType: BlockViewType,
  component: ComponentType<BlockViewProps>
): void {
  BlockRegistry.set(viewType, component);
}

/**
 * Get a block view component by type
 */
export function getBlockView(
  viewType: BlockViewType
): ComponentType<BlockViewProps> | undefined {
  return BlockRegistry.get(viewType);
}

/**
 * Check if a view type is registered
 */
export function isViewTypeRegistered(viewType: BlockViewType): boolean {
  return BlockRegistry.has(viewType);
}

// Note: Actual component registrations happen in the view files
// This avoids circular dependencies
