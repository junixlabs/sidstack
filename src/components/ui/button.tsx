import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// =============================================================================
// DESIGN TOKENS (CSS Variables - monochrome neutral palette)
// =============================================================================

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)] focus-visible:ring-[var(--accent-primary)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--surface-3)] text-[var(--text-primary)] shadow-md hover:bg-[var(--surface-4)] active:bg-[var(--surface-4)] active:scale-[0.98]",
        destructive:
          "bg-[var(--color-error)]/15 text-[var(--color-error)] shadow-md hover:bg-[var(--color-error)]/25 active:bg-[var(--color-error)]/30 active:scale-[0.98]",
        outline:
          "border border-[var(--border-muted)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-2)] hover:border-[var(--border-default)] active:bg-[var(--surface-3)] active:scale-[0.98]",
        secondary:
          "bg-[var(--surface-2)] text-[var(--text-primary)] hover:bg-[var(--surface-3)] active:bg-[var(--surface-4)] active:scale-[0.98]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] active:bg-[var(--surface-3)] active:scale-[0.98]",
        link: "text-[var(--text-secondary)] underline-offset-4 hover:underline active:opacity-80",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3.5 py-1.5 text-[12px]",
        lg: "h-10 px-6 rounded-lg",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",  /* Increased from 28px to 32px for touch targets */
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
