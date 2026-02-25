import { BookOpen, FileText, Map, Clock } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import pkg from "../../../../package.json";

import aboutMd from "@/docs/about.md?raw";
import changelogMd from "../../../../CHANGELOG.md?raw";
import roadmapMd from "@/docs/roadmap.md?raw";
import userGuideMd from "@/docs/user-guide.md?raw";
import { cn } from "@/lib/utils";
import type { BlockViewProps } from "@/types/block";

import { MarkdownPreview } from "../../MarkdownPreview";

interface DocSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  content: string;
}

const docSections: DocSection[] = [
  {
    id: "about",
    label: "About",
    icon: <BookOpen className="w-4 h-4" />,
    content: aboutMd,
  },
  {
    id: "user-guide",
    label: "User Guide",
    icon: <FileText className="w-4 h-4" />,
    content: userGuideMd,
  },
  {
    id: "roadmap",
    label: "Roadmap",
    icon: <Map className="w-4 h-4" />,
    content: roadmapMd,
  },
  {
    id: "changelog",
    label: "Changelog",
    icon: <Clock className="w-4 h-4" />,
    content: changelogMd,
  },
];

interface TocHeading {
  id: string; // unique key (slug-index)
  text: string;
  level: number; // 2 or 3
  domIndex: number; // position among all h2/h3 in the rendered DOM
}

/** Extract H2/H3 headings from markdown for ToC.
 *  For changelog, only extract H2 (version numbers) since H3 entries
 *  like "Fixed", "Changed", "Added" repeat and are useless in ToC. */
function extractHeadings(markdown: string, sectionId: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const lines = markdown.split("\n");
  const isChangelog = sectionId === "changelog";
  let domIdx = 0;

  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (match) {
      const level = match[1].length;
      if (isChangelog && level === 3) {
        domIdx++;
        continue;
      }
      const text = match[2].trim();
      const slug = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      headings.push({ id: `${slug}-${domIdx}`, text, level, domIndex: domIdx });
      domIdx++;
    }
  }
  return headings;
}

// Read pending section set by Help menu before this component mounted
function consumePendingSection(): string | undefined {
  const s = sessionStorage.getItem("docs-pending-section");
  if (s) sessionStorage.removeItem("docs-pending-section");
  return s || undefined;
}

export function DocsBlockView({}: BlockViewProps) {
  const [activeSection, setActiveSection] = useState(
    () => consumePendingSection() || "user-guide"
  );
  const [activeHeading, setActiveHeading] = useState<string>("");
  const contentRef = useRef<HTMLDivElement>(null);

  // Listen for section navigation events (when view is already mounted)
  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent).detail?.section;
      if (section) setActiveSection(section);
    };
    window.addEventListener("docs-navigate", handler);
    return () => window.removeEventListener("docs-navigate", handler);
  }, []);

  const currentDoc = docSections.find((s) => s.id === activeSection);
  const processedContent = currentDoc?.content.replace(
    /\{\{version\}\}/g,
    pkg.version
  ) || "";

  const headings = useMemo(
    () => extractHeadings(processedContent, activeSection),
    [processedContent, activeSection]
  );

  // Scroll spy: track which heading is currently in view (by DOM index)
  useEffect(() => {
    const container = contentRef.current;
    if (!container || headings.length === 0) return;

    // Build a set of domIndex values that are in the ToC
    const tocIndices = new Set(headings.map((h) => h.domIndex));

    const handleScroll = () => {
      const headingElements = container.querySelectorAll("h2, h3");
      let currentId = "";

      headingElements.forEach((el, idx) => {
        if (!tocIndices.has(idx)) return;
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (rect.top - containerRect.top <= 120) {
          const heading = headings.find((h) => h.domIndex === idx);
          if (heading) currentId = heading.id;
        }
      });
      setActiveHeading(currentId);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [headings, activeSection]);

  // Reset scroll on section change
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    setActiveHeading("");
  }, [activeSection]);

  const scrollToHeading = useCallback((headingId: string) => {
    const container = contentRef.current;
    if (!container) return;

    // Find the heading's DOM index from the ToC data
    const heading = headings.find((h) => h.id === headingId);
    if (!heading) return;

    const headingElements = container.querySelectorAll("h2, h3");
    const el = headingElements[heading.domIndex];
    if (el) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      container.scrollTo({
        top: container.scrollTop + (elRect.top - containerRect.top) - 20,
        behavior: "smooth",
      });
    }
  }, [headings]);

  const showToc = headings.length > 2;

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)]">
      {/* Horizontal tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-1)]">
        {docSections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
              activeSection === section.id
                ? "bg-[var(--surface-3)] text-[var(--text-primary)] font-medium"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
            )}
          >
            {section.icon}
            {section.label}
          </button>
        ))}
      </div>

      {/* Content + ToC */}
      <div className="flex-1 flex min-h-0">
        {/* Main content */}
        <div ref={contentRef} className="flex-1 overflow-auto">
          <div className="mx-auto py-6 max-w-3xl px-8">
            {currentDoc && (
              <MarkdownPreview
                content={processedContent}
                className="!p-0"
              />
            )}
          </div>
        </div>

        {/* Table of Contents sidebar — key forces full remount on tab switch */}
        {showToc && (
          <nav key={activeSection} className="w-52 shrink-0 border-l border-[var(--border-muted)] overflow-y-auto py-4 px-3 hidden md:block">
            <div className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3 px-2">
              On this page
            </div>
            <ul className="space-y-px">
              {headings.map((heading, i) => {
                const isH2 = heading.level === 2;
                const isActive = activeHeading === heading.id;
                const isFirstH2 = isH2 && i > 0;

                return (
                  <li key={heading.id} className={isFirstH2 ? "pt-2" : ""}>
                    <button
                      onClick={() => scrollToHeading(heading.id)}
                      className={cn(
                        "w-full text-left leading-snug rounded transition-colors truncate",
                        isH2
                          ? "text-[12px] font-medium py-1.5 px-2"
                          : "text-[11px] py-1 pl-5 pr-2",
                        isActive
                          ? isH2
                            ? "text-[var(--text-primary)] bg-[var(--surface-2)]"
                            : "text-[var(--text-secondary)] bg-[var(--surface-1)]"
                          : isH2
                            ? "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-1)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"
                      )}
                      title={heading.text}
                    >
                      {heading.text}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
