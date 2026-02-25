/**
 * SidStack Knowledge Browser
 *
 * Unified knowledge browser using REST API.
 * Displays documents from all sources (.sidstack/knowledge/, docs/)
 */

import {
  ChevronRight,
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
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useBlockNavigation } from "@/hooks/useBlockNavigation";
import { cn } from "@/lib/utils";
import type { BlockViewProps } from "@/types/block";
import type { DocumentType, DocumentStatus } from "@sidstack/shared";

import { registerBlockView } from "../BlockRegistry";

// =============================================================================
// Types (from shared schema)
// =============================================================================

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

import { getApiBaseUrl, apiFetch } from "@/lib/api-config";
const API_BASE = `${getApiBaseUrl()}/api/knowledge`;

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
  const isActive = workspaceContext?.isActive ?? true;

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
        apiFetch(`${API_BASE}?${params}`),
        apiFetch(`${API_BASE}/stats?projectPath=${encodeURIComponent(workspacePath)}`),
        apiFetch(`${API_BASE}/tree?projectPath=${encodeURIComponent(workspacePath)}`),
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

  // Auto-refresh based on project settings (pauses when workspace is inactive)
  useAutoRefresh({ onRefresh: loadData, enabled: isActive });

  // ===========================================================================
  // Document Selection
  // ===========================================================================

  const handleSelectDocument = useCallback(async (docId: string) => {
    if (!workspacePath) return;

    try {
      const res = await apiFetch(
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

  // Display tree (filtered or full)
  const displayTree = useMemo(() => {
    return hasFilters ? filteredTree : tree;
  }, [tree, filteredTree, hasFilters]);

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
      <div className="w-80 shrink-0 flex flex-col border-r border-[var(--border-default)]">
        {/* Stats bar */}
        {stats && (
          <div className="px-4 py-2.5 border-b border-[var(--border-muted)] bg-[var(--surface-1)]">
            <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)] tracking-wide">
              <span className="flex items-center gap-1.5">
                <span className="text-[var(--text-primary)] font-semibold tabular-nums">
                  {stats.totalDocuments}
                </span>
                documents
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[var(--text-primary)] font-semibold tabular-nums">
                  {Object.keys(stats.byModule).length}
                </span>
                modules
              </span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-[var(--border-muted)]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search documents..."
              aria-label="Search documents"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-8 pr-8 py-1.5 text-[12px] rounded-md",
                "bg-[var(--surface-1)] border border-[var(--border-muted)]",
                "text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]",
                "focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/30",
                "transition-[border-color,box-shadow] duration-150"
              )}
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-label={showFilters ? "Hide filters" : "Show filters"}
              aria-expanded={showFilters}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors duration-150",
                showFilters
                  ? "text-[var(--accent-primary)] bg-[var(--surface-2)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="mt-2 p-2.5 bg-[var(--surface-1)] rounded-md border border-[var(--border-muted)]">
              {/* Status + Module filters */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Status</div>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(STATUS_CONFIG) as DocumentStatus[]).map((status) => {
                      const config = STATUS_CONFIG[status];
                      const isActive = statusFilter.includes(status);
                      return (
                        <button
                          key={status}
                          onClick={() => toggleStatusFilter(status)}
                          className={cn(
                            "px-2 py-1 text-[11px] rounded-md border transition-all duration-150",
                            isActive
                              ? "border-[var(--border-emphasis)] bg-[var(--surface-3)] font-medium"
                              : "border-[var(--border-muted)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]"
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
                    <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Module</div>
                    <Select
                      value={moduleFilter || "__all__"}
                      onValueChange={(v) => setModuleFilter(v === "__all__" ? null : v)}
                    >
                      <SelectTrigger className="w-full h-7 text-[11px]">
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
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {typeFilter.map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--surface-2)] border border-[var(--border-default)] transition-colors duration-150"
                  style={{ color: TYPE_CONFIG[type].color }}
                >
                  {TYPE_CONFIG[type].label}
                  <button
                    onClick={() => toggleTypeFilter(type)}
                    className="hover:opacity-70 transition-opacity duration-150 ml-0.5"
                    aria-label={`Remove ${TYPE_CONFIG[type].label} filter`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {statusFilter.map((status) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--surface-2)] border border-[var(--border-default)] transition-colors duration-150"
                  style={{ color: STATUS_CONFIG[status].color }}
                >
                  {STATUS_CONFIG[status].label}
                  <button
                    onClick={() => toggleStatusFilter(status)}
                    className="hover:opacity-70 transition-opacity duration-150 ml-0.5"
                    aria-label={`Remove ${STATUS_CONFIG[status].label} filter`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {moduleFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--surface-2)] border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors duration-150">
                  {moduleFilter}
                  <button
                    onClick={() => setModuleFilter(null)}
                    className="hover:opacity-70 transition-opacity duration-150 ml-0.5"
                    aria-label="Remove module filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-150 ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Tree view */}
        <div className="flex-1 overflow-y-auto px-2 py-1.5">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              <span className="text-[12px]">Loading...</span>
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
              <Search className="w-7 h-7 text-[var(--text-muted)] mb-2 opacity-40" />
              <p className="text-[12px] font-medium text-[var(--text-secondary)] mb-1">No matching documents</p>
              <p className="text-[11px] text-[var(--text-muted)] mb-3 leading-relaxed">
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : typeFilter.length > 0 || statusFilter.length > 0 || moduleFilter
                    ? "Active filters are hiding all documents"
                    : "Try a different search term"}
              </p>
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-[11px] rounded-md bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-secondary)] transition-colors duration-150 border border-[var(--border-muted)]"
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
              nodes={displayTree}
              expandedFolders={expandedFolders}
              selectedDocId={selectedDoc?.id}
              onToggleFolder={toggleFolder}
              onSelectDocument={handleSelectDocument}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--border-default)] bg-[var(--surface-1)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
              {filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""}
              {hasFilters && (
                <span className="text-[var(--accent-primary)] ml-1">(filtered)</span>
              )}
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">⌘R to refresh</span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedDoc ? (
          <>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 px-5 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-1)]/50 text-[10px] text-[var(--text-muted)]">
              <span className="uppercase tracking-wider font-semibold">
                Knowledge
              </span>
              {selectedDoc.category && (
                <>
                  <span className="opacity-40">/</span>
                  <span>{selectedDoc.category}</span>
                </>
              )}
              <span className="opacity-40">/</span>
              <span className="text-[var(--text-secondary)] font-medium">{selectedDoc.slug || selectedDoc.title}</span>
            </div>

            {/* Document Header */}
            <div className="flex items-start justify-between px-5 py-3.5 border-b border-[var(--border-muted)] bg-[var(--surface-1)]">
              <div className="flex items-center gap-3 min-w-0">
                <DocumentTypeIconBadge type={selectedDoc.type} />
                <div className="min-w-0">
                  <h1 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight truncate">
                    {selectedDoc.title}
                  </h1>
                  <div className="flex items-center gap-2.5 mt-1.5 text-[11px] text-[var(--text-muted)]">
                    <DocumentStatusBadge status={selectedDoc.status} />
                    {selectedDoc.readingTime && (
                      <span className="tabular-nums">{selectedDoc.readingTime} min read</span>
                    )}
                    {selectedDoc.updatedAt && (
                      <span className="tabular-nums">Updated {new Date(selectedDoc.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0 ml-4">
                <CopyButton text={selectedDoc.content} label="Copy content" />
                <CopyButton text={selectedDoc.sourcePath} label="Copy path" icon="path" />
              </div>
            </div>

            {/* Document Meta */}
            {(selectedDoc.module || selectedDoc.tags.length > 0 || selectedDoc.owner || selectedDoc.related?.length || selectedDoc.dependsOn?.length) && (
            <div className="px-5 py-2.5 border-b border-[var(--border-muted)] bg-[var(--surface-0)]">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {selectedDoc.module && (
                  <button
                    onClick={() => setModuleFilter(selectedDoc.module!)}
                    className="px-2 py-1 bg-[var(--surface-2)] rounded-md hover:bg-[var(--surface-3)] flex items-center gap-1.5 text-[var(--text-secondary)] transition-colors duration-150"
                    title="Filter by module"
                  >
                    <Box className="w-3 h-3 text-[var(--text-muted)]" />
                    {selectedDoc.module}
                  </button>
                )}
                {selectedDoc.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-[var(--surface-1)] rounded-md text-[var(--text-muted)] border border-[var(--border-muted)]"
                  >
                    #{tag}
                  </span>
                ))}
                {selectedDoc.owner && (
                  <span className="text-[var(--text-muted)] ml-1">
                    Owner: <span className="text-[var(--text-secondary)]">{selectedDoc.owner}</span>
                  </span>
                )}
                {/* Quick navigation to related tasks */}
                {selectedDoc.module && (
                  <button
                    onClick={() => navigateToTaskManager({ filterByModule: selectedDoc.module! })}
                    className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors duration-150"
                    title="View tasks in this module"
                  >
                    <FileCode className="w-3 h-3" />
                    Module Tasks
                  </button>
                )}
              </div>

              {/* Related documents */}
              {(selectedDoc.related?.length || selectedDoc.dependsOn?.length) && (
                <div className="mt-2 pt-2 border-t border-[var(--border-muted)] flex flex-wrap gap-2 text-[11px]">
                  {selectedDoc.dependsOn?.length ? (
                    <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                      <span className="font-medium">Depends on:</span>
                      {selectedDoc.dependsOn.map((dep) => (
                        <button
                          key={dep}
                          onClick={() => handleSelectDocument(dep)}
                          className="px-2 py-0.5 bg-[var(--surface-2)] rounded-md hover:bg-[var(--surface-3)] text-[var(--text-secondary)] transition-colors duration-150"
                        >
                          {dep}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {selectedDoc.related?.length ? (
                    <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                      <span className="font-medium">Related:</span>
                      {selectedDoc.related.map((rel) => (
                        <button
                          key={rel}
                          onClick={() => handleSelectDocument(rel)}
                          className="px-2 py-0.5 bg-[var(--surface-2)] rounded-md hover:bg-[var(--surface-3)] text-[var(--text-secondary)] transition-colors duration-150"
                        >
                          {rel}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            )}

            {/* Type Context Bar - type-specific info */}
            <TypeContextBar doc={selectedDoc} />

            {/* Document Content + TOC */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto" id="kb-doc-scroll">
                <div className="px-8 py-6 max-w-3xl mx-auto">
                  <MarkdownPreview content={selectedDoc.content} />
                </div>
              </div>
              <DocTableOfContents content={selectedDoc.content} scrollContainerId="kb-doc-scroll" />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
            <BookOpen className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-[14px] font-medium text-[var(--text-secondary)]">Select a document</p>
            <p className="text-[12px] mt-1 text-[var(--text-muted)]">Browse documents in the sidebar</p>
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
    <div role="tree" aria-label="Knowledge documents" className="space-y-px">
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
            "w-full flex items-center gap-1.5 px-2 py-[5px] rounded-md text-[12px]",
            "hover:bg-[var(--surface-2)] transition-colors duration-150",
            "text-[var(--text-secondary)] font-medium",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <span className="flex-shrink-0 transition-transform duration-150" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
          </span>
          {isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
          )}
          <span className="truncate flex-1 text-left">{node.name}</span>
          {node.documentCount !== undefined && node.documentCount > 0 && (
            <span className="text-[10px] text-[var(--text-muted)] tabular-nums px-1.5 py-0.5 rounded-full bg-[var(--surface-2)] min-w-[20px] text-center">{node.documentCount}</span>
          )}
        </button>

        {isExpanded && node.children && (
          <div role="group" className="relative">
            {/* Indentation guide line */}
            <div
              className="absolute top-0 bottom-0 w-px bg-[var(--border-muted)]"
              style={{ left: `${depth * 16 + 18}px` }}
            />
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
        "w-full flex items-center gap-1.5 px-2 py-[5px] rounded-md text-[12px]",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]",
        isSelected
          ? "bg-[var(--surface-2)] text-[var(--text-primary)] font-medium border-l-2 border-l-[var(--accent-primary)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
      )}
      style={{ paddingLeft: `${depth * 16 + 24}px` }}
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
      className="px-1.5 py-0.5 rounded-md text-[10px] font-medium tracking-wide"
      style={{
        backgroundColor: `${config.color}15`,
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
      <div className="px-5 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-0)] flex items-center gap-2">
        <span className="text-[11px] text-[var(--text-muted)] font-medium">Endpoints:</span>
        {methods.map((m) => (
          <span
            key={m}
            className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wide"
            style={{ backgroundColor: `color-mix(in srgb, ${HTTP_METHOD_COLORS[m] || "var(--text-muted)"} 15%, transparent)`, color: HTTP_METHOD_COLORS[m] || "var(--text-muted)" }}
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
    const levelColors: Record<string, string> = { MUST: "var(--color-error)", SHOULD: "var(--color-warning)", MAY: "var(--color-success)" };
    const enfColors: Record<string, string> = { error: "var(--color-error)", warn: "var(--color-warning)", inform: "var(--color-info)" };
    return (
      <div className="px-5 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-0)] flex items-center gap-2">
        {level && (
          <span
            className="px-2 py-0.5 rounded-md text-[11px] font-bold"
            style={{ backgroundColor: `color-mix(in srgb, ${levelColors[level] || "var(--text-muted)"} 15%, transparent)`, color: levelColors[level] || "var(--text-muted)" }}
          >
            {level}
          </span>
        )}
        {enforcement && (
          <span
            className="px-2 py-0.5 rounded-md text-[11px] font-mono"
            style={{ backgroundColor: `color-mix(in srgb, ${enfColors[enforcement] || "var(--text-muted)"} 15%, transparent)`, color: enfColors[enforcement] || "var(--text-muted)" }}
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
      <div className="px-5 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-0)] flex items-center gap-2">
        <span className="text-[11px] text-[var(--text-muted)] font-medium">Skill type:</span>
        <span
          className="px-2 py-0.5 rounded-md text-[11px] font-medium"
          style={{ backgroundColor: `color-mix(in srgb, var(--doc-type-skill) 15%, transparent)`, color: "var(--doc-type-skill)" }}
        >
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
      <div className="px-5 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-0)] flex items-center gap-2">
        <span className="text-[11px] text-[var(--text-muted)] font-medium">Progress:</span>
        <span className="text-[11px] text-[var(--text-secondary)] font-semibold tabular-nums">
          {checked}/{total}
        </span>
        <div className="flex-1 max-w-32 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${total > 0 ? (checked / total) * 100 : 0}%`,
              backgroundColor: "var(--color-success)",
            }}
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
      <div className="px-5 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-0)] flex items-center gap-2">
        <span className="text-[11px] text-[var(--text-muted)] font-medium">Pattern:</span>
        <span
          className="px-2 py-0.5 rounded-md text-[11px] font-medium"
          style={{ backgroundColor: `color-mix(in srgb, var(--doc-type-pattern) 15%, transparent)`, color: "var(--doc-type-pattern)" }}
        >
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
      className={cn(
        "p-1.5 rounded-md text-[var(--text-muted)] transition-all duration-150",
        "hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]"
      )}
      title={label}
      aria-label={label}
    >
      {copied ? (
        <CheckSquare className="w-3.5 h-3.5 text-[var(--color-success)]" />
      ) : icon === "path" ? (
        <Terminal className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// =============================================================================
// Document Type Icon Badge (with colored background)
// =============================================================================

function DocumentTypeIconBadge({ type }: { type?: DocumentType }) {
  const config = type ? TYPE_CONFIG[type] : null;
  const Icon = config?.icon || FileText;
  const color = config?.color || "var(--text-muted)";

  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `${color}12` }}
    >
      <Icon className="w-4 h-4" style={{ color }} />
    </div>
  );
}

// =============================================================================
// Document Table of Contents (right sidebar with scroll-spy)
// =============================================================================

interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

function DocTableOfContents({
  content,
  scrollContainerId,
}: {
  content: string;
  scrollContainerId: string;
}) {
  const [activeId, setActiveId] = useState<string>("");

  // Extract headings from markdown content
  const headings = useMemo(() => {
    const result: TocHeading[] = [];
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/^(#{2,3})\s+(.+)/);
      if (match) {
        const level = match[1].length as 2 | 3;
        const text = match[2].replace(/[#*`\[\]]/g, "").trim();
        const id = text
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-");
        result.push({ id, text, level });
      }
    }
    return result;
  }, [content]);

  // Scroll-spy: observe which heading is in view
  useEffect(() => {
    const container = document.getElementById(scrollContainerId);
    if (!container || headings.length === 0) return;

    const handleScroll = () => {
      // Find all heading elements in the scrollable container
      const headingEls = container.querySelectorAll("h2, h3");
      let current = "";

      for (const el of headingEls) {
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // Check if the heading is near the top of the scroll container
        if (rect.top - containerRect.top <= 80) {
          // Build an id from the heading text to match our extracted headings
          const text = el.textContent?.replace(/[#*`\[\]]/g, "").trim() || "";
          const id = text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-");
          current = id;
        }
      }

      if (current) {
        setActiveId(current);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    // Run once to set initial active
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [headings, scrollContainerId]);

  if (headings.length === 0) return null;

  return (
    <div className="w-[180px] flex-shrink-0 border-l border-[var(--border-muted)] px-3 py-4 overflow-y-auto hidden xl:block">
      <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">
        On this page
      </div>
      <nav className="space-y-px" aria-label="Table of contents">
        {headings.map((h) => (
          <button
            key={h.id}
            onClick={() => {
              // Scroll to heading in the content
              const container = document.getElementById(scrollContainerId);
              if (!container) return;
              const headingEls = container.querySelectorAll("h2, h3");
              for (const el of headingEls) {
                const text = el.textContent?.replace(/[#*`\[\]]/g, "").trim() || "";
                const elId = text
                  .toLowerCase()
                  .replace(/[^a-z0-9\s-]/g, "")
                  .replace(/\s+/g, "-");
                if (elId === h.id) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                  break;
                }
              }
            }}
            className={cn(
              "block w-full text-left text-[11px] py-1 border-l-[1.5px] leading-snug transition-all duration-150",
              h.level === 3 ? "pl-5" : "pl-3",
              activeId === h.id
                ? "border-l-[var(--accent-primary)] text-[var(--text-primary)] font-medium"
                : "border-l-[var(--border-muted)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-l-[var(--border-emphasis)]"
            )}
          >
            {h.text}
          </button>
        ))}
      </nav>
    </div>
  );
}

// =============================================================================
// Register Block View
// =============================================================================

registerBlockView("knowledge-browser", KnowledgeBrowserBlockView);
