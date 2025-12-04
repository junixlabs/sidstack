/**
 * ToolBlock Component
 *
 * Full display of tool execution matching Claude Code terminal style.
 * Shows tool icon, input parameters, and collapsible output.
 */

import { memo, useState, useCallback, useMemo } from "react";

import { cn } from "@/lib/utils";
import type { Block, ToolContent } from "@/types/blocks";

import { BlockContainer } from "./BlockContainer";
import { CodeBlock } from "./CodeBlock";

export interface ToolBlockProps {
  block: Block;
  onCopy?: () => void;
}

// Tool icons and colors - using monochrome CSS variables
const TOOL_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  Read: { icon: "file", color: "text-[var(--text-secondary)]", label: "Read" },
  Write: { icon: "file-plus", color: "text-[var(--text-secondary)]", label: "Write" },
  Edit: { icon: "edit", color: "text-[var(--text-secondary)]", label: "Edit" },
  MultiEdit: { icon: "files", color: "text-[var(--text-secondary)]", label: "MultiEdit" },
  Bash: { icon: "terminal", color: "text-[var(--text-secondary)]", label: "Bash" },
  Glob: { icon: "search", color: "text-[var(--text-secondary)]", label: "Glob" },
  Grep: { icon: "search", color: "text-[var(--text-secondary)]", label: "Grep" },
  LS: { icon: "folder", color: "text-[var(--text-secondary)]", label: "LS" },
  Task: { icon: "layers", color: "text-[var(--text-secondary)]", label: "Task" },
  WebFetch: { icon: "globe", color: "text-[var(--text-secondary)]", label: "WebFetch" },
  WebSearch: { icon: "globe", color: "text-[var(--text-secondary)]", label: "WebSearch" },
  TodoWrite: { icon: "list", color: "text-[var(--text-secondary)]", label: "TodoWrite" },
  AskUserQuestion: { icon: "message", color: "text-[var(--text-secondary)]", label: "Ask" },
  LSP: { icon: "code", color: "text-[var(--text-secondary)]", label: "LSP" },
  NotebookEdit: { icon: "book", color: "text-[var(--text-secondary)]", label: "Notebook" },
};

// SVG Icons
const Icons: Record<string, React.FC<{ className?: string }>> = {
  file: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  "file-plus": ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  edit: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
  files: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  ),
  terminal: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  search: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  folder: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
  layers: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
    </svg>
  ),
  globe: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  list: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  message: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  ),
  code: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  ),
  book: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  default: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  ),
};

