import clsx from "clsx";
import { Code, Eye } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { FixedSizeList as VirtualList } from "react-window";

import { useFile } from "@/hooks/useFile";
import type { FileContent } from "@/types";

import { ImagePreview } from "./ImagePreview";
import { MarkdownPreview } from "./MarkdownPreview";
import { MermaidDiagram } from "./MermaidDiagram";
import { CodeViewerSkeleton } from "./Skeleton";



// Threshold for enabling virtual scrolling
const VIRTUAL_SCROLL_THRESHOLD = 1000;
const LINE_HEIGHT = 20;

interface CodeViewerProps {
  filePath: string;
  language?: string;
  className?: string;
}

// File extensions that support preview
const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdx"];
const MERMAID_EXTENSIONS = [".mermaid", ".mmd"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"];

function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf(".");
  return lastDot !== -1 ? filePath.slice(lastDot).toLowerCase() : "";
}

function isMarkdownFile(filePath: string): boolean {
  return MARKDOWN_EXTENSIONS.includes(getFileExtension(filePath));
}

function isMermaidFile(filePath: string): boolean {
  return MERMAID_EXTENSIONS.includes(getFileExtension(filePath));
}

function isImageFile(filePath: string): boolean {
  return IMAGE_EXTENSIONS.includes(getFileExtension(filePath));
}

function supportsPreview(filePath: string): boolean {
  return isMarkdownFile(filePath) || isMermaidFile(filePath) || isImageFile(filePath);
}

