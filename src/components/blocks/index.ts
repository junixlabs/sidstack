/**
 * Block Components
 *
 * Warp-style block-based terminal UI components for Claude Code output.
 */

export { BlockContainer } from "./BlockContainer";
export type { BlockContainerProps } from "./BlockContainer";

export { InputBlock } from "./InputBlock";
export type { InputBlockProps } from "./InputBlock";

export { ThinkingBlock } from "./ThinkingBlock";
export type { ThinkingBlockProps } from "./ThinkingBlock";

export { ToolBlock } from "./ToolBlock";
export type { ToolBlockProps } from "./ToolBlock";

export { OutputBlock } from "./OutputBlock";
export type { OutputBlockProps } from "./OutputBlock";

export { ErrorBlock } from "./ErrorBlock";
export type { ErrorBlockProps } from "./ErrorBlock";

export { SystemBlock } from "./SystemBlock";
export type { SystemBlockProps } from "./SystemBlock";

export { BlockList } from "./BlockList";
export type { BlockListProps } from "./BlockList";

export { CodeBlock } from "./CodeBlock";
export type { CodeBlockProps } from "./CodeBlock";

// New WaveTerm-style block system
export { Block } from "./Block";
export { BlockFrame } from "./BlockFrame";
export { registerBlockView, getBlockView } from "./BlockRegistry";
export { TileLayout } from "./layout";

// Explicit function call — not tree-shakeable
import { ensureBlockViewsRegistered } from "./views";
ensureBlockViewsRegistered();
