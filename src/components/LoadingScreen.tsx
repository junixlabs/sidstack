/**
 * LoadingScreen - App splash/loading screen
 *
 * Displays animated logo while app initializes.
 * Used for initial load and major transitions.
 */

import { cn } from "@/lib/utils";

import { LogoAnimated } from "./Logo";

interface LoadingScreenProps {
  message?: string;
  isDark?: boolean;
  fullScreen?: boolean;
}

export function LoadingScreen({
  message = "Loading...",
  isDark = true,
  fullScreen = true,
}: LoadingScreenProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6",
        fullScreen && "fixed inset-0 z-50",
        isDark ? "bg-[var(--surface-0)]" : "bg-gray-50"
      )}
    >
      {/* Animated Logo */}
      <div className="relative">
        <LogoAnimated size={64} />

        {/* Glow effect */}
        <div
          className={cn(
            "absolute inset-0 rounded-full blur-2xl opacity-30",
            "bg-gradient-to-br from-[#F5A623] to-[#4ECDC4]"
          )}
        />
      </div>

      {/* App Name */}
      <div className="text-center">
        <h1
          className={cn(
            "text-2xl font-bold tracking-tight",
            isDark ? "text-[var(--text-primary)]" : "text-gray-900"
          )}
        >
          SidStack
        </h1>
        <p
          className={cn(
            "text-sm mt-1",
            isDark ? "text-[var(--text-muted)]" : "text-gray-500"
          )}
        >
          Agent Manager
        </p>
      </div>

      {/* Loading indicator */}
      <div className="flex flex-col items-center gap-3">
        <LoadingDots isDark={isDark} />
        <p
          className={cn(
            "text-xs animate-pulse",
            isDark ? "text-[var(--text-muted)]" : "text-gray-400"
          )}
        >
          {message}
        </p>
      </div>
    </div>
  );
}

// Animated loading dots
function LoadingDots(_props: { isDark: boolean }) {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full animate-bounce bg-[var(--accent-primary)]"
          )}
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: "0.6s",
          }}
        />
      ))}
    </div>
  );
}

// Inline loading spinner (for buttons, etc.)
export function LoadingSpinner({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("animate-spin", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Skeleton loader for content
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[var(--surface-2)]",
        className
      )}
      {...props}
    />
  );
}

// Logo-based loading indicator (small)
export function LogoLoader({ size = 32 }: { size?: number }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <LogoAnimated size={size} />
    </div>
  );
}

export default LoadingScreen;
