/**
 * SidStack Logo Component
 *
 * Uses the official SidStack logo from public folder.
 * Multiple variants for different use cases.
 */

import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
};

/**
 * Main Logo component - uses PNG from public folder
 */
export function Logo({ size = "md", className }: LogoProps) {
  const pixelSize = typeof size === "number" ? size : SIZES[size];

  return (
    <img
      src="/logo.png"
      alt="SidStack"
      width={pixelSize}
      height={pixelSize}
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}

/**
 * Compact logo for header/navigation
 */
export function LogoCompact({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/logo.png"
      alt="SidStack"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}

/**
 * SVG Logo - uses SVG from public folder
 */
export function LogoSVG({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/logo.svg"
      alt="SidStack"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}

/**
 * Animated logo for loading states
 */
export function LogoAnimated({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src="/logo.png"
      alt="SidStack"
      width={size}
      height={size}
      className={cn("object-contain animate-pulse-slow", className)}
      draggable={false}
    />
  );
}

/**
 * Logo with text - horizontal layout
 */
export function LogoWithText({
  size = 32,
  className,
  isDark = true,
}: {
  size?: number;
  className?: string;
  isDark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src="/logo.png"
        alt="SidStack"
        width={size}
        height={size}
        className="object-contain"
        draggable={false}
      />
      <span
        className={cn(
          "font-semibold text-lg tracking-tight",
          isDark ? "text-[var(--text-primary)]" : "text-gray-900"
        )}
      >
        SidStack
      </span>
    </div>
  );
}

export default Logo;