export function CodeViewer({ filePath, language, className }: CodeViewerProps) {
  const { getFileContent, loading, error } = useFile();
  const [content, setContent] = useState<FileContent | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(500);
  const [viewMode, setViewMode] = useState<"code" | "preview">("preview"); // Default to preview for supported files
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VirtualList>(null);

  // Check if file supports preview
  const hasPreview = supportsPreview(filePath);
  const isMarkdown = isMarkdownFile(filePath);
  const isMermaid = isMermaidFile(filePath);
  const isImage = isImageFile(filePath);

  useEffect(() => {
    // Don't load binary content for images
    if (filePath && !isImage) {
      getFileContent(filePath)
        .then(setContent)
        .catch(console.error);
    }
  }, [filePath, getFileContent, isImage]);

  // Measure container height for virtual list
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // Subtract header height (41px) and search bar if visible (41px)
        const headerHeight = 41 + (showSearch ? 41 : 0);
        setContainerHeight(Math.max(entry.contentRect.height - headerHeight, 100));
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [showSearch]);

  // Find all matches
  const matches = useMemo(() => {
    if (!content || !searchQuery.trim()) return [];
    const lines = content.content.split("\n");
    const results: { lineIndex: number; startIndex: number }[] = [];
    const query = searchQuery.toLowerCase();

    lines.forEach((line, lineIndex) => {
      let startIndex = 0;
      let foundIndex;
      while ((foundIndex = line.toLowerCase().indexOf(query, startIndex)) !== -1) {
        results.push({ lineIndex, startIndex: foundIndex });
        startIndex = foundIndex + 1;
      }
    });

    return results;
  }, [content, searchQuery]);

  // Scroll to current match (for virtual list)
  useEffect(() => {
    if (matches.length > 0) {
      const targetLine = matches[currentMatchIndex]?.lineIndex;
      if (targetLine !== undefined) {
        if (listRef.current) {
          // Virtual scrolling
          listRef.current.scrollToItem(targetLine, "center");
        } else if (lineRefs.current[targetLine]) {
          // Regular scrolling
          lineRefs.current[targetLine]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }
    }
  }, [currentMatchIndex, matches]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F: Open search
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      // Escape: Close search
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        setSearchQuery("");
      }
      // Enter: Next match
      if (e.key === "Enter" && showSearch && matches.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
        } else {
          setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch, matches.length]);

  // Reset match index when query changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  const goToNextMatch = useCallback(() => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    }
  }, [matches.length]);

  const goToPrevMatch = useCallback(() => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    }
  }, [matches.length]);

  if (loading) {
    return (
      <div className={clsx("h-full", className)}>
        <CodeViewerSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={clsx("flex items-center justify-center h-full", className)}>
        <div className="text-[var(--text-secondary)]">{error}</div>
      </div>
    );
  }

  // Image files are handled directly without loading content
  if (isImage) {
    return <ImagePreview filePath={filePath} className={className} />;
  }

  if (!content) {
    return (
      <div className={clsx("flex items-center justify-center h-full", className)}>
        <div className="text-zinc-500">Select a file to view</div>
      </div>
    );
  }

  const lang = language || content.language;
  const useVirtualScroll = content.line_count > VIRTUAL_SCROLL_THRESHOLD;

  // Check if a line has matches
  const getLineMatches = (lineIndex: number) => {
    return matches.filter((m) => m.lineIndex === lineIndex);
  };

  // Check if this is the current match line
  const isCurrentMatchLine = (lineIndex: number) => {
    return matches[currentMatchIndex]?.lineIndex === lineIndex;
  };

  return (
    <div ref={containerRef} className={clsx("h-full overflow-hidden relative flex flex-col", className)}>
      {/* Header */}
      <div className="flex-shrink-0 bg-zinc-800 border-b border-zinc-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-300">{content.path.split("/").pop()}</span>
          <span className="text-xs text-zinc-500">{lang}</span>
          {useVirtualScroll && (
            <span className="text-xs text-[var(--text-secondary)] px-1.5 py-0.5 bg-[var(--surface-2)] rounded">
              Virtual
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>{content.line_count.toLocaleString()} lines</span>
          <span>{formatBytes(content.size_bytes)}</span>

          {/* Preview toggle for supported files */}
          {hasPreview && (
            <div className="flex items-center border border-zinc-600 rounded overflow-hidden">
              <button
                onClick={() => setViewMode("code")}
                className={clsx(
                  "px-2 py-1 flex items-center gap-1 transition-colors",
                  viewMode === "code"
                    ? "bg-zinc-600 text-zinc-200"
                    : "hover:bg-zinc-700 text-zinc-400"
                )}
                title="View source code"
              >
                <Code className="w-3 h-3" />
                <span>Code</span>
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={clsx(
                  "px-2 py-1 flex items-center gap-1 transition-colors",
                  viewMode === "preview"
                    ? "bg-zinc-600 text-zinc-200"
                    : "hover:bg-zinc-700 text-zinc-400"
                )}
                title="Preview rendered"
              >
                <Eye className="w-3 h-3" />
                <span>Preview</span>
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setShowSearch(true);
              setTimeout(() => searchInputRef.current?.focus(), 0);
            }}
            className="p-1 hover:bg-zinc-700 rounded"
            title="Search (Cmd+F)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex-shrink-0 bg-[var(--surface-2)] border-b border-[var(--border-muted)] px-4 py-2 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in file..."
              className="w-full pl-3 pr-8 py-1 bg-[var(--surface-1)] border border-[var(--border-muted)] rounded text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-default)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
                </svg>
              </button>
            )}
          </div>

          {matches.length > 0 && (
            <>
              <span className="text-xs text-[var(--text-muted)] min-w-[4rem]">
                {currentMatchIndex + 1} of {matches.length}
              </span>
              <button
                onClick={goToPrevMatch}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded"
                title="Previous (Shift+Enter)"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 010-.708z" transform="rotate(180 8 8)"/>
                </svg>
              </button>
              <button
                onClick={goToNextMatch}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded"
                title="Next (Enter)"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 010-.708z"/>
                </svg>
              </button>
            </>
          )}

          {searchQuery && matches.length === 0 && (
            <span className="text-xs text-[var(--text-muted)]">No results</span>
          )}

          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery("");
            }}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded"
            title="Close (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
            </svg>
          </button>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {/* Preview mode for supported files */}
        {hasPreview && viewMode === "preview" ? (
          <div className="h-full overflow-auto bg-zinc-900">
            {isMarkdown && <MarkdownPreview content={content.content} className="h-full" />}
            {isMermaid && (
              <div className="p-6">
                <MermaidDiagram chart={content.content} />
              </div>
            )}
          </div>
        ) : (
        /* Code view */
        <Highlight theme={themes.vsDark} code={content.content} language={lang}>
          {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
            useVirtualScroll ? (
              <VirtualCodeList
                ref={listRef}
                tokens={tokens}
                style={style}
                highlightClassName={highlightClassName}
                getLineProps={getLineProps}
                getTokenProps={getTokenProps}
                getLineMatches={getLineMatches}
                isCurrentMatchLine={isCurrentMatchLine}
                searchQuery={searchQuery}
                height={containerHeight}
              />
            ) : (
              <pre
                className={clsx(highlightClassName, "text-sm p-4 overflow-auto h-full")}
                style={{ ...style, background: "transparent" }}
              >
                {tokens.map((line, i) => {
                  const lineMatches = getLineMatches(i);
                  const isCurrentLine = isCurrentMatchLine(i);

                  return (
                    <div
                      key={i}
                      ref={(el) => { lineRefs.current[i] = el; }}
                      {...getLineProps({ line })}
                      className={clsx(
                        "table-row",
                        isCurrentLine && "bg-[var(--surface-3)]"
                      )}
                    >
                      <span className="table-cell text-right pr-4 text-[var(--text-muted)] select-none w-12">
                        {i + 1}
                      </span>
                      <span className="table-cell">
                        {lineMatches.length > 0 ? (
                          <HighlightedLine
                            tokens={line}
                            getTokenProps={getTokenProps}
                            searchQuery={searchQuery}
                          />
                        ) : (
                          line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                          ))
                        )}
                      </span>
                    </div>
                  );
                })}
              </pre>
            )
          )}
        </Highlight>
        )}
      </div>
    </div>
  );
}

