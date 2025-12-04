import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  X,
  Maximize2,
  Minimize2,
  GripVertical,
  FileText,
  Globe,
  Settings,
  SplitSquareHorizontal,
  SplitSquareVertical,
  Copy,
  Layers,
  BookOpen,
  ListTodo,
  GraduationCap,
  GitBranch,
  Ticket,
} from "lucide-react";
import { memo, useCallback, type ReactNode } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BlockViewType, BlockAction } from "@/types/block";

// ============================================================================
// HUD STYLE HELPERS
// ============================================================================

// HUD Corner accent - top-left and top-right
function HudCornerAccent({ position }: { position: "left" | "right" }) {
  return (
    <div className={cn(
      "absolute top-0 w-3 h-3 pointer-events-none",
      position === "left" ? "left-0" : "right-0"
    )}>
      <div className={cn(
        "absolute top-0 w-full h-[1px] bg-gradient-to-r",
        position === "left"
          ? "left-0 from-[var(--border-default)] to-transparent"
          : "right-0 from-transparent to-[var(--border-default)]"
      )} />
      <div className={cn(
        "absolute top-0 h-full w-[1px] bg-gradient-to-b from-[var(--border-default)] to-transparent",
        position === "left" ? "left-0" : "right-0"
      )} />
    </div>
  );
}

interface BlockFrameProps {
  blockId: string;
  blockIndex?: number;  // 1-based position for display (1, 2, 3...)
  viewType: BlockViewType;
  title?: string;
  isFocused?: boolean;
  isMaximized?: boolean;
  children: ReactNode;
  onClose?: () => void;
  onMaximize?: () => void;
  onFocus?: () => void;
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
  onDuplicate?: () => void;
  actions?: BlockAction[];
  className?: string;
  /** Hide maximize/close buttons (for fullscreen single-view mode) */
  hideWindowControls?: boolean;
}

/**
 * Get icon for block view type
 */
function getViewIcon(viewType: BlockViewType) {
  switch (viewType) {
    case "preview":
      return <FileText className="w-3.5 h-3.5" />;
    case "webview":
      return <Globe className="w-3.5 h-3.5" />;
    case "settings":
      return <Settings className="w-3.5 h-3.5" />;
    case "specs-browser":
      return <Layers className="w-3.5 h-3.5" />;
    case "project-hub":
      return <Layers className="w-3.5 h-3.5" />;
    case "knowledge-browser":
      return <BookOpen className="w-3.5 h-3.5" />;
    case "task-manager":
      return <ListTodo className="w-3.5 h-3.5" />;
    case "training-room":
      return <GraduationCap className="w-3.5 h-3.5" />;
    case "worktree-status":
      return <GitBranch className="w-3.5 h-3.5" />;
    case "ticket-queue":
      return <Ticket className="w-3.5 h-3.5" />;
    default:
      return <FileText className="w-3.5 h-3.5" />;
  }
}

/**
 * Get display name for block view type
 * Converts kebab-case to Title Case for unknown types
 */
function getViewName(viewType: BlockViewType): string {
  switch (viewType) {
    case "preview":
      return "Preview";
    case "webview":
      return "Web";
    case "settings":
      return "Settings";
    case "specs-browser":
      return "Specs";
    case "project-hub":
      return "Project Hub";
    case "knowledge-browser":
      return "Knowledge";
    case "task-manager":
      return "Tasks";
    case "training-room":
      return "Training";
    case "worktree-status":
      return "Worktree";
    case "ticket-queue":
      return "Tickets";
    default:
      // Convert kebab-case to Title Case: "some-view" -> "Some View"
      return (viewType as string)
        .split("-")
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
  }
}

/**
 * BlockFrame wraps block content with a header, controls, and styling.
 * Supports drag-drop via @dnd-kit.
 */
