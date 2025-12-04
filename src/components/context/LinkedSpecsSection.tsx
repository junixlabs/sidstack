/**
 * LinkedSpecsSection
 *
 * Displays specs linked to the current task with actions to navigate or unlink.
 */

import { FileText, X, Plus, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import { useUnifiedContextStore, TaskSpecLink } from "@/stores/unifiedContextStore";

interface LinkedSpecsSectionProps {
  taskId: string;
  className?: string;
  onAddSpec?: () => void;
}

export function LinkedSpecsSection({
  taskId,
  className,
  onAddSpec,
}: LinkedSpecsSectionProps) {
  const { specLinks, unlinkSpec, navigateTo, isLoading } = useUnifiedContextStore();

  const links = specLinks.filter((l) => l.taskId === taskId);

  const handleNavigate = (link: TaskSpecLink) => {
    navigateTo({ type: "spec", path: link.specPath });
  };

  const handleUnlink = async (e: React.MouseEvent, linkId: string) => {
    e.stopPropagation();
    await unlinkSpec(linkId);
  };

  const getSpecTypeBadge = (_specType: string) => {
    // Monochrome neutral palette - all types use same styling
    return "bg-[var(--surface-2)] text-[var(--text-secondary)]";
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FileText className="w-4 h-4" />
          <span>Specs ({links.length})</span>
        </div>
        {onAddSpec && (
          <button
            onClick={onAddSpec}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Link spec"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Links list */}
      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground pl-6">No linked specs</p>
      ) : (
        <ul className="space-y-1 pl-6">
          {links.map((link) => (
            <li
              key={link.id}
              className="group flex items-center gap-2 text-sm hover:bg-accent/50 rounded px-2 py-1 cursor-pointer transition-colors"
              onClick={() => handleNavigate(link)}
            >
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-medium rounded",
                  getSpecTypeBadge(link.specType)
                )}
              >
                {link.specType}
              </span>
              <span className="flex-1 truncate text-foreground">
                {link.specPath.split("/").pop()?.replace(".md", "")}
              </span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50" />
              <button
                onClick={(e) => handleUnlink(e, link.id)}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
                title="Unlink spec"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {isLoading && (
        <p className="text-xs text-muted-foreground pl-6 animate-pulse">
          Loading...
        </p>
      )}
    </div>
  );
}

export default LinkedSpecsSection;
