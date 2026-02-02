import { create } from "zustand";

import {
  KnowledgeDocument,
  KnowledgeTreeNode,
  KnowledgeDocumentType,
  KnowledgeStatus,
  extractCodeRefs,
} from "@/types/knowledge";

/**
 * Knowledge Browser Store
 *
 * Manages knowledge documents for project documentation.
 * Uses REST API (api-server) instead of Tauri IPC for data loading.
 */

const API_BASE = "http://localhost:19432/api/knowledge";

// ============================================================================
// Types
// ============================================================================

export interface KnowledgeFilters {
  type: KnowledgeDocumentType | null;
  status: KnowledgeStatus | null;
  module: string | null;
  searchQuery: string;
}

interface KnowledgeStore {
  // Data
  basePath: string | null;
  projectPath: string | null;
  documents: Map<string, KnowledgeDocument>;
  tree: KnowledgeTreeNode[];

  // Selection
  selectedPath: string | null;
  selectedDocument: KnowledgeDocument | null;

  // Filters
  filters: KnowledgeFilters;

  // UI State
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  expandedFolders: Set<string>;

  // Actions - Initialization
  initialize: (projectPath: string) => Promise<boolean>;
  initializeKnowledgeFolder: (projectPath: string) => Promise<boolean>;

  // Actions - Documents
  loadDocuments: () => Promise<void>;
  selectDocument: (path: string | null) => void;
  refreshDocument: (path: string) => Promise<void>;

  // Actions - Filters
  setSearchQuery: (query: string) => void;
  setTypeFilter: (type: KnowledgeDocumentType | null) => void;
  setStatusFilter: (status: KnowledgeStatus | null) => void;
  setModuleFilter: (module: string | null) => void;
  resetFilters: () => void;

  // Actions - UI
  toggleFolder: (path: string) => void;
  expandAllFolders: () => void;
  collapseAllFolders: () => void;

  // Computed
  getFilteredDocuments: () => KnowledgeDocument[];
  getDocumentsByType: (type: KnowledgeDocumentType) => KnowledgeDocument[];
  searchDocuments: (query: string) => KnowledgeDocument[];
}

const DEFAULT_FILTERS: KnowledgeFilters = {
  type: null,
  status: null,
  module: null,
  searchQuery: "",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build tree structure from flat list of paths
 */
function buildTree(documents: Map<string, KnowledgeDocument>): KnowledgeTreeNode[] {
  const root: KnowledgeTreeNode[] = [];
  const folders = new Map<string, KnowledgeTreeNode>();

  // Sort paths to ensure parent folders come first
  const paths = Array.from(documents.keys()).sort();

  for (const path of paths) {
    const parts = path.split("/");
    const fileName = parts.pop()!;
    const folderPath = parts.join("/");

    // Create folder nodes as needed
    let currentPath = "";
    for (const part of parts) {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!folders.has(currentPath)) {
        const folderNode: KnowledgeTreeNode = {
          name: part,
          path: currentPath,
          type: "folder",
          children: [],
        };

        folders.set(currentPath, folderNode);

        // Add to parent or root
        if (parentPath) {
          const parent = folders.get(parentPath);
          parent?.children?.push(folderNode);
        } else {
          root.push(folderNode);
        }
      }
    }

    // Create file node
    const fileNode: KnowledgeTreeNode = {
      name: fileName,
      path: path,
      type: "file",
      document: documents.get(path),
    };

    // Add to parent folder or root
    if (folderPath) {
      const parent = folders.get(folderPath);
      parent?.children?.push(fileNode);
    } else {
      root.push(fileNode);
    }
  }

  return root;
}

/**
 * Get all folder paths from tree
 */
function getAllFolderPaths(nodes: KnowledgeTreeNode[]): string[] {
  const paths: string[] = [];

  function traverse(node: KnowledgeTreeNode) {
    if (node.type === "folder") {
      paths.push(node.path);
      node.children?.forEach(traverse);
    }
  }

  nodes.forEach(traverse);
  return paths;
}

/**
 * Convert REST API document to legacy KnowledgeDocument format
 */
