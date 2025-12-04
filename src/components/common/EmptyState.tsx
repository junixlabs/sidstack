import { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
  icon?: ReactNode;
  disabled?: boolean;
}

export interface EmptyStateProps {
  /** Icon to display at the top */
  icon: ReactNode;
  /** Main title */
  title: string;
  /** Description text */
  description: string;
  /** Action buttons */
  actions?: EmptyStateAction[];
  /** Tips or hints shown below actions */
  tips?: string[];
  /** Additional class names */
  className?: string;
  /** Compact mode for smaller containers */
  compact?: boolean;
}

/**
 * Reusable empty state component for views with no data.
 * Provides helpful guidance and actionable buttons.
 */
export function EmptyState({
  icon,
  title,
  description,
  actions = [],
  tips = [],
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6",
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--text-muted)]",
          compact ? "w-12 h-12 mb-3" : "w-16 h-16 mb-4"
        )}
      >
        <div className={compact ? "w-6 h-6" : "w-8 h-8"}>{icon}</div>
      </div>

      {/* Title */}
      <h3
        className={cn(
          "font-semibold text-[var(--text-primary)]",
          compact ? "text-base mb-1" : "text-lg mb-2"
        )}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className={cn(
          "text-[var(--text-muted)] max-w-md",
          compact ? "text-xs mb-4" : "text-sm mb-6"
        )}
      >
        {description}
      </p>

      {/* Actions */}
      {actions.length > 0 && (
        <div className={cn("flex flex-wrap gap-2 justify-center", compact ? "mb-3" : "mb-4")}>
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || (index === 0 ? "default" : "outline")}
              size={compact ? "sm" : "default"}
              onClick={action.onClick}
              disabled={action.disabled}
              className="gap-2"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Tips */}
      {tips.length > 0 && (
        <div className="space-y-1">
          {tips.map((tip, index) => (
            <p
              key={index}
              className={cn(
                "text-[var(--text-muted)]",
                compact ? "text-[10px]" : "text-xs"
              )}
            >
              {tip}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
