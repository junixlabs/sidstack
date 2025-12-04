import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// =============================================================================
// DESIGN TOKENS (CSS Variables - monochrome neutral palette)
// =============================================================================

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--surface-3)] text-[var(--text-primary)]",
        primary: "bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]",
        secondary: "bg-[var(--surface-3)] text-[var(--text-secondary)]",
        success: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
        warning: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
        destructive: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
        outline: "border border-[var(--border-default)] text-[var(--text-secondary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
