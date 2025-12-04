import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

// Uses CSS variables from index.css: --surface-*, --text-*, --border-*, --accent-*

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex items-center justify-between gap-2 rounded-md border border-[var(--surface-3)] px-3 py-1.5 text-[13px] bg-[var(--surface-0)] text-[var(--text-primary)] cursor-pointer transition-colors outline-none hover:border-[var(--border-hover)] focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-32 overflow-hidden rounded-md border border-[var(--surface-3)] bg-[var(--surface-1)] text-[var(--text-primary)] shadow-lg",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport className="p-1">
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

/**
 * SelectItem - Radix Select Item with structured rich content support
 *
 * Works WITH Radix's design:
 * - ItemText content shows in BOTH trigger and dropdown (Radix behavior)
 * - icon renders BEFORE ItemText (dropdown only)
 * - description renders AFTER ItemText (dropdown only)
 *
 * Props:
 *   - icon: React node to show before label in dropdown
 *   - description: Text to show below label in dropdown
 *   - children: Label text (shows in both trigger and dropdown)
 *
 * Usage:
 *   Simple:
 *     <SelectItem value="foo">Label</SelectItem>
 *
 *   With icon and description:
 *     <SelectItem value="foo" icon={<Terminal />} description="Feature-rich">
 *       iTerm
 *     </SelectItem>
 */
interface SelectItemProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  icon?: React.ReactNode;
  description?: string;
  /** @deprecated Use children for label, icon/description props for rich content */
  displayValue?: string;
}

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, icon, description, displayValue, ...props }, ref) => {
  // Support legacy displayValue prop during migration
  const hasRichContent = icon || description;
  const label = displayValue || children;

  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-pointer select-none rounded py-1.5 pl-3 pr-8 text-[13px] outline-none",
        "text-[var(--text-primary)] hover:bg-[var(--surface-2)] focus:bg-[var(--surface-3)]",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        hasRichContent ? "items-start gap-2" : "items-center",
        className
      )}
      textValue={typeof label === "string" ? label : displayValue}
      {...props}
    >
      <span className="absolute right-2 flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4 text-[var(--accent-primary)]" />
        </SelectPrimitive.ItemIndicator>
      </span>
      {hasRichContent ? (
        <>
          {/* Icon - only visible in dropdown */}
          {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
          {/* Label wrapper with description */}
          <div className="flex flex-col">
            {/* ItemText = Label - shows in BOTH trigger and dropdown */}
            <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
            {/* Description - only visible in dropdown */}
            {description && (
              <span className="text-xs text-[var(--text-muted)]">{description}</span>
            )}
          </div>
        </>
      ) : (
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      )}
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-[var(--surface-3)]", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