export const BlockFrame = memo(function BlockFrame({
  blockId,
  blockIndex,
  viewType,
  title,
  isFocused = false,
  isMaximized = false,
  children,
  onClose,
  onMaximize,
  onFocus,
  onSplitHorizontal,
  onSplitVertical,
  onDuplicate,
  actions = [],
  className,
  hideWindowControls = false,
}: BlockFrameProps) {
  // Draggable setup
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: blockId,
    data: { blockId, viewType, title },
  });


  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.8 : 1,
      }
    : undefined;

  const handleMouseDown = useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose?.();
    },
    [onClose]
  );

  const handleMaximize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMaximize?.();
    },
    [onMaximize]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col h-full w-full overflow-hidden relative",
        // HUD Style: Deep dark with border when focused (only for non-fullscreen)
        "bg-[var(--surface-0)]",
        !hideWindowControls && "rounded-lg",
        !hideWindowControls && "border transition-colors duration-150",
        !hideWindowControls && (isFocused
          ? "border-[var(--border-default)]"
          : "border-[var(--border-muted)]"),
        isDragging && "shadow-lg ring-2 ring-[var(--border-default)]",
        className
      )}
      data-block-id={blockId}
    >
      {/* HUD Corner accents - only show when header is visible */}
      {!hideWindowControls && (
        <>
          <HudCornerAccent position="left" />
          <HudCornerAccent position="right" />
        </>
      )}

      {/* Header - HUD Style Drag Handle - Hidden for sidebar-managed fullscreen views */}
      {!hideWindowControls && (
        <div
          {...attributes}
          {...listeners}
          onMouseDown={handleMouseDown}
          className={cn(
            "flex items-center h-8 px-2 gap-1.5 shrink-0 relative",
            // HUD dark header with subtle gradient
            "bg-[var(--surface-1)]",
            "border-b border-[var(--border-muted)]",
            "cursor-grab active:cursor-grabbing",
            "select-none",
            isDragging && "cursor-grabbing"
          )}
        >
          {/* Subtle scanline at bottom of header */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--border-muted)] to-transparent" />

          {/* Drag handle icon - HUD style */}
          <GripVertical className={cn(
            "w-3 h-3 shrink-0 transition-colors",
            isFocused ? "text-[var(--text-muted)]" : "text-[var(--border-default)]"
          )} />

          {/* Block position number - HUD style badge */}
          {blockIndex && blockIndex <= 9 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "flex items-center justify-center w-5 h-5 rounded text-[11px] font-mono shrink-0 transition-all",
                    isFocused
                      ? "bg-[var(--surface-2)] text-[var(--text-secondary)]"
                      : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                  )}
                >
                  {blockIndex}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[var(--surface-1)] border-[var(--border-muted)]">
                <span className="text-[var(--text-primary)]">Focus</span>
                <kbd className="ml-2 px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[10px] text-[var(--text-secondary)]">
                  ⌘{blockIndex}
                </kbd>
              </TooltipContent>
            </Tooltip>
          )}

          {/* View icon + Title (simplified header) */}
          <div className={cn(
            "flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden transition-colors",
            isFocused ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
          )}>
            {getViewIcon(viewType)}
            <span className={cn(
              "text-[11px] truncate transition-colors",
              isFocused ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
            )}>
              {title || getViewName(viewType)}
            </span>
          </div>

          {/* Action buttons - HUD style, always visible */}
          <div className="flex items-center shrink-0 ml-auto gap-1">
            {/* Custom actions */}
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                disabled={action.disabled}
                onPointerDown={(e) => e.stopPropagation()}
                className={cn(
                  "p-1 rounded transition-all duration-200",
                  "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]",
                  action.disabled && "opacity-50 cursor-not-allowed"
                )}
                title={action.label}
                aria-label={action.label}
              >
                {action.icon}
              </button>
            ))}

            {/* Maximize button - HUD style */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleMaximize}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={cn(
                    "p-1 rounded transition-all duration-200",
                    "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                  )}
                >
                  {isMaximized ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[var(--surface-1)] border-[var(--border-muted)]">
                <span className="text-[var(--text-primary)]">{isMaximized ? "Restore" : "Maximize"}</span>
                <kbd className="ml-2 px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[10px] text-[var(--text-secondary)]">[⌘Enter]</kbd>
              </TooltipContent>
            </Tooltip>

            {/* Close button - Magenta accent for danger */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={cn(
                    "p-1 rounded transition-all duration-200",
                    "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]"
                  )}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-[var(--surface-1)] border-[var(--border-muted)]">
                <span className="text-[var(--text-primary)]">Close</span>
                <kbd className="ml-2 px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[10px] text-[var(--text-secondary)]">[⌘W]</kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Content wrapped in ContextMenu for right-click support */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 overflow-hidden bg-[var(--surface-0)]">
            {children}
          </div>
        </ContextMenuTrigger>

        {/* HUD styled context menu */}
        <ContextMenuContent className="w-56 bg-[var(--surface-1)] border-[var(--border-muted)]">
        {onSplitHorizontal && (
          <ContextMenuItem onClick={onSplitHorizontal} className="text-[var(--text-primary)] focus:bg-[var(--surface-2)] focus:text-[var(--text-primary)]">
            <SplitSquareHorizontal className="w-4 h-4 mr-2" />
            <span className="flex-1">Split Right</span>
            <kbd className="ml-auto text-[10px] text-[var(--text-muted)]">[⌘\]</kbd>
          </ContextMenuItem>
        )}
        {onSplitVertical && (
          <ContextMenuItem onClick={onSplitVertical} className="text-[var(--text-primary)] focus:bg-[var(--surface-2)] focus:text-[var(--text-primary)]">
            <SplitSquareVertical className="w-4 h-4 mr-2" />
            <span className="flex-1">Split Down</span>
            <kbd className="ml-auto text-[10px] text-[var(--text-muted)]">[⌘⇧\]</kbd>
          </ContextMenuItem>
        )}
        {(onSplitHorizontal || onSplitVertical) && onDuplicate && (
          <ContextMenuSeparator className="bg-[var(--border-muted)]" />
        )}
        {onDuplicate && (
          <ContextMenuItem onClick={onDuplicate} className="text-[var(--text-primary)] focus:bg-[var(--surface-2)] focus:text-[var(--text-primary)]">
            <Copy className="w-4 h-4 mr-2" />
            <span className="flex-1">Duplicate</span>
          </ContextMenuItem>
        )}
        {(onSplitHorizontal || onSplitVertical || onDuplicate) && (
          <ContextMenuSeparator className="bg-[var(--border-muted)]" />
        )}
        <ContextMenuItem onClick={handleMaximize} className="text-[var(--text-primary)] focus:bg-[var(--surface-2)] focus:text-[var(--text-primary)]">
          {isMaximized ? (
            <>
              <Minimize2 className="w-4 h-4 mr-2" />
              <span className="flex-1">Restore</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4 mr-2" />
              <span className="flex-1">Maximize</span>
            </>
          )}
          <kbd className="ml-auto text-[10px] text-[var(--text-muted)]">[⌘Enter]</kbd>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleClose} className="text-[var(--text-secondary)] focus:bg-[var(--surface-2)] focus:text-[var(--text-secondary)]">
          <X className="w-4 h-4 mr-2" />
          <span className="flex-1">Close</span>
          <kbd className="ml-auto text-[10px] text-[var(--text-muted)]">[⌘W]</kbd>
        </ContextMenuItem>
      </ContextMenuContent>
      </ContextMenu>
    </div>
  );
});
