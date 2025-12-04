import clsx from "clsx";
import { FileSearch, AlertCircle, FileCode } from "lucide-react";

type EmptyStateType = "no-changes" | "no-selection" | "error";

interface EmptyStateProps {
  type: EmptyStateType;
  message?: string;
  className?: string;
}

const configs: Record<
  EmptyStateType,
  {
    icon: React.ReactNode;
    title: string;
    description: string;
  }
> = {
  "no-changes": {
    icon: <FileSearch className="w-12 h-12" />,
    title: "No changes to review",
    description: "Run agent tasks to generate code changes, then review them here.",
  },
  "no-selection": {
    icon: <FileCode className="w-12 h-12" />,
    title: "No file selected",
    description: "Select a file from the sidebar to view its diff.",
  },
  error: {
    icon: <AlertCircle className="w-12 h-12" />,
    title: "Something went wrong",
    description: "Failed to load diff data. Please try again.",
  },
};

/**
 * Empty state component for review panel
 */
export function EmptyState({ type, message, className = "" }: EmptyStateProps) {
  const config = configs[type];

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center h-full",
        "bg-zinc-900 text-zinc-500",
        className
      )}
    >
      <div className="opacity-50 mb-4">{config.icon}</div>
      <h3 className="text-lg font-medium text-zinc-300 mb-2">{config.title}</h3>
      <p className="text-sm text-zinc-500 text-center max-w-sm">
        {message || config.description}
      </p>
    </div>
  );
}

export default EmptyState;