function apiDocToLegacy(apiDoc: any): KnowledgeDocument {
  return {
    path: apiDoc.sourcePath || apiDoc.path || apiDoc.id,
    absolutePath: apiDoc.absolutePath || "",
    frontmatter: {
      id: apiDoc.id,
      type: apiDoc.type as KnowledgeDocumentType,
      title: apiDoc.title,
      module: apiDoc.module,
      status: apiDoc.status as KnowledgeStatus,
      tags: apiDoc.tags,
      related: apiDoc.related,
    },
    content: apiDoc.content || "",
    codeRefs: apiDoc.content ? extractCodeRefs(apiDoc.content) : [],
  };
}

// ============================================================================
// Selectors (per Design Guidelines - avoid store destructuring)
// ============================================================================

export const useKnowledgeDocuments = () => useKnowledgeStore((s) => s.documents);
export const useKnowledgeTree = () => useKnowledgeStore((s) => s.tree);
export const useKnowledgeSelectedPath = () => useKnowledgeStore((s) => s.selectedPath);
export const useKnowledgeSelectedDocument = () => useKnowledgeStore((s) => s.selectedDocument);
export const useKnowledgeFilters = () => useKnowledgeStore((s) => s.filters);
export const useKnowledgeIsLoading = () => useKnowledgeStore((s) => s.isLoading);
export const useKnowledgeIsInitialized = () => useKnowledgeStore((s) => s.isInitialized);
export const useKnowledgeError = () => useKnowledgeStore((s) => s.error);
export const useKnowledgeExpandedFolders = () => useKnowledgeStore((s) => s.expandedFolders);

// Action selectors (stable references)
export const useKnowledgeActions = () => useKnowledgeStore((s) => ({
  initialize: s.initialize,
  initializeKnowledgeFolder: s.initializeKnowledgeFolder,
  loadDocuments: s.loadDocuments,
  selectDocument: s.selectDocument,
  refreshDocument: s.refreshDocument,
  setSearchQuery: s.setSearchQuery,
  setTypeFilter: s.setTypeFilter,
  setStatusFilter: s.setStatusFilter,
  setModuleFilter: s.setModuleFilter,
  resetFilters: s.resetFilters,
  toggleFolder: s.toggleFolder,
  expandAllFolders: s.expandAllFolders,
  collapseAllFolders: s.collapseAllFolders,
  getFilteredDocuments: s.getFilteredDocuments,
  getDocumentsByType: s.getDocumentsByType,
  searchDocuments: s.searchDocuments,
}));

// ============================================================================
// Store Implementation
// ============================================================================

