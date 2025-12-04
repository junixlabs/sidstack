import * as React from "react";

import { cn } from "@/lib/utils";

// Uses CSS variables from index.css: --surface-*, --text-*, --border-*

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-xl border-2 border-[var(--surface-3)] bg-[var(--surface-0)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
          "transition-all duration-150 resize-none",
          "focus:border-blue-500 focus:bg-[var(--surface-1)] focus:outline-none focus:ring-2 focus:ring-blue-500/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
