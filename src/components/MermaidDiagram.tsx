import clsx from "clsx";
import { AlertCircle, Loader2, RefreshCw, Code, Copy, Check } from "lucide-react";
import { useEffect, useRef, useState, useId, useCallback, memo } from "react";

// Lazy load mermaid to avoid CSP issues
let mermaidModule: typeof import("mermaid") | null = null;
let mermaidInitialized = false;

// SVG Cache - persists across component re-renders
const svgCache = new Map<string, string>();
const errorCache = new Map<string, string>();

function getCacheKey(chart: string): string {
  // Simple hash for cache key
  let hash = 0;
  for (let i = 0; i < chart.length; i++) {
    hash = ((hash << 5) - hash) + chart.charCodeAt(i);
    hash |= 0;
  }
  return `mermaid_${hash}`;
}

async function getMermaid() {
  if (!mermaidModule) {
    mermaidModule = await import("mermaid");
  }
  if (!mermaidInitialized) {
    mermaidModule.default.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose", // Allow more flexibility in Tauri
      themeVariables: {
        // Use hex colors - Mermaid doesn't support CSS variables
        primaryColor: "#5c9fd4",      // accent-primary
        primaryTextColor: "#e0e0e0",  // text-primary
        primaryBorderColor: "#333333", // border-default
        lineColor: "#5c9fd4",         // accent-primary
        secondaryColor: "#2e2e2e",    // surface-3
        tertiaryColor: "#121212",     // surface-0
        background: "#121212",        // surface-0
        mainBkg: "#242424",           // surface-2
        secondBkg: "#2e2e2e",         // surface-3
        border1: "#333333",           // border-default
        border2: "#282828",           // border-muted
        arrowheadColor: "#5c9fd4",    // accent-primary
        fontFamily: "ui-monospace, monospace",
        fontSize: "13px",
        textColor: "#e0e0e0",         // text-primary
        nodeTextColor: "#e0e0e0",     // text-primary
      },
      flowchart: {
        curve: "basis",
        padding: 15,
      },
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 50,
        width: 150,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
      },
    });
    mermaidInitialized = true;
  }
  return mermaidModule.default;
}

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

/**
 * Renders Mermaid diagrams with dark theme
 * - Lazy loads mermaid to avoid CSP issues
 * - Caches rendered SVGs for instant re-display
 * - Uses IntersectionObserver for lazy rendering (only renders when visible)
 * - Includes retry functionality
 * - Better error UI with actions
 */
