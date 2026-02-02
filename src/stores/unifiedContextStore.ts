/**
 * Unified Context Store
 *
 * Manages links between tasks, specs, and knowledge documents.
 * Provides cross-reference navigation and auto-link suggestions.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// =============================================================================
// Types
// =============================================================================

export type SpecType = "change" | "spec" | "module";
export type LinkType = "manual" | "auto" | "suggested" | "referenced";

export interface TaskSpecLink {
  id: string;
  taskId: string;
  specPath: string;
  specType: SpecType;
  linkType: LinkType;
  linkReason?: string;
  createdAt: number;
}

export interface TaskKnowledgeLink {
  id: string;
  taskId: string;
  knowledgePath: string;
  linkType: LinkType;
  linkReason?: string;
  createdAt: number;
}

export interface LinkSuggestion {
  id: string;
  path: string;
  type: "spec" | "knowledge";
  reason: string;
  confidence: number; // 0-1
}

export type NavigationTarget =
  | { type: "spec"; path: string }
  | { type: "knowledge"; path: string }
  | { type: "progress"; taskId?: string }
  | { type: "task"; taskId: string };

// =============================================================================
// API Helpers
// =============================================================================

const API_BASE = "http://localhost:19432/api/context";

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// Store Interface
// =============================================================================

interface UnifiedContextStore {
  // Active context
  activeTaskId: string | null;
  setActiveTask: (taskId: string | null) => void;

  // Links data
  specLinks: TaskSpecLink[];
  knowledgeLinks: TaskKnowledgeLink[];

  // Suggestions
  suggestions: LinkSuggestion[];
  dismissedPaths: Set<string>;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Navigation
  navigationTarget: NavigationTarget | null;
  navigateTo: (target: NavigationTarget) => void;
  clearNavigation: () => void;

  // Link management
  loadLinksForTask: (taskId: string) => Promise<void>;
  linkSpec: (
    taskId: string,
    specPath: string,
    specType: SpecType,
    linkReason?: string
  ) => Promise<TaskSpecLink | null>;
  linkKnowledge: (
    taskId: string,
    knowledgePath: string,
    linkReason?: string
  ) => Promise<TaskKnowledgeLink | null>;
  unlinkSpec: (linkId: string) => Promise<boolean>;
  unlinkKnowledge: (linkId: string) => Promise<boolean>;

  // Suggestions
  loadSuggestions: (taskId: string) => Promise<void>;
  acceptSuggestion: (suggestion: LinkSuggestion) => Promise<void>;
  dismissSuggestion: (suggestion: LinkSuggestion) => Promise<void>;

  // Queries
  getSpecsForTask: (taskId: string) => TaskSpecLink[];
  getKnowledgeForTask: (taskId: string) => TaskKnowledgeLink[];

  // Cross-reference cache (populated on demand)
  specTasksCache: Map<string, string[]>;
  knowledgeTasksCache: Map<string, string[]>;
  loadTasksForSpec: (specPath: string) => Promise<string[]>;
  loadTasksForKnowledge: (knowledgePath: string) => Promise<string[]>;

  // Links fetch cache (when links were last fetched per task)
  linksFetchedAt: Map<string, number>;

  // Reset
  reset: () => void;
}

// =============================================================================
// Store Implementation
// =============================================================================

// Cache TTL in milliseconds (30 seconds)
const LINKS_CACHE_TTL = 30000;

const initialState = {
  activeTaskId: null,
  specLinks: [],
  knowledgeLinks: [],
  suggestions: [],
  dismissedPaths: new Set<string>(),
  isLoading: false,
  error: null,
  navigationTarget: null,
  specTasksCache: new Map<string, string[]>(),
  knowledgeTasksCache: new Map<string, string[]>(),
  // Track when links were last fetched per task
  linksFetchedAt: new Map<string, number>(),
};

export const useUnifiedContextStore = create<UnifiedContextStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // =======================================================================
      // Active Context
      // =======================================================================

      setActiveTask: (taskId) => {
        set({ activeTaskId: taskId });
        if (taskId) {
          get().loadLinksForTask(taskId);
        } else {
          set({ specLinks: [], knowledgeLinks: [], suggestions: [] });
        }
      },

      // =======================================================================
      // Navigation
      // =======================================================================

      navigateTo: (target) => {
        set({ navigationTarget: target });
      },

      clearNavigation: () => {
        set({ navigationTarget: null });
      },

      // =======================================================================
      // Link Management
      // =======================================================================

      loadLinksForTask: async (taskId) => {
        const state = get();
        const now = Date.now();
        const lastFetched = state.linksFetchedAt.get(taskId);

        // Skip if recently fetched (within TTL)
        if (lastFetched && (now - lastFetched) < LINKS_CACHE_TTL) {
          // Links already loaded and fresh - just filter for this task
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const [specRes, knowledgeRes] = await Promise.all([
            fetchApi<{ links: TaskSpecLink[] }>(`/task/${taskId}/specs`),
            fetchApi<{ links: TaskKnowledgeLink[] }>(`/task/${taskId}/knowledge`),
          ]);

          // Update cache timestamp
          const newFetchedAt = new Map(state.linksFetchedAt);
          newFetchedAt.set(taskId, now);

          set({
            specLinks: specRes.links,
            knowledgeLinks: knowledgeRes.links,
            isLoading: false,
            linksFetchedAt: newFetchedAt,
          });
        } catch (error: any) {
          set({
            error: error.message,
            isLoading: false,
          });
        }
      },

      linkSpec: async (taskId, specPath, specType, linkReason) => {
        try {
          const res = await fetchApi<{ link: TaskSpecLink }>("/links/spec", {
            method: "POST",
            body: JSON.stringify({ taskId, specPath, specType, linkType: "manual", linkReason }),
          });

          set((state) => ({
            specLinks: [res.link, ...state.specLinks],
          }));

          return res.link;
        } catch (error: any) {
          set({ error: error.message });
          return null;
        }
      },

      linkKnowledge: async (taskId, knowledgePath, linkReason) => {
        try {
          const res = await fetchApi<{ link: TaskKnowledgeLink }>("/links/knowledge", {
            method: "POST",
            body: JSON.stringify({ taskId, knowledgePath, linkType: "manual", linkReason }),
          });

          set((state) => ({
            knowledgeLinks: [res.link, ...state.knowledgeLinks],
          }));

          return res.link;
        } catch (error: any) {
          set({ error: error.message });
          return null;
        }
      },

      unlinkSpec: async (linkId) => {
        try {
          await fetchApi(`/links/spec/${linkId}`, { method: "DELETE" });

          set((state) => ({
            specLinks: state.specLinks.filter((l) => l.id !== linkId),
          }));

          return true;
        } catch (error: any) {
          set({ error: error.message });
          return false;
        }
      },

      unlinkKnowledge: async (linkId) => {
        try {
          await fetchApi(`/links/knowledge/${linkId}`, { method: "DELETE" });

          set((state) => ({
            knowledgeLinks: state.knowledgeLinks.filter((l) => l.id !== linkId),
          }));

          return true;
        } catch (error: any) {
          set({ error: error.message });
          return false;
        }
      },

      // =======================================================================
      // Suggestions (stub for future implementation)
      // =======================================================================

      loadSuggestions: async (taskId) => {
        const { knowledgeLinks, dismissedPaths } = get();

        try {
          // Fetch task details to extract keywords
          const taskRes = await fetch(`http://localhost:19432/api/tasks/${taskId}`);
          if (!taskRes.ok) {
            set({ suggestions: [] });
            return;
          }
          const task = await taskRes.json();

          // Extract keywords from task title + description
          const text = `${task.title || ''} ${task.description || ''}`;
          const words = text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .split(/\s+/)
            .filter((w: string) => w.length > 2);

          // Remove common stop words
          const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'from', 'with', 'this', 'that', 'will', 'been', 'they', 'than', 'its']);
          const keywords = words.filter((w: string) => !stopWords.has(w)).slice(0, 5);

          if (keywords.length === 0) {
            set({ suggestions: [] });
            return;
          }

          // Search knowledge base using keywords
          const query = keywords.join(' ');
          const searchRes = await fetch(
            `http://localhost:19432/api/knowledge/search?q=${encodeURIComponent(query)}&limit=5&projectPath=${encodeURIComponent(task.projectId || '')}`
          );

          if (!searchRes.ok) {
            set({ suggestions: [] });
            return;
          }

          const searchData = await searchRes.json();
          const results = searchData.results || [];

          // Filter out already-linked and dismissed docs
          const linkedPaths = new Set(knowledgeLinks.filter(l => l.taskId === taskId).map(l => l.knowledgePath));
          const filtered = results.filter((doc: any) =>
            !linkedPaths.has(doc.sourcePath || doc.path || '') &&
            !dismissedPaths.has(doc.sourcePath || doc.path || '')
          );

          // Convert to suggestions
          const suggestions: LinkSuggestion[] = filtered.slice(0, 5).map((doc: any, i: number) => ({
            id: `suggestion-${taskId}-${doc.id || i}`,
            path: doc.sourcePath || doc.path || doc.id,
            type: 'knowledge' as const,
            reason: `Matches keywords: ${keywords.slice(0, 3).join(', ')}`,
            confidence: Math.max(0.3, 1 - (i * 0.15)),
          }));

          set({ suggestions });
        } catch (error) {
          console.error('Failed to load suggestions:', error);
          set({ suggestions: [] });
        }
      },

      acceptSuggestion: async (suggestion) => {
        const { activeTaskId } = get();
        if (!activeTaskId) return;

        if (suggestion.type === "spec") {
          await get().linkSpec(activeTaskId, suggestion.path, "change", suggestion.reason);
        } else {
          await get().linkKnowledge(activeTaskId, suggestion.path, suggestion.reason);
        }

        set((state) => ({
          suggestions: state.suggestions.filter((s) => s.id !== suggestion.id),
        }));
      },

      dismissSuggestion: async (suggestion) => {
        const { activeTaskId, dismissedPaths } = get();
        if (!activeTaskId) return;

        try {
          await fetchApi("/suggestions/dismiss", {
            method: "POST",
            body: JSON.stringify({
              taskId: activeTaskId,
              suggestedPath: suggestion.path,
              suggestionType: suggestion.type,
            }),
          });

          const newDismissed = new Set(dismissedPaths);
          newDismissed.add(suggestion.path);

          set((state) => ({
            suggestions: state.suggestions.filter((s) => s.id !== suggestion.id),
            dismissedPaths: newDismissed,
          }));
        } catch (error: any) {
          set({ error: error.message });
        }
      },

      // =======================================================================
      // Queries
      // =======================================================================

      getSpecsForTask: (taskId) => {
        return get().specLinks.filter((l) => l.taskId === taskId);
      },

      getKnowledgeForTask: (taskId) => {
        return get().knowledgeLinks.filter((l) => l.taskId === taskId);
      },

      // =======================================================================
      // Cross-Reference Cache
      // =======================================================================

      loadTasksForSpec: async (specPath) => {
        const { specTasksCache } = get();

        // Check cache first
        if (specTasksCache.has(specPath)) {
          return specTasksCache.get(specPath)!;
        }

        try {
          const res = await fetchApi<{ taskIds: string[] }>(
            `/spec/tasks?specPath=${encodeURIComponent(specPath)}`
          );

          const newCache = new Map(specTasksCache);
          newCache.set(specPath, res.taskIds);
          set({ specTasksCache: newCache });

          return res.taskIds;
        } catch {
          return [];
        }
      },

      loadTasksForKnowledge: async (knowledgePath) => {
        const { knowledgeTasksCache } = get();

        // Check cache first
        if (knowledgeTasksCache.has(knowledgePath)) {
          return knowledgeTasksCache.get(knowledgePath)!;
        }

        try {
          const res = await fetchApi<{ taskIds: string[] }>(
            `/knowledge/tasks?knowledgePath=${encodeURIComponent(knowledgePath)}`
          );

          const newCache = new Map(knowledgeTasksCache);
          newCache.set(knowledgePath, res.taskIds);
          set({ knowledgeTasksCache: newCache });

          return res.taskIds;
        } catch {
          return [];
        }
      },

      // =======================================================================
      // Reset
      // =======================================================================

      reset: () => {
        set({
          ...initialState,
          dismissedPaths: new Set<string>(),
          specTasksCache: new Map<string, string[]>(),
          knowledgeTasksCache: new Map<string, string[]>(),
          linksFetchedAt: new Map<string, number>(),
        });
      },
    }),
    {
      name: "sidstack-unified-context",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist essential data, not cache
        activeTaskId: state.activeTaskId,
        dismissedPaths: Array.from(state.dismissedPaths),
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<UnifiedContextStore> & {
          dismissedPaths?: string[];
        };
        return {
          ...currentState,
          activeTaskId: persisted?.activeTaskId ?? null,
          dismissedPaths: new Set(persisted?.dismissedPaths ?? []),
        };
      },
    }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectActiveTaskId = (state: UnifiedContextStore) => state.activeTaskId;
export const selectSpecLinks = (state: UnifiedContextStore) => state.specLinks;
export const selectKnowledgeLinks = (state: UnifiedContextStore) => state.knowledgeLinks;
export const selectSuggestions = (state: UnifiedContextStore) => state.suggestions;
export const selectNavigationTarget = (state: UnifiedContextStore) => state.navigationTarget;
export const selectIsLoading = (state: UnifiedContextStore) => state.isLoading;
export const selectError = (state: UnifiedContextStore) => state.error;
