/**
 * OutputBlock Component
 *
 * Displays Claude's text response with markdown rendering
 * and syntax highlighting for code blocks.
 */

import { memo, useMemo } from "react";

import { cn } from "@/lib/utils";
import type { Block, OutputContent } from "@/types/blocks";

import { BlockContainer } from "./BlockContainer";
import { CodeBlock } from "./CodeBlock";

export interface OutputBlockProps {
  block: Block;
  onCopy?: () => void;
}

// Claude icon (sparkle)
const ClaudeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
    />
  </svg>
);

// Simple markdown-like rendering (no external dependencies)
function renderMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = text.split("\n");
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = "";
  let blockKey = 0;

  const flushCodeBlock = () => {
    if (codeBlockContent.length > 0) {
      elements.push(
        <CodeBlock
          key={`code-${blockKey++}`}
          language={codeBlockLang}
          code={codeBlockContent.join("\n")}
        />
      );
      codeBlockContent = [];
      codeBlockLang = "";
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block start/end
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={`h3-${blockKey++}`} className="text-[var(--text-lg)] font-semibold text-[var(--text-primary)] mt-4 mb-2">
          {line.slice(4)}
        </h4>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={`h2-${blockKey++}`} className="text-[var(--text-xl)] font-semibold text-[var(--text-primary)] mt-4 mb-2">
          {line.slice(3)}
        </h3>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={`h1-${blockKey++}`} className="text-[var(--text-2xl)] font-bold text-[var(--text-primary)] mt-4 mb-2">
          {line.slice(2)}
        </h2>
      );
      continue;
    }

    // List items
    if (line.match(/^[-*]\s/)) {
      elements.push(
        <li key={`li-${blockKey++}`} className="text-[var(--text-primary)] ml-4">
          {renderInlineFormatting(line.slice(2))}
        </li>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <li key={`oli-${blockKey++}`} className="text-[var(--text-primary)] ml-4 list-decimal">
            {renderInlineFormatting(match[2])}
          </li>
        );
        continue;
      }
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={`br-${blockKey++}`} className="h-2" />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${blockKey++}`} className="text-[var(--text-primary)] leading-relaxed">
        {renderInlineFormatting(line)}
      </p>
    );
  }

  // Flush any remaining code block
  flushCodeBlock();

  return elements;
}

// Render inline formatting (bold, italic, code)
function renderInlineFormatting(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      elements.push(
        <code key={`ic-${key++}`} className="px-1 py-0.5 rounded bg-[var(--surface-3)] text-[var(--accent-blue)] font-mono text-[0.9em]">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      elements.push(
        <strong key={`b-${key++}`} className="font-semibold">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      elements.push(
        <em key={`i-${key++}`}>
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Plain text until next special character
    const plainMatch = remaining.match(/^[^`*]+/);
    if (plainMatch) {
      elements.push(<span key={`t-${key++}`}>{plainMatch[0]}</span>);
      remaining = remaining.slice(plainMatch[0].length);
      continue;
    }

    // Single special character
    elements.push(<span key={`c-${key++}`}>{remaining[0]}</span>);
    remaining = remaining.slice(1);
  }

  return elements;
}

export const OutputBlock = memo(function OutputBlock({ block }: OutputBlockProps) {
  const content = block.content.data as OutputContent;
  const isStreaming = block.status === "streaming";

  const renderedContent = useMemo(() => {
    return renderMarkdown(content.text);
  }, [content.text]);

  // Format metadata
  const metadata = useMemo(() => {
    const parts: string[] = [];
    if (content.durationMs) {
      const seconds = (content.durationMs / 1000).toFixed(1);
      parts.push(`${seconds}s`);
    }
    if (content.costUsd) {
      parts.push(`$${content.costUsd.toFixed(4)}`);
    }
    if (content.numTurns && content.numTurns > 1) {
      parts.push(`${content.numTurns} turns`);
    }
    return parts.join(" · ");
  }, [content.durationMs, content.costUsd, content.numTurns]);

  return (
    <BlockContainer block={block}>
      <div className="flex gap-3">
        {/* Claude icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className={cn(
            "w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center ring-1 ring-[var(--border-default)]",
            isStreaming && "animate-pulse"
          )}>
            <ClaudeIcon className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[10px] text-[var(--text-muted)] mb-1 font-medium uppercase tracking-wide flex items-center gap-2">
            <span>Claude</span>
            {isStreaming && (
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: "100ms" }} />
                <span className="w-1 h-1 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: "200ms" }} />
              </span>
            )}
          </div>
          <div className="text-sm leading-relaxed">
            {renderedContent}
          </div>

          {/* Metadata */}
          {metadata && !isStreaming && (
            <div className="mt-3 pt-2 border-t border-[var(--border-muted)] text-xs text-[var(--text-muted)] flex items-center gap-3">
              <span>{metadata}</span>
            </div>
          )}
        </div>
      </div>
    </BlockContainer>
  );
});

export default OutputBlock;