export const MermaidDiagram = memo(function MermaidDiagram({ chart, className = "" }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cacheKey = getCacheKey(chart);

  // Check cache first for instant display
  const cachedSvg = svgCache.get(cacheKey);
  const cachedError = errorCache.get(cacheKey);

  const [svg, setSvg] = useState<string>(cachedSvg || "");
  const [error, setError] = useState<string | null>(cachedError || null);
  const [isLoading, setIsLoading] = useState(!cachedSvg && !cachedError);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const uniqueId = useId().replace(/:/g, "_");

  // Lazy rendering with IntersectionObserver - only render when visible
  useEffect(() => {
    // If already cached, no need for lazy loading
    if (cachedSvg || cachedError) {
      setIsVisible(true);
      return;
    }

    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Only need to trigger once
        }
      },
      {
        rootMargin: "100px", // Start loading 100px before visible
        threshold: 0.1,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [cachedSvg, cachedError]);

  const renderDiagram = useCallback(async () => {
    if (!chart.trim()) {
      setError("Empty diagram");
      setIsLoading(false);
      return;
    }

    // Skip if already cached
    if (svgCache.has(cacheKey)) {
      setSvg(svgCache.get(cacheKey)!);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const mermaid = await getMermaid();

      // Validate the syntax first
      await mermaid.parse(chart);

      // Render the diagram
      const { svg: renderedSvg } = await mermaid.render(
        `mermaid-${uniqueId}-${retryCount}`,
        chart
      );

      // Cache the result
      svgCache.set(cacheKey, renderedSvg);
      errorCache.delete(cacheKey);

      setSvg(renderedSvg);
    } catch (err) {
      console.error("Mermaid render error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to render diagram";
      const cleanError = errorMessage.replace(/Parse error on line \d+:/, "Syntax error:");

      // Cache the error too
      errorCache.set(cacheKey, cleanError);
      setError(cleanError);
    } finally {
      setIsLoading(false);
    }
  }, [chart, cacheKey, uniqueId, retryCount]);

  useEffect(() => {
    // Only render if visible and not cached
    if (isVisible && !cachedSvg && !cachedError) {
      renderDiagram();
    }
  }, [renderDiagram, cachedSvg, cachedError, isVisible]);

  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  const handleCopySource = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [chart]);

  // Not visible yet - show lightweight placeholder
  if (!isVisible && !cachedSvg && !cachedError) {
    return (
      <div
        ref={containerRef}
        className={clsx(
          "flex items-center justify-center p-8 min-h-[100px]",
          "bg-[var(--surface-2)] rounded-lg border border-[var(--border-muted)]",
          className
        )}
      >
        <span className="text-sm text-[var(--text-muted)]">Diagram</span>
      </div>
    );
  }

  // Loading state (visible but still rendering)
  if (isLoading) {
    return (
      <div
        ref={containerRef}
        className={clsx(
          "flex items-center justify-center p-8",
          "bg-[var(--surface-2)] rounded-lg border border-[var(--border-muted)]",
          className
        )}
      >
        <Loader2 className="w-5 h-5 animate-spin text-[var(--text-secondary)]" />
        <span className="ml-2 text-sm text-[var(--text-secondary)]">Rendering diagram...</span>
      </div>
    );
  }

  // Error state with better UI
  if (error) {
    return (
      <div
        className={clsx(
          "rounded-lg border overflow-hidden",
          "bg-[var(--surface-2)] border-[var(--border-muted)]",
          className
        )}
      >
        {/* Error Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--border-muted)]">
          <AlertCircle className="w-5 h-5 text-[var(--text-secondary)] shrink-0" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            Failed to render Mermaid diagram
          </span>
        </div>

        {/* Error Content */}
        <div className="p-4">
          <pre className="text-xs text-[var(--text-muted)] whitespace-pre-wrap mb-4 font-mono">
            {error}
          </pre>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={handleRetry}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm",
                "bg-[var(--surface-3)] border border-[var(--border-default)] text-[var(--text-secondary)]",
                "hover:bg-[var(--surface-3)] hover:border-[var(--border-default)] transition-colors"
              )}
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={() => setShowSource(!showSource)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm",
                "bg-[var(--surface-2)] border border-[var(--border-muted)] text-[var(--text-muted)]",
                "hover:bg-[var(--surface-3)] hover:border-[var(--border-default)] transition-colors",
                showSource && "bg-[var(--surface-3)] border-[var(--border-default)]"
              )}
            >
              <Code className="w-4 h-4" />
              {showSource ? "Hide Source" : "View Source"}
            </button>
          </div>

          {/* Source Code (Collapsible) */}
          {showSource && (
            <div className="relative">
              <button
                onClick={handleCopySource}
                className={clsx(
                  "absolute top-2 right-2 p-1.5 rounded",
                  "bg-[var(--surface-3)] hover:bg-[var(--surface-3)] transition-colors",
                  "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
                title="Copy source"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[var(--text-secondary)]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <pre className="p-3 bg-[var(--surface-1)] rounded-lg text-xs text-[var(--text-secondary)] overflow-x-auto font-mono">
                {chart}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div
      ref={containerRef}
      className={clsx(
        "mermaid-container p-4 rounded-lg",
        "bg-[var(--surface-2)] border border-[var(--border-muted)]",
        "overflow-x-auto",
        "[&_svg]:max-w-full [&_svg]:h-auto",
        className
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});

export default MermaidDiagram;