export const useKnowledgeStore = create<KnowledgeStore>()((set, get) => ({
  // Initial state
  basePath: null,
  projectPath: null,
  documents: new Map(),
  tree: [],

  selectedPath: null,
  selectedDocument: null,

  filters: { ...DEFAULT_FILTERS },

  isLoading: false,
  isInitialized: false,
  error: null,
  expandedFolders: new Set(["business-logic", "api", "patterns", "database", "modules"]),

  // ==========================================================================
  // Initialization
  // ==========================================================================

  initialize: async (projectPath: string) => {
    set({ isLoading: true, error: null, projectPath });

    try {
      // Check if knowledge documents exist via REST API
      const res = await fetch(
        `${API_BASE}?projectPath=${encodeURIComponent(projectPath)}&limit=1`
      );

      if (res.ok) {
        const knowledgePath = `${projectPath}/.sidstack/knowledge`;
        set({ basePath: knowledgePath, isInitialized: true });
        await get().loadDocuments();
        return true;
      } else {
        set({
          basePath: null,
          isInitialized: false,
          isLoading: false,
        });
        return false;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to initialize",
        isLoading: false,
      });
      return false;
    }
  },

  initializeKnowledgeFolder: async (projectPath: string) => {
    set({ isLoading: true, error: null });

    try {
      const knowledgePath = `${projectPath}/.sidstack/knowledge`;
      set({
        basePath: knowledgePath,
        projectPath,
        isInitialized: true,
      });

      await get().loadDocuments();
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to initialize knowledge folder",
        isLoading: false,
      });
      return false;
    }
  },

  // ==========================================================================
  // Document Loading (via REST API)
  // ==========================================================================

  loadDocuments: async () => {
    const { projectPath } = get();
    if (!projectPath) return;

    set({ isLoading: true, error: null });

    try {
      const res = await fetch(
        `${API_BASE}?projectPath=${encodeURIComponent(projectPath)}&limit=500`
      );

      if (!res.ok) {
        throw new Error(`Failed to load documents: ${res.status}`);
      }

      const data = await res.json();
      const apiDocs = data.documents || [];

      const documents = new Map<string, KnowledgeDocument>();
      for (const apiDoc of apiDocs) {
        const doc = apiDocToLegacy(apiDoc);
        documents.set(doc.path, doc);
      }

      const tree = buildTree(documents);

      set({
        documents,
        tree,
        isLoading: false,
      });

      // Auto-select _index.md if nothing selected
      if (!get().selectedPath && documents.has("_index.md")) {
        get().selectDocument("_index.md");
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load documents",
        isLoading: false,
      });
    }
  },

  selectDocument: (path: string | null) => {
    const { documents } = get();
    const doc = path ? documents.get(path) || null : null;

    set({
      selectedPath: path,
      selectedDocument: doc,
    });
  },

  refreshDocument: async (path: string) => {
    const { projectPath, documents } = get();
    if (!projectPath) return;

    try {
      // Extract doc ID from path
      const docId = path.replace(/\.md$/, "").replace(/\//g, "-");

      const res = await fetch(
        `${API_BASE}/doc/${encodeURIComponent(docId)}?projectPath=${encodeURIComponent(projectPath)}`
      );

      if (!res.ok) {
        throw new Error(`Failed to refresh document: ${res.status}`);
      }

      const apiDoc = await res.json();
      const doc = apiDocToLegacy(apiDoc);

      const newDocuments = new Map(documents);
      newDocuments.set(path, doc);

      set({
        documents: newDocuments,
        selectedDocument: get().selectedPath === path ? doc : get().selectedDocument,
      });
    } catch (error) {
      console.error(`Failed to refresh ${path}:`, error);
    }
  },

  // ==========================================================================
  // Filters
  // ==========================================================================

  setSearchQuery: (searchQuery: string) => {
    set((state) => ({
      filters: { ...state.filters, searchQuery },
    }));
  },

  setTypeFilter: (type: KnowledgeDocumentType | null) => {
    set((state) => ({
      filters: { ...state.filters, type },
    }));
  },

  setStatusFilter: (status: KnowledgeStatus | null) => {
    set((state) => ({
      filters: { ...state.filters, status },
    }));
  },

  setModuleFilter: (module: string | null) => {
    set((state) => ({
      filters: { ...state.filters, module },
    }));
  },

  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS } });
  },

  // ==========================================================================
  // UI Actions
  // ==========================================================================

  toggleFolder: (path: string) => {
    set((state) => {
      const newExpanded = new Set(state.expandedFolders);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedFolders: newExpanded };
    });
  },

  expandAllFolders: () => {
    const { tree } = get();
    const allPaths = getAllFolderPaths(tree);
    set({ expandedFolders: new Set(allPaths) });
  },

  collapseAllFolders: () => {
    set({ expandedFolders: new Set() });
  },

  // ==========================================================================
  // Computed
  // ==========================================================================

  getFilteredDocuments: () => {
    const { documents, filters } = get();
    const docs = Array.from(documents.values());

    return docs.filter((doc) => {
      // Type filter
      if (filters.type && doc.frontmatter.type !== filters.type) {
        return false;
      }

      // Status filter
      if (filters.status && doc.frontmatter.status !== filters.status) {
        return false;
      }

      // Module filter
      if (filters.module && doc.frontmatter.module !== filters.module) {
        return false;
      }

      // Search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const titleMatch = doc.frontmatter.title?.toLowerCase().includes(query);
        const contentMatch = doc.content.toLowerCase().includes(query);
        const idMatch = doc.frontmatter.id?.toLowerCase().includes(query);

        if (!titleMatch && !contentMatch && !idMatch) {
          return false;
        }
      }

      return true;
    });
  },

  getDocumentsByType: (type: KnowledgeDocumentType) => {
    const { documents } = get();
    return Array.from(documents.values()).filter(
      (doc) => doc.frontmatter.type === type
    );
  },

  searchDocuments: (query: string) => {
    const { documents } = get();
    const lowerQuery = query.toLowerCase();

    return Array.from(documents.values()).filter((doc) => {
      return (
        doc.frontmatter.title?.toLowerCase().includes(lowerQuery) ||
        doc.frontmatter.id?.toLowerCase().includes(lowerQuery) ||
        doc.content.toLowerCase().includes(lowerQuery) ||
        doc.frontmatter.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    });
  },
}));