// Virtual scrolling list component

interface VirtualCodeListProps {
  tokens: Array<Array<{ types: string[]; content: string; empty?: boolean }>>;
  style: React.CSSProperties;
  highlightClassName: string;
  getLineProps: (props: { line: Array<{ types: string[]; content: string; empty?: boolean }> }) => { className?: string; style?: React.CSSProperties };
  getTokenProps: (props: { token: { types: string[]; content: string; empty?: boolean }; key: number }) => { className?: string; style?: React.CSSProperties; children?: string };
  getLineMatches: (lineIndex: number) => Array<{ lineIndex: number; startIndex: number }>;
  isCurrentMatchLine: (lineIndex: number) => boolean;
  searchQuery: string;
  height: number;
}

const VirtualCodeList = React.forwardRef<VirtualList, VirtualCodeListProps>(
  function VirtualCodeList(
    { tokens, style, highlightClassName, getLineProps, getTokenProps, getLineMatches, isCurrentMatchLine, searchQuery, height },
    ref
  ) {
    const Row = useCallback(({ index, style: rowStyle }: { index: number; style: React.CSSProperties }) => {
      const line = tokens[index];
      const lineMatches = getLineMatches(index);
      const isCurrentLine = isCurrentMatchLine(index);

      return (
        <div
          style={rowStyle}
          {...getLineProps({ line })}
          className={clsx(
            "flex",
            isCurrentLine && "bg-[var(--surface-3)]"
          )}
        >
          <span className="flex-shrink-0 w-12 text-right pr-4 text-[var(--text-muted)] select-none">
            {index + 1}
          </span>
          <span className="flex-1 whitespace-pre overflow-hidden text-ellipsis">
            {lineMatches.length > 0 ? (
              <HighlightedLine
                tokens={line}
                getTokenProps={getTokenProps}
                searchQuery={searchQuery}
              />
            ) : (
              line.map((token, key) => (
                <span key={key} {...getTokenProps({ token, key })} />
              ))
            )}
          </span>
        </div>
      );
    }, [tokens, getLineProps, getTokenProps, getLineMatches, isCurrentMatchLine, searchQuery]);

    return (
      <div
        className={clsx(highlightClassName, "text-sm")}
        style={{ ...style, background: "transparent" }}
      >
        <VirtualList
          ref={ref}
          height={height}
          itemCount={tokens.length}
          itemSize={LINE_HEIGHT}
          width="100%"
          className="scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
          overscanCount={20}
        >
          {Row}
        </VirtualList>
      </div>
    );
  }
);

// Component to highlight search matches within a line
function HighlightedLine({
  tokens,
  getTokenProps,
  searchQuery,
}: {
  tokens: Array<{ types: string[]; content: string; empty?: boolean }>;
  getTokenProps: (props: { token: { types: string[]; content: string; empty?: boolean }; key: number }) => { className?: string; style?: React.CSSProperties; children?: string };
  searchQuery: string;
}) {
  if (!searchQuery) {
    return (
      <>
        {tokens.map((token, key) => (
          <span key={key} {...getTokenProps({ token, key })} />
        ))}
      </>
    );
  }

  const query = searchQuery.toLowerCase();

  return (
    <>
      {tokens.map((token, key) => {
        const props = getTokenProps({ token, key });
        const content = token.content;
        const lowerContent = content.toLowerCase();

        if (!lowerContent.includes(query)) {
          return <span key={key} {...props} />;
        }

        // Split and highlight
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let foundIndex;
        let partKey = 0;

        while ((foundIndex = lowerContent.indexOf(query, lastIndex)) !== -1) {
          if (foundIndex > lastIndex) {
            parts.push(
              <span key={partKey++} {...props}>
                {content.slice(lastIndex, foundIndex)}
              </span>
            );
          }
          parts.push(
            <span
              key={partKey++}
              className="bg-[var(--surface-3)] text-[var(--text-primary)] rounded-sm"
              style={props.style}
            >
              {content.slice(foundIndex, foundIndex + query.length)}
            </span>
          );
          lastIndex = foundIndex + query.length;
        }

        if (lastIndex < content.length) {
          parts.push(
            <span key={partKey++} {...props}>
              {content.slice(lastIndex)}
            </span>
          );
        }

        return <span key={key}>{parts}</span>;
      })}
    </>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
