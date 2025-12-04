/**
 * CodeBlock Component
 *
 * Syntax-highlighted code block using prism-react-renderer.
 * Features: language detection, copy button, line numbers.
 */

import { Highlight, themes } from "prism-react-renderer";
import { memo, useState, useCallback } from "react";

import { cn } from "@/lib/utils";

export interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}

// Language aliases for common variations
const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  rs: "rust",
  go: "go",
  dockerfile: "docker",
};

// Simple language detection based on code patterns
function detectLanguage(code: string): string {
  const trimmed = code.trim();

  // Rust patterns
  if (/^(use |mod |fn |impl |struct |enum |pub |let mut |#\[)/.test(trimmed)) {
    return "rust";
  }

  // TypeScript/JavaScript patterns
  if (/^(import |export |const |let |var |function |class |interface |type )/.test(trimmed)) {
    if (/: \w+[\s<[]|interface |type \w+ =/.test(trimmed)) {
      return "typescript";
    }
    return "javascript";
  }

  // Python patterns
  if (/^(def |class |import |from |if __name__|@\w+)/.test(trimmed)) {
    return "python";
  }

  // Go patterns
  if (/^(package |func |type |import \(|var |const \()/.test(trimmed)) {
    return "go";
  }

  // Bash/Shell patterns
  if (/^(#!\/|export |alias |if \[|for |while |echo |cd |ls |npm |pnpm |yarn |cargo |git )/.test(trimmed)) {
    return "bash";
  }

  // JSON patterns
  if (/^\s*[[{]/.test(trimmed) && /[\]}]\s*$/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON
    }
  }

  // YAML patterns
  if (/^[\w-]+:\s/.test(trimmed) && !trimmed.includes("{")) {
    return "yaml";
  }

  // SQL patterns
  if (/^(SELECT |INSERT |UPDATE |DELETE |CREATE |ALTER |DROP |FROM )/i.test(trimmed)) {
    return "sql";
  }

  // HTML patterns
  if (/^<(!DOCTYPE|html|head|body|div|span|p|a|script)/i.test(trimmed)) {
    return "html";
  }

  // CSS patterns
  if (/^(\.|#|@media|@import|:root|\*|body|html)\s*{/.test(trimmed)) {
    return "css";
  }

  // Markdown patterns
  if (/^(#{1,6} |[-*] |\d+\. |\[.+\]\(.+\)|```)/m.test(trimmed)) {
    return "markdown";
  }

  return "plaintext";
}

// Normalize language name
function normalizeLanguage(lang?: string): string {
  if (!lang) return "plaintext";
  const lower = lang.toLowerCase().trim();
  return LANGUAGE_ALIASES[lower] || lower;
}

// Custom dark theme matching our terminal aesthetic
const customTheme = {
  ...themes.vsDark,
  plain: {
    color: "var(--text-secondary)",
    backgroundColor: "transparent",
  },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: { color: "var(--text-muted)", fontStyle: "italic" as const },
    },
    {
      types: ["namespace"],
      style: { opacity: 0.7 },
    },
    {
      types: ["string", "attr-value"],
      style: { color: "#a5d6a7" }, // Green
    },
    {
      types: ["punctuation", "operator"],
      style: { color: "var(--text-secondary)" },
    },
    {
      types: ["entity", "url", "symbol", "number", "boolean", "variable", "constant", "property", "regex", "inserted"],
      style: { color: "#ffcc80" }, // Orange
    },
    {
      types: ["atrule", "keyword", "attr-name", "selector"],
      style: { color: "#ce93d8" }, // Purple
    },
    {
      types: ["function", "deleted", "tag"],
      style: { color: "#81d4fa" }, // Blue
    },
    {
      types: ["function-variable"],
      style: { color: "#81d4fa" },
    },
    {
      types: ["tag", "selector", "keyword"],
      style: { color: "#f48fb1" }, // Pink
    },
    {
      types: ["builtin", "class-name"],
      style: { color: "#80cbc4" }, // Teal
    },
  ],
};

export const CodeBlock = memo(function CodeBlock({
  code,
  language,
  showLineNumbers = true,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // Normalize and detect language
  const normalizedLang = normalizeLanguage(language);
  const detectedLang = normalizedLang === "plaintext" ? detectLanguage(code) : normalizedLang;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const lineCount = code.split("\n").length;
  const showNumbers = showLineNumbers && lineCount > 1;

  return (
    <div className={cn("my-2 rounded-lg overflow-hidden border border-[var(--border-default)]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--surface-3)] border-b border-[var(--border-default)]">
        <span className="text-[11px] text-[var(--text-muted)] font-mono">
          {detectedLang}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors",
            copied
              ? "bg-[var(--surface-3)] text-[var(--text-secondary)]"
              : "hover:bg-[var(--surface-4)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          )}
          title="Copy code"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <Highlight
        theme={customTheme}
        code={code.trim()}
        language={detectedLang as any}
      >
        {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(highlightClassName, "p-3 overflow-x-auto bg-[var(--surface-1)] m-0")}
            style={{ ...style, backgroundColor: "transparent" }}
          >
            <code className="text-[var(--text-sm)] font-mono">
              {tokens.map((line, lineIndex) => {
                const lineProps = getLineProps({ line });
                return (
                  <div
                    key={lineIndex}
                    {...lineProps}
                    className={cn(lineProps.className, "table-row")}
                  >
                    {showNumbers && (
                      <span className="table-cell pr-4 text-right text-[var(--text-muted)] select-none opacity-50 text-[11px]">
                        {lineIndex + 1}
                      </span>
                    )}
                    <span className="table-cell">
                      {line.map((token, tokenIndex) => (
                        <span key={tokenIndex} {...getTokenProps({ token })} />
                      ))}
                    </span>
                  </div>
                );
              })}
            </code>
          </pre>
        )}
      </Highlight>
    </div>
  );
});

export default CodeBlock;
