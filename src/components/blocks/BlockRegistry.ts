import type { ComponentType } from "react";

import type { BlockViewProps, BlockViewType } from "@/types/block";

type ViewMap = Partial<Record<BlockViewType, ComponentType<BlockViewProps>>>;

/**
 * Registry of block view components.
 *
 * Uses a plain object + getter function instead of Map to avoid
 * Rollup tree-shaking the .set() calls in production builds.
 *
 * Views are registered via setBlockViews() called from views/index.ts.
 */
let views: ViewMap = {};

/**
 * Set all block views at once (called during app init)
 */
export function setBlockViews(map: ViewMap): void {
  views = map;
}

/**
 * Register a single block view component
 */
export function registerBlockView(
  viewType: BlockViewType,
  component: ComponentType<BlockViewProps>
): void {
  views[viewType] = component;
}

/**
 * Get a block view component by type
 */
export function getBlockView(
  viewType: BlockViewType
): ComponentType<BlockViewProps> | undefined {
  return views[viewType];
}

/**
 * Check if a view type is registered
 */
export function isViewTypeRegistered(viewType: BlockViewType): boolean {
  return viewType in views;
}
