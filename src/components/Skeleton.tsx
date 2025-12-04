import clsx from "clsx";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  className,
  variant = "text",
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const baseClasses = "animate-pulse bg-zinc-700/50";

  if (variant === "circular") {
    return (
      <div
        className={clsx(baseClasses, "rounded-full", className)}
        style={{ width, height }}
      />
    );
  }

  if (variant === "rectangular") {
    return (
      <div
        className={clsx(baseClasses, "rounded", className)}
        style={{ width, height }}
      />
    );
  }

  // Text variant - multiple lines
  return (
    <div className={clsx("space-y-2", className)} style={{ width }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            baseClasses,
            "rounded h-4",
            // Last line is usually shorter
            i === lines - 1 && lines > 1 && "w-3/4"
          )}
          style={{ height }}
        />
      ))}
    </div>
  );
}

// Pre-built skeleton layouts for common components
export function FileTreeSkeleton() {
  return (
    <div className="p-2 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 12}px` }}>
          <Skeleton variant="rectangular" width={14} height={14} />
          <Skeleton variant="text" className="flex-1" />
        </div>
      ))}
    </div>
  );
}

export function CodeViewerSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton variant="text" width={120} />
          <Skeleton variant="text" width={40} />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton variant="text" width={60} />
          <Skeleton variant="text" width={40} />
        </div>
      </div>
      {/* Code lines skeleton */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="flex">
          <Skeleton variant="text" width={32} className="mr-4" />
          <Skeleton variant="text" className="flex-1" />
        </div>
      ))}
    </div>
  );
}

export function DiffViewerSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton variant="rectangular" width={20} height={20} />
          <Skeleton variant="text" width={200} />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton variant="text" width={80} />
          <Skeleton variant="rectangular" width={140} height={28} />
        </div>
      </div>
      {/* Hunks */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="border border-zinc-700 rounded">
          <div className="bg-zinc-800 px-4 py-2">
            <Skeleton variant="text" width={200} />
          </div>
          <div className="p-2 space-y-1">
            {Array.from({ length: 8 }).map((_, j) => (
              <div key={j} className="flex">
                <Skeleton variant="text" width={40} className="mr-2" />
                <Skeleton variant="text" width={40} className="mr-2" />
                <Skeleton variant="text" className="flex-1" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceSelectorSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 p-2">
          <Skeleton variant="circular" width={14} height={14} />
          <div className="flex-1">
            <Skeleton variant="text" className="mb-1" />
            <Skeleton variant="text" width="60%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ImagePreviewSkeleton() {
  return (
    <div className="h-full flex flex-col">
      {/* Header skeleton */}
      <div className="flex-shrink-0 bg-zinc-800 border-b border-zinc-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="text" width={120} />
          <Skeleton variant="rectangular" width={40} height={20} />
          <Skeleton variant="text" width={80} />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton variant="rectangular" width={100} height={28} />
          <Skeleton variant="rectangular" width={80} height={28} />
        </div>
      </div>
      {/* Image area skeleton */}
      <div className="flex-1 flex items-center justify-center bg-zinc-900">
        <Skeleton variant="rectangular" width={400} height={300} className="rounded-lg" />
      </div>
    </div>
  );
}
