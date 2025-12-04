import clsx from "clsx";
import { Copy, Check, ExternalLink } from "lucide-react";
import { useState, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { MermaidDiagram } from "./MermaidDiagram";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  /** Base path for resolving relative links */
  basePath?: string;
  /** Callback when a local file link is clicked */
  onLinkClick?: (path: string) => void;
}

/**
 * Markdown preview with GitHub-flavored markdown support
 * - Renders Mermaid code blocks as diagrams
 * - Syntax highlighting for code blocks
 * - Copy button for code blocks
 * - Better typography and spacing
 * - HUD-style dark theme
 */
// Memoized to prevent re-parsing markdown on parent re-renders
export const MarkdownPreview = memo(function MarkdownPreview({ content, className = "", basePath, onLinkClick }: MarkdownPreviewProps) {

  // Check if a href is a local file link (relative path or file://)
  const isLocalLink = (href: string): boolean => {
    if (!href) return false;
    // Skip external URLs
    if (href.startsWith("http://") || href.startsWith("https://")) return false;
    // Skip anchors
    if (href.startsWith("#")) return false;
    // Skip mailto, tel, etc.
    if (href.includes(":") && !href.startsWith("file://")) return false;
    return true;
  };

  // Resolve relative path to absolute path
  const resolvePath = (href: string): string => {
    if (href.startsWith("file://")) {
      return href.replace("file://", "");
    }
    if (href.startsWith("/")) {
      return href;
    }
    if (basePath) {
      // Get directory of current file
      const baseDir = basePath.endsWith("/") ? basePath : basePath.substring(0, basePath.lastIndexOf("/") + 1);
      // Simple path resolution (handle ../ and ./)
      const parts = (baseDir + href).split("/");
      const resolved: string[] = [];
      for (const part of parts) {
        if (part === "..") {
          resolved.pop();
        } else if (part !== "." && part !== "") {
          resolved.push(part);
        }
      }
      return "/" + resolved.join("/");
    }
    return href;
  };

  return (
    <div
      className={clsx(
        // Base prose styles with HUD theme
        "prose prose-invert prose-sm max-w-none",
        // Headings - Clear hierarchy
        "prose-headings:text-[var(--text-primary)] prose-headings:font-semibold prose-headings:border-b prose-headings:border-[var(--border-muted)] prose-headings:pb-2 prose-headings:mb-4",
        "prose-h1:text-xl prose-h1:border-[var(--border-default)]",
        "prose-h2:text-lg prose-h2:text-[var(--text-primary)] prose-h2:mt-8 prose-h2:first:mt-0",
        "prose-h3:text-base prose-h3:text-[var(--text-secondary)] prose-h3:border-none prose-h3:pb-0",
        "prose-h4:text-sm prose-h4:text-[var(--text-secondary)] prose-h4:border-none prose-h4:pb-0 prose-h4:uppercase prose-h4:tracking-wide",
        // Paragraphs
        "prose-p:text-[var(--text-secondary)] prose-p:leading-relaxed prose-p:mb-4",
        // Links
        "prose-a:text-[var(--text-secondary)] prose-a:no-underline hover:prose-a:text-[var(--text-primary)] hover:prose-a:underline",
        // Strong/Bold
        "prose-strong:text-[var(--text-primary)] prose-strong:font-semibold",
        // Inline code
        "prose-code:text-[var(--text-secondary)] prose-code:bg-[var(--surface-2)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
        // Pre/Code blocks - handled by custom component
        "prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-none",
        // Blockquotes
        "prose-blockquote:border-l-[var(--border-default)] prose-blockquote:border-l-2 prose-blockquote:bg-[var(--surface-2)] prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:text-[var(--text-secondary)] prose-blockquote:italic",
        // Lists
        "prose-ul:text-[var(--text-secondary)] prose-ol:text-[var(--text-secondary)]",
        "prose-li:marker:text-[var(--text-muted)] prose-li:mb-1",
        // Horizontal rule
        "prose-hr:border-[var(--border-muted)] prose-hr:my-8",
        // Tables
        "prose-table:text-[var(--text-secondary)]",
        "prose-th:text-[var(--text-primary)] prose-th:border-[var(--border-muted)] prose-th:bg-[var(--surface-2)] prose-th:px-3 prose-th:py-2",
        "prose-td:border-[var(--border-muted)] prose-td:px-3 prose-td:py-2",
        // Container padding
        "p-6 overflow-auto",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom code block handler
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const codeContent = String(children).replace(/\n$/, "");
            const isInline = !match && !codeContent.includes("\n");

            // Inline code
            if (isInline) {
              return (
                <code
                  className="text-[var(--text-secondary)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Mermaid diagrams
            if (language === "mermaid") {
              return <MermaidDiagram chart={codeContent} />;
            }

            // Code blocks with copy button
            return (
              <CodeBlock language={language} code={codeContent} />
            );
          },
          // Better table styling
          table({ children }) {
            return (
              <div className="overflow-x-auto rounded-lg border border-[var(--border-muted)] my-4">
                <table className="min-w-full">{children}</table>
              </div>
            );
          },
          // Better image handling
          img({ src, alt }) {
            return (
              <img
                src={src}
                alt={alt || ""}
                className="max-w-full h-auto rounded-lg border border-[var(--border-muted)]"
                loading="lazy"
              />
            );
          },
          // Handle links with local file navigation
          a({ href, children }) {
            if (href && isLocalLink(href) && onLinkClick) {
              const resolvedPath = resolvePath(href);
              return (
                <a
                  href={href}
                  onClick={(e) => {
                    e.preventDefault();
                    onLinkClick(resolvedPath);
                  }}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline cursor-pointer"
                >
                  {children}
                </a>
              );
            }
            // External links open in new tab
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline"
              >
                {children}
                <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            );
          },
          // Section headings with visual markers
          h2({ children }) {
            return (
              <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)] border-b border-[var(--border-muted)] pb-2 mt-8 first:mt-0 mb-4">
                <span className="w-1 h-5 bg-[var(--surface-3)] rounded-full" />
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-base font-semibold text-[var(--text-secondary)] mt-6 mb-3">
                {children}
              </h3>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

// =============================================================================
// Code Block Component with Copy Button
// =============================================================================

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [code]);

  // Simple syntax highlighting for common patterns
  const highlightCode = (code: string, lang: string): React.ReactNode => {
    if (!lang) {
      return <span className="text-[var(--text-primary)]">{code}</span>;
    }

    // Basic highlighting patterns
    const lines = code.split("\n");
    return lines.map((line, i) => (
      <div key={i} className="table-row">
        <span className="table-cell pr-4 text-right text-[var(--text-muted)] select-none text-xs">
          {i + 1}
        </span>
        <span className="table-cell">
          <HighlightedLine line={line} language={lang} />
        </span>
      </div>
    ));
  };

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden border border-[var(--border-muted)] bg-[var(--surface-0)]">
      {/* Header with language badge */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border-muted)]">
        {language && (
          <span className="text-xs text-[var(--text-muted)] font-mono uppercase">{language}</span>
        )}
        <button
          onClick={handleCopy}
          className={clsx(
            "flex items-center gap-1 px-2 py-1 rounded text-xs",
            "transition-all",
            copied
              ? "text-[var(--text-secondary)] bg-[var(--surface-3)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
          )}
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <pre className="p-4 overflow-x-auto text-sm font-mono">
        <code className="table">{highlightCode(code, language)}</code>
      </pre>
    </div>
  );
}

// =============================================================================
// Simple Syntax Highlighting
// =============================================================================

function HighlightedLine({ line, language }: { line: string; language: string }) {
  // Keywords for different languages
  const keywords: Record<string, string[]> = {
    typescript: ["const", "let", "var", "function", "class", "interface", "type", "import", "export", "from", "return", "if", "else", "for", "while", "async", "await", "new", "this", "extends", "implements"],
    javascript: ["const", "let", "var", "function", "class", "import", "export", "from", "return", "if", "else", "for", "while", "async", "await", "new", "this"],
    rust: ["fn", "let", "mut", "const", "struct", "enum", "impl", "pub", "use", "mod", "return", "if", "else", "for", "while", "match", "self", "Self", "async", "await"],
    python: ["def", "class", "import", "from", "return", "if", "elif", "else", "for", "while", "with", "as", "try", "except", "finally", "async", "await", "self"],
    go: ["func", "var", "const", "type", "struct", "interface", "import", "package", "return", "if", "else", "for", "range", "switch", "case", "defer", "go"],
    bash: ["if", "then", "else", "fi", "for", "while", "do", "done", "case", "esac", "function", "return", "export", "local"],
    sql: ["SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "ON", "AND", "OR", "ORDER", "BY", "GROUP", "HAVING", "INSERT", "UPDATE", "DELETE", "CREATE", "TABLE", "INDEX", "ALTER", "DROP"],
  };

  const langKeywords = keywords[language] || keywords.typescript || [];

  // Simple tokenization
  const tokens: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  while (remaining.length > 0) {
    // Comments (// or #)
    const commentMatch = remaining.match(/^(\/\/.*|#.*)$/);
    if (commentMatch) {
      tokens.push(
        <span key={key++} className="text-[var(--text-muted)] italic">
          {commentMatch[1]}
        </span>
      );
      break;
    }

    // Strings
    const stringMatch = remaining.match(/^(["'`])([^"'`]*)\1/);
    if (stringMatch) {
      tokens.push(
        <span key={key++} className="text-[var(--text-secondary)]">
          {stringMatch[0]}
        </span>
      );
      remaining = remaining.slice(stringMatch[0].length);
      continue;
    }

    // Numbers
    const numberMatch = remaining.match(/^\b(\d+\.?\d*)\b/);
    if (numberMatch) {
      tokens.push(
        <span key={key++} className="text-[var(--text-secondary)]">
          {numberMatch[1]}
        </span>
      );
      remaining = remaining.slice(numberMatch[1].length);
      continue;
    }

    // Keywords
    const keywordMatch = remaining.match(/^\b(\w+)\b/);
    if (keywordMatch) {
      const word = keywordMatch[1];
      if (langKeywords.includes(word)) {
        tokens.push(
          <span key={key++} className="text-[var(--text-secondary)] font-medium">
            {word}
          </span>
        );
      } else if (word[0] === word[0].toUpperCase() && /[a-zA-Z]/.test(word[0])) {
        // Type/Class names (PascalCase)
        tokens.push(
          <span key={key++} className="text-[var(--text-secondary)]">
            {word}
          </span>
        );
      } else {
        tokens.push(
          <span key={key++} className="text-[var(--text-primary)]">
            {word}
          </span>
        );
      }
      remaining = remaining.slice(word.length);
      continue;
    }

    // Operators and punctuation
    const opMatch = remaining.match(/^([(){}[\]<>.,;:=+\-*/%&|!?@#$^~`\\]+)/);
    if (opMatch) {
      tokens.push(
        <span key={key++} className="text-[var(--text-muted)]">
          {opMatch[1]}
        </span>
      );
      remaining = remaining.slice(opMatch[1].length);
      continue;
    }

    // Whitespace
    const wsMatch = remaining.match(/^(\s+)/);
    if (wsMatch) {
      tokens.push(<span key={key++}>{wsMatch[1]}</span>);
      remaining = remaining.slice(wsMatch[1].length);
      continue;
    }

    // Single character fallback
    tokens.push(
      <span key={key++} className="text-[var(--text-primary)]">
        {remaining[0]}
      </span>
    );
    remaining = remaining.slice(1);
  }

  return <>{tokens}</>;
}

export default MarkdownPreview;
