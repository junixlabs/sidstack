import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

// Uses CSS variables from index.css: --surface-*, --text-*, --border-*

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border px-3 py-2 text-[13px]",
          "bg-[var(--surface-0)] border-[var(--surface-3)] text-[var(--text-primary)]",
          "placeholder:text-[var(--text-muted)]",
          "transition-colors duration-150",
          "hover:border-[var(--border-hover)] hover:bg-[var(--surface-1)]",
          "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
