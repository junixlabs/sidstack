import { BookOpen, FileText, Map, Clock, X } from "lucide-react";
import pkg from "../../package.json";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import aboutMd from "@/docs/about.md?raw";
import changelogMd from "../../CHANGELOG.md?raw";
import roadmapMd from "@/docs/roadmap.md?raw";
import userGuideMd from "@/docs/user-guide.md?raw";
import { cn } from "@/lib/utils";

import { MarkdownPreview } from "./MarkdownPreview";

interface DocsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

export function DocsDialog({ open, onOpenChange }: DocsDialogProps) {
  const [activeSection, setActiveSection] = useState("about");

  const currentDoc = docSections.find((s) => s.id === activeSection);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-w-4xl h-[80vh] p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-muted)]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="text-base font-medium text-[var(--text-primary)]">
              Documentation
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0">
          {/* Sidebar */}
          <nav className="w-48 flex-none border-r border-[var(--border-muted)] py-2">
            {docSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors",
                  activeSection === section.id
                    ? "bg-[var(--surface-2)] text-[var(--text-primary)] border-l-2 border-[var(--accent-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]"
                )}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6 bg-[var(--surface-0)]">
            {currentDoc && (
              <MarkdownPreview content={currentDoc.content.replace(/\{\{version\}\}/g, pkg.version)} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--border-muted)] text-xs text-[var(--text-muted)]">
          SidStack v{pkg.version} | Press Esc to close
        </div>
      </DialogContent>
    </Dialog>
  );
}
