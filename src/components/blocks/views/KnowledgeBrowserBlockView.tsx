/**
 * SidStack Knowledge Browser
 *
 * Unified knowledge browser using REST API.
 * Displays documents from all sources (.sidstack/knowledge/, docs/)
 */

import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Search,
  RefreshCw,
  AlertCircle,
  BookOpen,
  GitBranch,
  FileCode,
  Copy,
  CheckSquare,
  Puzzle,
  Shield,
  Star,
  X,
  SlidersHorizontal,
  Sparkles,
  Box,
  LayoutList,
  FileEdit,
  Terminal,
} from "lucide-react";
import { memo, useEffect, useState, useCallback, useMemo } from "react";

import { MarkdownPreview } from "@/components/MarkdownPreview";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useOptionalWorkspaceContext } from "@/contexts/WorkspaceContext";
import { useBlockNavigation } from "@/hooks/useBlockNavigation";
import { cn } from "@/lib/utils";
import type { BlockViewProps } from "@/types/block";

import { registerBlockView } from "../BlockRegistry";

// =============================================================================
// Types (matching backend)
// =============================================================================

type DocumentType =
  // Specs
  | "spec"
  | "decision"
  | "proposal"
  // Docs
  | "guide"
  | "reference"
  // Resources
  | "template"
  | "checklist"
  | "pattern"
  // Agent-specific
  | "skill"
  | "principle"
  | "rule"
  // Meta
  | "module"
  | "index";

type DocumentStatus = "draft" | "active" | "review" | "archived";

interface KnowledgeDocument {
  id: string;
  slug: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  content: string;
  summary?: string;
  module?: string;
  tags: string[];
  category?: string;
  owner?: string;
  reviewDate?: string;
  related?: string[];
  dependsOn?: string[];
  source: string;
  sourcePath: string;
  absolutePath: string;
  createdAt: string;
  updatedAt: string;
  wordCount?: number;
  readingTime?: number;
}

interface KnowledgeTreeNode {
  id: string;
  name: string;
  type: "folder" | "document";
  path: string;
  documentType?: DocumentType;
  status?: DocumentStatus;
  children?: KnowledgeTreeNode[];
  documentCount?: number;
}

interface KnowledgeStats {
  totalDocuments: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  byModule: Record<string, number>;
}

// =============================================================================
// Constants
// =============================================================================

const API_BASE = "http://localhost:19432/api/knowledge";

const TYPE_CONFIG: Record<DocumentType, { label: string; icon: typeof FileText; color: string }> = {
  // Specs
  spec: { label: "Spec", icon: FileText, color: "var(--doc-type-spec)" },
  decision: { label: "Decision", icon: GitBranch, color: "var(--doc-type-decision)" },
  proposal: { label: "Proposal", icon: FileEdit, color: "var(--doc-type-proposal)" },
  // Docs
  guide: { label: "Guide", icon: BookOpen, color: "var(--doc-type-guide)" },
  reference: { label: "Reference", icon: FileCode, color: "var(--doc-type-reference)" },
  // Resources
  template: { label: "Template", icon: Copy, color: "var(--doc-type-template)" },
  checklist: { label: "Checklist", icon: CheckSquare, color: "var(--doc-type-checklist)" },
  pattern: { label: "Pattern", icon: Puzzle, color: "var(--doc-type-pattern)" },
  // Agent-specific
  skill: { label: "Skill", icon: Sparkles, color: "var(--doc-type-skill)" },
  principle: { label: "Principle", icon: Star, color: "var(--doc-type-principle)" },
  rule: { label: "Rule", icon: Shield, color: "var(--doc-type-rule)" },
  // Meta
  module: { label: "Module", icon: Box, color: "var(--doc-type-module)" },
  index: { label: "Index", icon: LayoutList, color: "var(--doc-type-index)" },
};

