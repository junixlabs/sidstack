/**
 * LinkedKnowledgeSection
 *
 * Displays knowledge documents linked to the current task with actions to navigate or unlink.
 */

import { BookOpen, X, Plus, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import { useUnifiedContextStore, TaskKnowledgeLink } from "@/stores/unifiedContextStore";

interface LinkedKnowledgeSectionProps {
  taskId: string;
  className?: string;
  onAddKnowledge?: () => void;
}

export function LinkedKnowledgeSection({
  taskId,
  className,
  onAddKnowledge,
}: LinkedKnowledgeSectionProps) {
  const { knowledgeLinks, unlinkKnowledge, navigateTo, isLoading } =
    useUnifiedContextStore();

  const links = knowledgeLinks.filter((l) => l.taskId === taskId);

  const handleNavigate = (link: TaskKnowledgeLink) => {
    navigateTo({ type: "knowledge", path: link.knowledgePath });
  };

  const handleUnlink = async (e: React.MouseEvent, linkId: string) => {
    e.stopPropagation();
    await unlinkKnowledge(linkId);
  };

  const getLinkTypeBadge = (linkType: string) => {
    switch (linkType) {
      case "manual":
        return "bg-blue-500/10 text-blue-500";
      case "auto":
        return "bg-green-500/10 text-green-500";
      case "referenced":
        return "bg-yellow-500/10 text-yellow-500";
      default:
        return "bg-gray-500/10 text-gray-500";
    }
  };

  const formatPath = (path: string) => {
    // Extract filename and folder from path like ".sidstack/knowledge/api/login.md"
    const parts = path.split("/");
    const filename = parts.pop()?.replace(".md", "") || path;
    const folder = parts.pop() || "";
    return { filename, folder };
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BookOpen className="w-4 h-4" />
          <span>Knowledge ({links.length})</span>
        </div>
        {onAddKnowledge && (
          <button
            onClick={onAddKnowledge}
            className="p-1 rounded hover:bg-accent transition-colors"
            title="Link knowledge"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Links list */}
      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground pl-6">
          No linked knowledge
        </p>
      ) : (
        <ul className="space-y-1 pl-6">
          {links.map((link) => {
            const { filename, folder } = formatPath(link.knowledgePath);
            return (
              <li
                key={link.id}
                className="group flex items-center gap-2 text-sm hover:bg-accent/50 rounded px-2 py-1 cursor-pointer transition-colors"
                onClick={() => handleNavigate(link)}
              >
                {folder && (
                  <span className="text-[10px] text-muted-foreground">
                    {folder}/
                  </span>
                )}
                <span className="flex-1 truncate text-foreground">
                  {filename}
                </span>
                {link.linkType !== "manual" && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] font-medium rounded",
                      getLinkTypeBadge(link.linkType)
                    )}
                  >
                    {link.linkType}
                  </span>
                )}
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                <button
                  onClick={(e) => handleUnlink(e, link.id)}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
                  title="Unlink knowledge"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            );
          })}
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

export default LinkedKnowledgeSection;