// Chevron icon for expand/collapse
const ChevronIcon = ({ expanded, className }: { expanded: boolean; className?: string }) => (
  <svg
    className={cn("w-4 h-4 transition-transform duration-200", expanded && "rotate-90", className)}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

// Format tool input for display
function formatToolInput(toolName: string, input: unknown): { primary: string; secondary?: string; details?: Record<string, unknown> } {
  const inputObj = input as Record<string, unknown>;

  switch (toolName) {
    case "Read":
      return {
        primary: String(inputObj?.file_path || "").replace(/^\/Users\/[^/]+\//, "~/"),
        secondary: inputObj?.limit ? `lines ${inputObj.offset || 0}-${Number(inputObj.offset || 0) + Number(inputObj.limit)}` : undefined,
      };

    case "Write":
      return {
        primary: String(inputObj?.file_path || "").replace(/^\/Users\/[^/]+\//, "~/"),
        secondary: inputObj?.content ? `${String(inputObj.content).split("\n").length} lines` : undefined,
      };

    case "Edit":
      return {
        primary: String(inputObj?.file_path || "").replace(/^\/Users\/[^/]+\//, "~/"),
        secondary: inputObj?.old_string ? `replacing "${String(inputObj.old_string).substring(0, 30)}..."` : undefined,
      };

    case "Bash":
      return {
        primary: String(inputObj?.command || "").substring(0, 100),
        secondary: inputObj?.description ? String(inputObj.description) : undefined,
      };

    case "Glob":
      return {
        primary: String(inputObj?.pattern || ""),
        secondary: inputObj?.path ? `in ${String(inputObj.path).replace(/^\/Users\/[^/]+\//, "~/")}` : undefined,
      };

    case "Grep":
      return {
        primary: String(inputObj?.pattern || ""),
        secondary: inputObj?.path ? `in ${String(inputObj.path).replace(/^\/Users\/[^/]+\//, "~/")}` : undefined,
        details: { glob: inputObj?.glob, type: inputObj?.type },
      };

    case "Task":
      return {
        primary: String(inputObj?.description || inputObj?.prompt || "").substring(0, 80),
        secondary: inputObj?.subagent_type ? `agent: ${inputObj.subagent_type}` : undefined,
      };

    case "WebFetch":
    case "WebSearch":
      return {
        primary: String(inputObj?.url || inputObj?.query || "").substring(0, 80),
        secondary: inputObj?.prompt ? String(inputObj.prompt).substring(0, 50) : undefined,
      };

    case "TodoWrite": {
      const todos = inputObj?.todos as Array<{ content: string; status: string }>;
      return {
        primary: todos ? `${todos.length} items` : "updating todos",
        secondary: todos?.[0]?.content?.substring(0, 50),
      };
    }

    default: {
      // Generic handling - try to extract meaningful info
      const keys = Object.keys(inputObj || {});
      const primaryKey = keys.find(k => ["file_path", "path", "command", "query", "pattern", "prompt"].includes(k));
      return {
        primary: primaryKey ? String(inputObj[primaryKey]).substring(0, 80) : JSON.stringify(input).substring(0, 80),
      };
    }
  }
}

// Detect language for output syntax highlighting
function detectOutputLanguage(toolName: string, output: string): string {
  if (toolName === "Read") {
    // Try to detect from file content
    if (output.includes("import ") || output.includes("export ")) return "typescript";
    if (output.includes("fn ") || output.includes("impl ")) return "rust";
    if (output.includes("def ") || output.includes("class ")) return "python";
    return "plaintext";
  }
  if (toolName === "Bash") return "bash";
  if (toolName === "Glob" || toolName === "Grep") return "plaintext";
  if (output.trim().startsWith("{") || output.trim().startsWith("[")) return "json";
  return "plaintext";
}

export const ToolBlock = memo(function ToolBlock({ block }: ToolBlockProps) {
  const content = block.content.data as ToolContent;
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullInput, setShowFullInput] = useState(false);

  const isStreaming = block.status === "streaming";
  const hasError = content.isError;
  const hasOutput = !!content.toolOutput;

  // Get tool config
  const toolConfig = TOOL_CONFIG[content.toolName] || {
    icon: "default",
    color: "text-[var(--text-muted)]",
    label: content.toolName,
  };

  // Get icon component
  const IconComponent = Icons[toolConfig.icon] || Icons.default;

  // Format input
  const formattedInput = useMemo(
    () => formatToolInput(content.toolName, content.toolInput),
    [content.toolName, content.toolInput]
  );

  // Toggle expand
  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Detect output language
  const outputLanguage = useMemo(
    () => (hasOutput ? detectOutputLanguage(content.toolName, content.toolOutput!) : "plaintext"),
    [content.toolName, content.toolOutput, hasOutput]
  );

  // Truncate output for display
  const truncatedOutput = useMemo(() => {
    if (!content.toolOutput) return "";
    const lines = content.toolOutput.split("\n");
    if (lines.length > 50) {
      return lines.slice(0, 50).join("\n") + `\n\n... (${lines.length - 50} more lines)`;
    }
    return content.toolOutput;
  }, [content.toolOutput]);

  return (
    <BlockContainer block={block}>
      <div className="space-y-1">
        {/* Header row - clickable to expand */}
        <button
          onClick={toggleExpand}
          className={cn(
            "flex items-center gap-2 w-full text-left group",
            "hover:bg-[var(--surface-2)] rounded px-1 -mx-1 py-0.5 transition-colors"
          )}
        >
          {/* Expand chevron */}
          <ChevronIcon expanded={isExpanded} className="text-[var(--text-muted)] flex-shrink-0" />

          {/* Tool icon */}
          <IconComponent className={cn("w-4 h-4 flex-shrink-0", toolConfig.color)} />

          {/* Tool name */}
          <span className={cn("font-medium text-sm", toolConfig.color)}>{toolConfig.label}</span>

          {/* Primary info */}
          <span className="text-sm text-[var(--text-secondary)] truncate flex-1 font-mono">
            {formattedInput.primary}
          </span>

          {/* Status indicator */}
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-pulse" />
              running
            </span>
          )}
          {hasError && (
            <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)]" />
              error
            </span>
          )}
          {!isStreaming && !hasError && hasOutput && (
            <span className="text-xs text-[var(--text-muted)]">
              {content.toolOutput!.split("\n").length} lines
            </span>
          )}
        </button>

        {/* Secondary info (always visible) */}
        {formattedInput.secondary && (
          <div className="text-xs text-[var(--text-muted)] pl-7">
            {formattedInput.secondary}
          </div>
        )}

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-2 pl-7 space-y-2">
            {/* Full input (for complex tools) */}
            {content.toolInput !== null && typeof content.toolInput === "object" && (
              <div>
                <button
                  onClick={() => setShowFullInput((prev) => !prev)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1"
                >
                  <ChevronIcon expanded={showFullInput} className="w-3 h-3" />
                  Input
                </button>
                {showFullInput && (
                  <div className="mt-1">
                    <CodeBlock
                      code={JSON.stringify(content.toolInput, null, 2)}
                      language="json"
                      showLineNumbers={false}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Output */}
            {hasOutput && (
              <div>
                <div className="text-xs text-[var(--text-muted)] mb-1">Output</div>
                <div className={cn(
                  "rounded-lg overflow-hidden border",
                  hasError ? "border-[var(--border-default)]" : "border-[var(--border-default)]"
                )}>
                  <CodeBlock
                    code={truncatedOutput}
                    language={outputLanguage}
                    showLineNumbers={content.toolName === "Read"}
                    className="!my-0 !border-0"
                  />
                </div>
              </div>
            )}

            {/* Streaming placeholder */}
            {isStreaming && !hasOutput && (
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span>Executing...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </BlockContainer>
  );
});

export default ToolBlock;