const STATUS_CONFIG: Record<DocumentStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "var(--doc-status-draft)" },
  active: { label: "Active", color: "var(--doc-status-active)" },
  review: { label: "Needs Review", color: "var(--doc-status-review)" },
  archived: { label: "Archived", color: "var(--doc-status-archived)" },
};

// Category groups for quick-filter tabs
const TYPE_CATEGORIES: { label: string; types: DocumentType[]; color: string }[] = [
  { label: "Specs", types: ["spec", "decision", "proposal"], color: "var(--doc-type-spec)" },
  { label: "Docs", types: ["guide", "reference"], color: "var(--doc-type-guide)" },
  { label: "Resources", types: ["template", "checklist", "pattern"], color: "var(--doc-type-pattern)" },
  { label: "Agent", types: ["skill", "principle", "rule"], color: "var(--doc-type-principle)" },
  { label: "Meta", types: ["module", "index"], color: "var(--doc-type-index)" },
];

// HTTP method detection for API reference docs
const HTTP_METHOD_COLORS: Record<string, string> = {
  GET: "var(--http-get)",
  POST: "var(--http-post)",
  PUT: "var(--http-put)",
  PATCH: "var(--http-patch)",
  DELETE: "var(--http-delete)",
};

function detectHttpMethods(content: string): string[] {
  const methods = new Set<string>();
  const regex = /\b(GET|POST|PUT|PATCH|DELETE)\s+[\/`]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    methods.add(match[1]);
  }
  return Array.from(methods);
}

// =============================================================================
// Main Component
// =============================================================================

export const KnowledgeBrowserBlockView = memo(function KnowledgeBrowserBlockView(
  _props: BlockViewProps
) {
  const workspaceContext = useOptionalWorkspaceContext();
  const workspacePath = workspaceContext?.workspacePath || "";

  // Cross-feature navigation
  const { navigateToTaskManager } = useBlockNavigation();

  // State
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [tree, setTree] = useState<KnowledgeTreeNode[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentType[]>([]);
  const [statusFilter, setStatusFilter] = useState<DocumentStatus[]>([]);
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Tree state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // ===========================================================================
  // Data Loading
  // ===========================================================================

  const loadData = useCallback(async () => {
    if (!workspacePath) {
      setError("No workspace selected");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams({ projectPath: workspacePath });

      if (typeFilter.length > 0) {
        params.set("type", typeFilter.join(","));
      }
      if (statusFilter.length > 0) {
        params.set("status", statusFilter.join(","));
      }
      if (moduleFilter) {
        params.set("module", moduleFilter);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }

      // Fetch documents and stats in parallel
      const [docsRes, statsRes, treeRes] = await Promise.all([
        fetch(`${API_BASE}?${params}`),
        fetch(`${API_BASE}/stats?projectPath=${encodeURIComponent(workspacePath)}`),
        fetch(`${API_BASE}/tree?projectPath=${encodeURIComponent(workspacePath)}`),
      ]);

      if (!docsRes.ok) throw new Error("Failed to load documents");
      if (!statsRes.ok) throw new Error("Failed to load stats");
      if (!treeRes.ok) throw new Error("Failed to load tree");

      const docsData = await docsRes.json();
      const statsData = await statsRes.json();
      const treeData = await treeRes.json();

      setDocuments(docsData.documents || []);
      setStats(statsData);
      setTree(treeData);

      // Auto-expand first level
      const firstLevel = treeData.map((n: KnowledgeTreeNode) => n.path);
      setExpandedFolders(new Set(firstLevel));
    } catch (e) {
      console.error("Error loading knowledge:", e);
      setError(e instanceof Error ? e.message : "Failed to load knowledge");
    } finally {
      setIsLoading(false);
    }
  }, [workspacePath, typeFilter, statusFilter, moduleFilter, searchQuery]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ===========================================================================
  // Document Selection
  // ===========================================================================

  const handleSelectDocument = useCallback(async (docId: string) => {
    if (!workspacePath) return;

    try {
      const res = await fetch(
        `${API_BASE}/doc/${docId}?projectPath=${encodeURIComponent(workspacePath)}`
      );
      if (!res.ok) throw new Error("Failed to load document");

      const doc = await res.json();
      setSelectedDoc(doc);
    } catch (e) {
      console.error("Error loading document:", e);
    }
  }, [workspacePath]);

  // ===========================================================================
  // Filtering
  // ===========================================================================

  const filteredDocuments = useMemo(() => {
    // Documents are already filtered by API, but we can do client-side filtering too
    return documents;
  }, [documents]);

  const toggleTypeFilter = useCallback((type: DocumentType) => {
    setTypeFilter((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const toggleStatusFilter = useCallback((status: DocumentStatus) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setTypeFilter([]);
    setStatusFilter([]);
    setModuleFilter(null);
  }, []);

  const hasFilters = searchQuery || typeFilter.length > 0 || statusFilter.length > 0 || moduleFilter;

  // ===========================================================================
  // Tree Filtering (client-side)
  // ===========================================================================

  const filteredTree = useMemo(() => {
    // If no filters active, return original tree
    if (!hasFilters) return tree;

    // Get IDs of filtered documents
    const filteredIds = new Set(documents.map(d => d.id));

    // Recursively filter tree to only include matching documents
    function filterNode(node: KnowledgeTreeNode): KnowledgeTreeNode | null {
      if (node.type === 'document') {
        return filteredIds.has(node.id) ? node : null;
      }

      // Folder: filter children
      const filteredChildren = node.children
        ?.map(filterNode)
        .filter((n): n is KnowledgeTreeNode => n !== null);

      // Only include folder if it has matching children
      if (!filteredChildren || filteredChildren.length === 0) {
        return null;
      }

      return {
        ...node,
        children: filteredChildren,
        documentCount: filteredChildren.filter(c => c.type === 'document').length,
      };
    }

    return tree.map(filterNode).filter((n): n is KnowledgeTreeNode => n !== null);
  }, [tree, documents, hasFilters]);

  // ===========================================================================
  // Tree Navigation
  // ===========================================================================

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="flex h-full bg-[var(--surface-0)] text-[var(--text-primary)]">
      {/* Sidebar */}
      <div className="w-80 shrink-0 flex flex-col border-r border-[var(--border-muted)]">
        {/* Stats bar */}
        {stats && (
          <div className="px-3 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-1)]">
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span>
                <span className="text-[var(--text-secondary)] font-medium">
                  {stats.totalDocuments}
                </span>{" "}
                documents
              </span>
              <span>
                <span className="text-[var(--text-secondary)] font-medium">
                  {Object.keys(stats.byModule).length}
                </span>{" "}
                modules
              </span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-2 border-b border-[var(--border-muted)]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search documents..."
              aria-label="Search documents"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-8 pr-8 py-1.5 text-sm rounded",
                "bg-[var(--surface-1)] border border-[var(--border-muted)]",
                "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                "focus:outline-none focus:border-[var(--border-emphasis)]"
              )}
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-label={showFilters ? "Hide filters" : "Show filters"}
              aria-expanded={showFilters}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded",
                showFilters
                  ? "text-[var(--text-secondary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-2 p-2 bg-[var(--surface-2)] rounded border border-[var(--border-muted)]">
              {/* Category quick-filters */}
              <div className="mb-2">
                <div className="text-xs text-[var(--text-muted)] mb-1">Category</div>
                <div className="flex flex-wrap gap-1">
                  {TYPE_CATEGORIES.map((cat) => {
                    const isActive = cat.types.some((t) => typeFilter.includes(t));
                    return (
                      <button
                        key={cat.label}
                        onClick={() => {
                          if (isActive) {
                            setTypeFilter((prev) => prev.filter((t) => !cat.types.includes(t)));
                          } else {
                            setTypeFilter((prev) => [...prev.filter((t) => !cat.types.includes(t)), ...cat.types]);
                          }
                        }}
                        className={cn(
                          "px-2 py-0.5 text-xs rounded border transition-colors",
                          isActive
                            ? "border-[var(--border-emphasis)] bg-[var(--surface-3)]"
                            : "border-transparent hover:bg-[var(--surface-3)]"
                        )}
                        style={{ color: isActive ? cat.color : undefined }}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status + Module filters */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Status</div>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(STATUS_CONFIG) as DocumentStatus[]).map((status) => {
                      const config = STATUS_CONFIG[status];
                      const isActive = statusFilter.includes(status);
                      return (
                        <button
                          key={status}
                          onClick={() => toggleStatusFilter(status)}
                          className={cn(
                            "px-2 py-0.5 text-xs rounded border transition-colors",
                            isActive
                              ? "border-[var(--border-emphasis)] bg-[var(--surface-3)]"
                              : "border-transparent hover:bg-[var(--surface-3)]"
                          )}
                          style={{ color: isActive ? config.color : undefined }}
                        >
                          {config.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {stats && Object.keys(stats.byModule).length > 0 && (
                  <div className="flex-1">
                    <div className="text-xs text-[var(--text-muted)] mb-1">Module</div>
                    <Select
                      value={moduleFilter || "__all__"}
                      onValueChange={(v) => setModuleFilter(v === "__all__" ? null : v)}
                    >
                      <SelectTrigger className="w-full h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All modules</SelectItem>
                        {Object.keys(stats.byModule).map((module) => (
                          <SelectItem key={module} value={module}>
                            {module} ({stats.byModule[module]})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active filters */}
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-1 mt-2">
              {typeFilter.map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--surface-2)] border border-[var(--border-default)]"
                  style={{ color: TYPE_CONFIG[type].color }}
                >
                  {TYPE_CONFIG[type].label}
                  <button onClick={() => toggleTypeFilter(type)} className="hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {statusFilter.map((status) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--surface-2)] border border-[var(--border-default)]"
                  style={{ color: STATUS_CONFIG[status].color }}
                >
                  {STATUS_CONFIG[status].label}
                  <button onClick={() => toggleStatusFilter(status)} className="hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {moduleFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)]">
                  {moduleFilter}
                  <button onClick={() => setModuleFilter(null)} className="hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Tree view */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : error ? (
            <EmptyState
              icon={<AlertCircle className="w-full h-full" />}
              title="Error Loading Documents"
              description={error}
              actions={[
                {
                  label: "Retry",
                  onClick: () => loadData(),
                  icon: <RefreshCw className="w-4 h-4" />,
                },
                {
                  label: "View Tasks",
                  onClick: () => navigateToTaskManager(),
                  icon: <CheckSquare className="w-4 h-4" />,
                  variant: "outline",
                },
              ]}
              compact
            />
          ) : filteredTree.length === 0 && hasFilters ? (
            // Filters active but no matches
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <Search className="w-8 h-8 text-[var(--text-muted)] mb-2 opacity-50" />
              <p className="text-sm text-[var(--text-secondary)] mb-1">No matching documents</p>
              <p className="text-xs text-[var(--text-muted)] mb-3">
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : typeFilter.length > 0 || statusFilter.length > 0 || moduleFilter
                    ? "Active filters are hiding all documents"
                    : "Try a different search term"}
              </p>
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-xs rounded bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-secondary)] transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : tree.length === 0 ? (
            // No documents at all
            <EmptyState
              icon={<BookOpen className="w-full h-full" />}
              title="No Knowledge Documents"
              description="Knowledge documents help organize project documentation, patterns, and guidelines."
              actions={[
                {
                  label: "View Tasks",
                  onClick: () => navigateToTaskManager(),
                  icon: <CheckSquare className="w-4 h-4" />,
                  variant: "outline",
                },
              ]}
              tips={[
                "Create .sidstack/knowledge/ folder to add documents",
                "Supported types: guides, tutorials, patterns, skills",
              ]}
              compact
            />
          ) : (
            <TreeView
              nodes={filteredTree}
              expandedFolders={expandedFolders}
              selectedDocId={selectedDoc?.id}
              onToggleFolder={toggleFolder}
              onSelectDocument={handleSelectDocument}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-[var(--border-muted)] text-xs text-[var(--text-muted)]">
          <div className="flex items-center justify-between">
            <span>
              {filteredDocuments.length} documents
              {hasFilters && " (filtered)"}
            </span>
            <button
              onClick={() => loadData()}
              className="flex items-center gap-1 hover:text-[var(--text-secondary)] transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        {selectedDoc ? (
          <>
            {/* Document Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-1)]">
              <div className="flex items-center gap-2">
                <DocumentTypeIcon type={selectedDoc.type} />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {selectedDoc.title}
                </span>
                <DocumentStatusBadge status={selectedDoc.status} />
              </div>
              <div className="flex items-center gap-2">
                {selectedDoc.readingTime && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {selectedDoc.readingTime} min read
                  </span>
                )}
                <CopyButton text={selectedDoc.content} label="Copy content" />
                <CopyButton text={selectedDoc.sourcePath} label="Copy path" icon="path" />
              </div>
            </div>

            {/* Document Meta */}
            <div className="px-4 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-1)]/50">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {selectedDoc.module && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setModuleFilter(selectedDoc.module!)}
                      className="px-2 py-0.5 bg-[var(--surface-2)] rounded hover:bg-[var(--surface-3)] flex items-center gap-1"
                      title="Filter by module"
                    >
                      <Box className="w-3 h-3" />
                      {selectedDoc.module}
                    </button>
                  </div>
                )}
                {selectedDoc.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-[var(--surface-2)] rounded text-[var(--text-muted)]"
                  >
                    #{tag}
                  </span>
                ))}
                {selectedDoc.owner && (
                  <span className="text-[var(--text-muted)]">
                    Owner: {selectedDoc.owner}
                  </span>
                )}
                {/* Quick navigation to related tasks */}
                {selectedDoc.module && (
                  <button
                    onClick={() => navigateToTaskManager({ filterByModule: selectedDoc.module! })}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                    title="View tasks in this module"
                  >
                    <FileCode className="w-3 h-3" />
                    Module Tasks
                  </button>
                )}
              </div>

              {/* Related documents */}
              {(selectedDoc.related?.length || selectedDoc.dependsOn?.length) && (
                <div className="mt-2 pt-2 border-t border-[var(--border-muted)] flex flex-wrap gap-2">
                  {selectedDoc.dependsOn?.length ? (
                    <div className="flex items-center gap-1 text-[var(--text-muted)]">
                      <span>Depends on:</span>
                      {selectedDoc.dependsOn.map((dep) => (
                        <button
                          key={dep}
                          onClick={() => handleSelectDocument(dep)}
                          className="px-1.5 py-0.5 bg-[var(--surface-2)] rounded hover:bg-[var(--surface-3)]"
                        >
                          {dep}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {selectedDoc.related?.length ? (
                    <div className="flex items-center gap-1 text-[var(--text-muted)]">
                      <span>Related:</span>
                      {selectedDoc.related.map((rel) => (
                        <button
                          key={rel}
                          onClick={() => handleSelectDocument(rel)}
                          className="px-1.5 py-0.5 bg-[var(--surface-2)] rounded hover:bg-[var(--surface-3)]"
                        >
                          {rel}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Type Context Bar - type-specific info */}
            <TypeContextBar doc={selectedDoc} />

            {/* Document Content */}
            <div className="flex-1 overflow-auto">
              <div className="p-6 max-w-4xl mx-auto">
                <MarkdownPreview content={selectedDoc.content} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <BookOpen className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a document</p>
            <p className="text-sm mt-1">Browse documents in the sidebar</p>
          </div>
        )}
      </div>
    </div>
  );
});

// =============================================================================
// Tree View Component
// =============================================================================

interface TreeViewProps {
  nodes: KnowledgeTreeNode[];
  expandedFolders: Set<string>;
  selectedDocId?: string;
  onToggleFolder: (path: string) => void;
  onSelectDocument: (docId: string) => void;
}

function TreeView({
  nodes,
  expandedFolders,
  selectedDocId,
  onToggleFolder,
  onSelectDocument,
}: TreeViewProps) {
  return (
    <div role="tree" aria-label="Knowledge documents" className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          expandedFolders={expandedFolders}
          selectedDocId={selectedDocId}
          onToggleFolder={onToggleFolder}
          onSelectDocument={onSelectDocument}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: KnowledgeTreeNode;
  depth: number;
  expandedFolders: Set<string>;
  selectedDocId?: string;
  onToggleFolder: (path: string) => void;
  onSelectDocument: (docId: string) => void;
}

function TreeNode({
  node,
  depth,
  expandedFolders,
  selectedDocId,
  onToggleFolder,
  onSelectDocument,
}: TreeNodeProps) {
  const isExpanded = expandedFolders.has(node.path);
  const isFolder = node.type === "folder";
  const isSelected = !isFolder && node.id === selectedDocId;

  if (isFolder) {
    return (
      <div role="treeitem" aria-expanded={isExpanded}>
        <button
          onClick={() => onToggleFolder(node.path)}
          aria-expanded={isExpanded}
          className={cn(
            "w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm",
            "hover:bg-[var(--surface-2)] transition-colors",
            "text-[var(--text-secondary)]"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <Folder className="w-4 h-4 text-[var(--text-muted)]" />
          )}
          <span className="truncate flex-1 text-left">{node.name}</span>
          {node.documentCount !== undefined && node.documentCount > 0 && (
            <span className="text-xs text-[var(--text-muted)]">{node.documentCount}</span>
          )}
        </button>

        {isExpanded && node.children && (
          <div role="group">
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedFolders={expandedFolders}
                selectedDocId={selectedDocId}
                onToggleFolder={onToggleFolder}
                onSelectDocument={onSelectDocument}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Document node
  return (
    <button
      role="treeitem"
      aria-selected={isSelected}
      onClick={() => onSelectDocument(node.id)}
      className={cn(
        "w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm",
        "hover:bg-[var(--surface-2)] transition-colors",
        isSelected
          ? "bg-[var(--surface-3)] text-[var(--text-primary)] border-l-2 border-[var(--border-emphasis)]"
          : "text-[var(--text-secondary)]"
      )}
      style={{ paddingLeft: `${depth * 12 + 24}px` }}
    >
      <DocumentTypeIcon type={node.documentType} size="sm" />
      <span className="truncate flex-1 text-left">{node.name}</span>
      {node.status && <DocumentStatusDot status={node.status} />}
    </button>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function DocumentTypeIcon({
  type,
  size = "md",
}: {
  type?: DocumentType;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const config = type ? TYPE_CONFIG[type] : null;

  if (!config) {
    return <FileText className={cn(sizeClass, "text-[var(--text-muted)]")} />;
  }

  const Icon = config.icon;
  return <Icon className={sizeClass} style={{ color: config.color }} />;
}

function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className="px-2 py-0.5 rounded text-xs"
      style={{
        backgroundColor: `${config.color}20`,
        color: config.color,
      }}
    >
      {config.label}
    </span>
  );
}

function DocumentStatusDot({ status }: { status: DocumentStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: config.color }}
    />
  );
}

// =============================================================================
// Type Context Bar - shows type-specific metadata between header and content
// =============================================================================

function TypeContextBar({ doc }: { doc: KnowledgeDocument }) {
  const { type, content } = doc;

  // Reference/API docs: show detected HTTP methods
  if (type === "reference") {
    const methods = detectHttpMethods(content);
    if (methods.length === 0) return null;
    return (
      <div className="px-4 py-1.5 border-b border-[var(--border-muted)] bg-[var(--surface-0)] flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">Endpoints:</span>
        {methods.map((m) => (
          <span
            key={m}
            className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold"
            style={{ backgroundColor: `${HTTP_METHOD_COLORS[m] || "#666"}20`, color: HTTP_METHOD_COLORS[m] || "#666" }}
          >
            {m}
          </span>
        ))}
      </div>
    );
  }

  // Rule docs: show enforcement level
  if (type === "rule") {
    const levelMatch = content.match(/level:\s*(must|should|may)/i);
    const enforcementMatch = content.match(/enforcement:\s*(error|warn|inform)/i);
    const level = levelMatch?.[1]?.toUpperCase() || null;
    const enforcement = enforcementMatch?.[1] || null;
    if (!level && !enforcement) return null;
    const levelColors: Record<string, string> = { MUST: "#ef4444", SHOULD: "#f59e0b", MAY: "#22c55e" };
    const enfColors: Record<string, string> = { error: "#ef4444", warn: "#f59e0b", inform: "#3b82f6" };
    return (
      <div className="px-4 py-1.5 border-b border-[var(--border-muted)] bg-[var(--surface-0)] flex items-center gap-2">
        {level && (
          <span
            className="px-1.5 py-0.5 rounded text-[11px] font-bold"
            style={{ backgroundColor: `${levelColors[level] || "#666"}20`, color: levelColors[level] || "#666" }}
          >
            {level}
          </span>
        )}
        {enforcement && (
          <span
            className="px-1.5 py-0.5 rounded text-[11px] font-mono"
            style={{ backgroundColor: `${enfColors[enforcement] || "#666"}20`, color: enfColors[enforcement] || "#666" }}
          >
            {enforcement}
          </span>
        )}
      </div>
    );
  }

  // Skill docs: show skill type
  if (type === "skill") {
    const skillTypeMatch = content.match(/type:\s*(procedure|checklist|pattern|template)/i);
    const skillType = skillTypeMatch?.[1] || null;
    if (!skillType) return null;
    return (
      <div className="px-4 py-1.5 border-b border-[var(--border-muted)] bg-[var(--surface-0)] flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">Skill type:</span>
        <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-pink-500/10 text-pink-400">
          {skillType}
        </span>
      </div>
    );
  }

  // Checklist docs: show progress count
  if (type === "checklist") {
    const total = (content.match(/^- \[[ x]\]/gm) || []).length;
    const checked = (content.match(/^- \[x\]/gm) || []).length;
    if (total === 0) return null;
    return (
      <div className="px-4 py-1.5 border-b border-[var(--border-muted)] bg-[var(--surface-0)] flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">Progress:</span>
        <span className="text-xs text-[var(--text-secondary)] font-medium">
          {checked}/{total}
        </span>
        <div className="flex-1 max-w-32 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${total > 0 ? (checked / total) * 100 : 0}%` }}
          />
        </div>
      </div>
    );
  }

  // Pattern docs: show category if detected
  if (type === "pattern") {
    const catMatch = content.match(/category:\s*(creational|structural|behavioral|architectural|concurrency)/i);
    const cat = catMatch?.[1] || null;
    if (!cat) return null;
    return (
      <div className="px-4 py-1.5 border-b border-[var(--border-muted)] bg-[var(--surface-0)] flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">Pattern:</span>
        <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-pink-500/10 text-pink-400">
          {cat}
        </span>
      </div>
    );
  }

  return null;
}

// =============================================================================
// Copy Button
// =============================================================================

function CopyButton({ text, label, icon = "content" }: { text: string; label: string; icon?: "content" | "path" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API not available
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
      title={label}
    >
      {copied ? (
        <CheckSquare className="w-3.5 h-3.5 text-green-400" />
      ) : icon === "path" ? (
        <Terminal className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// =============================================================================
// Register Block View
// =============================================================================

registerBlockView("knowledge-browser", KnowledgeBrowserBlockView);
