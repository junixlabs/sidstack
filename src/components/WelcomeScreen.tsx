import { FolderOpen, BookOpen, Map, Clock, Sparkles, Network, FlaskConical, ArrowRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
// Import bundled changelog for "What's New" section
import changelogMd from "../../CHANGELOG.md?raw";
import { cn } from "@/lib/utils";

import { Logo } from "./Logo";

interface WelcomeScreenProps {
  onOpenProject: () => void;
  onShowDocs: () => void;
}

// Parse changelog to extract the latest version info
function parseLatestChanges(changelog: string): { version: string; changes: string[] } {
  const lines = changelog.split("\n");
  let version = "0.0.0";
  const changes: string[] = [];
  let inLatestVersion = false;
  let changeCount = 0;

  for (const line of lines) {
    // Find version header like "## [0.4.0] - 2026-02-02"
    const versionMatch = line.match(/^## \[([^\]]+)\]/);
    if (versionMatch) {
      if (inLatestVersion) break; // Stop at next version
      version = versionMatch[1];
      inLatestVersion = true;
      continue;
    }

    if (!inLatestVersion || changeCount >= 5) continue;

    // Collect top-level bullet points: "- **Bold:** description" format
    if (line.startsWith("- ")) {
      // Extract "**Title:** description" → "Title: description"
      const boldMatch = line.match(/^- \*\*([^*]+)\*\*\s*(.*)/);
      if (boldMatch) {
        const title = boldMatch[1].replace(/:$/, ""); // Remove trailing colon from title
        const desc = boldMatch[2].replace(/^:\s*/, "").trim(); // Remove leading colon from desc
        changes.push(desc ? `${title} - ${desc}` : title);
        changeCount++;
      } else {
        // Plain bullet: "- Some text"
        const cleanLine = line.replace(/^- /, "").trim();
        if (cleanLine) {
          changes.push(cleanLine);
          changeCount++;
        }
      }
    }
  }

  return { version, changes };
}

const features = [
  {
    icon: <Network className="w-5 h-5" />,
    title: "Project Hub",
    description: "Capability tree and entity connections",
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: "Knowledge Browser",
    description: "Browse and search project documentation",
  },
  {
    icon: <FlaskConical className="w-5 h-5" />,
    title: "Training Room",
    description: "Lessons, skills, and rules from incidents",
  },
];

export function WelcomeScreen({ onOpenProject, onShowDocs }: WelcomeScreenProps) {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const { version, changes } = parseLatestChanges(changelogMd);

  return (
    <div className="h-full w-full flex items-center justify-center bg-[var(--surface-0)]">
      <div className="max-w-2xl w-full px-8 py-12">
        {/* Logo and Title */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <Logo size="xl" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Welcome to SidStack
          </h1>
          <p className="text-[var(--text-secondary)] text-lg">
            AI-Powered Project Intelligence Platform
          </p>
        </div>

        {/* How It Works */}
        <div className="mb-10">
          <div className="flex items-center justify-center gap-3 text-sm">
            <div className="text-center px-4">
              <div className="text-[var(--text-primary)] font-medium">Your Project</div>
              <div className="text-xs text-[var(--text-muted)]">Knowledge, tasks, rules</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            <div className="text-center px-4">
              <div className="text-[var(--accent-primary)] font-medium">SidStack MCP</div>
              <div className="text-xs text-[var(--text-muted)]">20 tools for Claude Code</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            <div className="text-center px-4">
              <div className="text-[var(--text-primary)] font-medium">Claude Code</div>
              <div className="text-xs text-[var(--text-muted)]">Works with full context</div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {features.map((feature, index) => (
            <div
              key={index}
              className={cn(
                "p-4 rounded-lg border transition-all duration-200 cursor-default",
                hoveredFeature === index
                  ? "bg-[var(--surface-2)] border-[var(--border-emphasis)]"
                  : "bg-[var(--surface-1)] border-[var(--border-default)]"
              )}
              onMouseEnter={() => setHoveredFeature(index)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              <div className="text-[var(--accent-primary)] mb-2">{feature.icon}</div>
              <h3 className="font-medium text-[var(--text-primary)] mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mb-10">
          <Button
            size="lg"
            onClick={onOpenProject}
            className="gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            Open Project
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onShowDocs}
            className="gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Documentation
          </Button>
        </div>

        {/* What's New Section */}
        <div className="bg-[var(--surface-1)] rounded-lg border border-[var(--border-default)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
            <h2 className="font-medium text-[var(--text-primary)]">
              What's New in v{version}
            </h2>
          </div>
          <ul className="space-y-2">
            {changes.map((change, index) => (
              <li
                key={index}
                className="text-sm text-[var(--text-secondary)] flex items-center gap-2"
              >
                <span className="text-[var(--accent-primary)]">•</span>
                <span>{change}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={onShowDocs}
            className="mt-4 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1"
          >
            <Map className="w-3 h-3" />
            View changelog
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
            <Clock className="w-3 h-3" />
            Press <kbd className="px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[11px] font-mono text-[var(--text-primary)]">Cmd+O</kbd> to open a project
          </p>
        </div>
      </div>
    </div>
  );
}
