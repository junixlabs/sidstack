/**
 * Knowledge Store - UI state only
 *
 * Manages selection, filters, and expand/collapse state for the knowledge browser.
 * Server data is fetched directly by components or via TanStack Query.
 */

import { create } from "zustand";

import type {
  KnowledgeDocumentType,
  KnowledgeStatus,
} from "@/types/knowledge";

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
  // Selection
  selectedPath: string | null;

  // Filters
  filters: KnowledgeFilters;

  // UI State
  expandedFolders: Set<string>;

  // Actions - Selection
  selectDocument: (path: string | null) => void;

  // Actions - Filters
  setSearchQuery: (query: string) => void;
  setTypeFilter: (type: KnowledgeDocumentType | null) => void;
  setStatusFilter: (status: KnowledgeStatus | null) => void;
  setModuleFilter: (module: string | null) => void;
  resetFilters: () => void;

  // Actions - UI
  toggleFolder: (path: string) => void;
  expandAllFolders: (paths: string[]) => void;
  collapseAllFolders: () => void;
}

const DEFAULT_FILTERS: KnowledgeFilters = {
  type: null,
  status: null,
  module: null,
  searchQuery: "",
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useKnowledgeStore = create<KnowledgeStore>()((set) => ({
  // Initial state
  selectedPath: null,
  filters: { ...DEFAULT_FILTERS },
  expandedFolders: new Set(["00-context", "01-architecture", "02-decisions", "03-standards", "04-data", "05-api", "06-operations", "07-projects", "08-incidents"]),

  // Selection
  selectDocument: (path: string | null) => {
    set({ selectedPath: path });
  },

  // Filters
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

  // UI Actions
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

  expandAllFolders: (paths: string[]) => {
    set({ expandedFolders: new Set(paths) });
  },

  collapseAllFolders: () => {
    set({ expandedFolders: new Set() });
  },
}));
