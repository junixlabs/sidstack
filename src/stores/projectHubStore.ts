/**
 * Project Intelligence Hub Store
 *
 * Capability-centric state management for the Project Hub.
 * Manages capability tree, selected capability, connected entities, and context bar.
 */

import { create } from 'zustand';
import type { CapabilityDefinition, CapabilityNode, CapabilityRegistryStats, CapabilityRequirement, EnrichedRequirement } from '@sidstack/shared';

// ============================================================================
// Types
// ============================================================================

export interface ConnectedEntity {
  type: string;       // 'task' | 'session' | 'knowledge' | 'capability'
  id: string;
  title: string;
  status?: string;
  relationshipType?: string; // 'enables' | 'dependsOn' | 'feedsInto'
}

export interface ConnectedEntities {
  tasks: ConnectedEntity[];
  sessions: ConnectedEntity[];
  knowledge: ConnectedEntity[];
  capabilities: ConnectedEntity[];
}

export interface HubContextBar {
  activeTasks: number;
  runningSessions: number;
  branch?: string;
}

export type HubViewMode = 'detail' | 'goals';

export interface ProjectGoalsSubGoal {
  capability: CapabilityDefinition;
  score: number;
  goal: string;
  requirementCount: number;
  completedCount: number;
}

export interface ProjectGoalsDomain {
  domain: CapabilityDefinition;
  score: number;
  subGoals: ProjectGoalsSubGoal[];
}

export interface ProjectGoalsData {
  overallScore: number;
  domains: ProjectGoalsDomain[];
}

interface ProjectHubState {
  // Current project context
  projectPath: string;

  // Capability tree (resolved hierarchy)
  capabilityTree: CapabilityNode[];
  capabilityStats: CapabilityRegistryStats | null;

  // Selection
  selectedCapabilityId: string | null;
  selectedCapability: CapabilityDefinition | null;

  // Navigator state
  expandedGroups: Set<string>;   // L0 IDs that are expanded
  searchQuery: string;

  // Connected entities for selected capability
  connectedEntities: ConnectedEntities | null;

  // View mode
  viewMode: HubViewMode;

  // Project Goals (aggregated from capability tree)
  projectGoalsData: ProjectGoalsData | null;

  // Context bar
  contextBar: HubContextBar;

  // Loading
  isLoading: boolean;
  isLoadingConnected: boolean;
  error: string | null;

  // Actions
  setProjectContext: (projectPath: string) => void;
  fetchCapabilityTree: (projectPath: string) => Promise<void>;
  selectCapability: (capabilityId: string | null) => void;
  toggleGroup: (groupId: string) => void;
  setSearchQuery: (query: string) => void;
  fetchConnectedEntities: (capabilityId: string) => Promise<void>;
  fetchContextBar: (projectId: string) => Promise<void>;
  setViewMode: (mode: HubViewMode) => void;
  computeProjectGoals: () => void;
}

const API_BASE = 'http://localhost:19432';

// ============================================================================
// Store
// ============================================================================

export const useProjectHubStore = create<ProjectHubState>((set, get) => ({
  projectPath: '',
  capabilityTree: [],
  capabilityStats: null,
  selectedCapabilityId: null,
  selectedCapability: null,
  expandedGroups: new Set<string>(),
  searchQuery: '',
  connectedEntities: null,
  viewMode: 'detail',
  projectGoalsData: null,
  contextBar: { activeTasks: 0, runningSessions: 0 },
  isLoading: false,
  isLoadingConnected: false,
  error: null,

  setProjectContext: (projectPath) => {
    const currentPath = get().projectPath;
    if (currentPath === projectPath) return;

    // Reset all state for the new workspace
    set({
      projectPath,
      capabilityTree: [],
      capabilityStats: null,
      selectedCapabilityId: null,
      selectedCapability: null,
      expandedGroups: new Set<string>(),
      searchQuery: '',
      connectedEntities: null,
      projectGoalsData: null,
      contextBar: { activeTasks: 0, runningSessions: 0 },
      isLoading: false,
      isLoadingConnected: false,
      error: null,
    });

    // Fetch data for the new workspace
    get().fetchCapabilityTree(projectPath);
    const projectId = projectPath.split('/').pop() || 'default';
    get().fetchContextBar(projectId);
  },

  fetchCapabilityTree: async (projectPath) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(
        `${API_BASE}/api/capabilities/hierarchy?projectPath=${encodeURIComponent(projectPath)}`,
      );
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      const tree: CapabilityNode[] = data.tree || [];
      const stats: CapabilityRegistryStats = data.stats || null;

      // Auto-expand all L0 groups on first load
      const { expandedGroups, selectedCapabilityId } = get();
      if (expandedGroups.size === 0) {
        const allL0Ids = new Set(tree.map(node => node.capability.id));
        set({ capabilityTree: tree, capabilityStats: stats, expandedGroups: allL0Ids, isLoading: false });
      } else {
        set({ capabilityTree: tree, capabilityStats: stats, isLoading: false });
      }

      // Clear selection if capability no longer exists in the new tree
      if (selectedCapabilityId && tree.length > 0) {
        let found = false;
        function find(nodes: CapabilityNode[]) {
          for (const node of nodes) {
            if (node.capability.id === selectedCapabilityId) { found = true; return; }
            find(node.children);
          }
        }
        find(tree);
        if (!found) {
          set({ selectedCapabilityId: null, selectedCapability: null, connectedEntities: null });
        }
      } else if (selectedCapabilityId && tree.length === 0) {
        // Tree is empty — clear stale selection
        set({ selectedCapabilityId: null, selectedCapability: null, connectedEntities: null });
      }

      // Compute project goals data from the new tree
      get().computeProjectGoals();
    } catch (err: any) {
      console.error('[ProjectHub] Failed to fetch capability tree:', err);
      set({ error: err.message || 'Failed to load capabilities', isLoading: false });
    }
  },

  selectCapability: (capabilityId) => {
    if (!capabilityId) {
      set({ selectedCapabilityId: null, selectedCapability: null, connectedEntities: null });
      return;
    }

    // Find capability in tree
    const { capabilityTree } = get();
    let found: CapabilityDefinition | null = null;
    function find(nodes: CapabilityNode[]) {
      for (const node of nodes) {
        if (node.capability.id === capabilityId) {
          found = node.capability;
          return;
        }
        find(node.children);
      }
    }
    find(capabilityTree);

    set({ selectedCapabilityId: capabilityId, selectedCapability: found, connectedEntities: null });
    if (capabilityId) {
      get().fetchConnectedEntities(capabilityId);
    }
  },

  toggleGroup: (groupId) => {
    set((state) => {
      const next = new Set(state.expandedGroups);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return { expandedGroups: next };
    });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  fetchConnectedEntities: async (_capabilityId) => {
    set({ isLoadingConnected: true });
    try {
      const connected: ConnectedEntities = {
        tasks: [],
        sessions: [],
        knowledge: [],
        capabilities: [],
      };

      // Query linked work items by moduleId from capability's modules field
      const { selectedCapability, projectPath } = get();
      const moduleIds = selectedCapability?.modules || [];
      const projectId = projectPath.split('/').pop() || 'default';

      if (moduleIds.length > 0) {
        const moduleId = moduleIds[0]; // Primary module

        const [tasksRes, sessionsRes, knowledgeRes] = await Promise.all([
          fetch(`${API_BASE}/api/tasks?projectId=${encodeURIComponent(projectId)}&moduleId=${encodeURIComponent(moduleId)}`).catch(() => null),
          fetch(`${API_BASE}/api/sessions/by-module/${encodeURIComponent(moduleId)}`).catch(() => null),
          fetch(`${API_BASE}/api/knowledge?projectPath=${encodeURIComponent(projectPath)}&module=${encodeURIComponent(moduleId)}`).catch(() => null),
        ]);

        if (tasksRes?.ok) {
          const data = await tasksRes.json();
          connected.tasks = (data.tasks || []).map((t: any) => ({
            type: 'task',
            id: t.id,
            title: t.title,
            status: t.status,
          }));
        }
        if (sessionsRes?.ok) {
          const data = await sessionsRes.json();
          connected.sessions = (data.sessions || []).map((s: any) => ({
            type: 'session',
            id: s.id,
            title: s.prompt || `Session ${s.id.slice(0, 8)}`,
            status: s.status,
          }));
        }
        if (knowledgeRes?.ok) {
          const data = await knowledgeRes.json();
          connected.knowledge = (data.documents || []).map((d: any) => ({
            type: 'knowledge',
            id: d.id,
            title: d.title,
            status: d.type,
          }));
        }
      }

      // Add capability relationships from the selected capability itself
      if (selectedCapability?.relationships) {
        const rels = selectedCapability.relationships;
        const addCapRel = (ids: string[] | undefined, relType: string) => {
          if (!ids) return;
          for (const id of ids) {
            connected.capabilities.push({
              type: 'capability',
              id,
              title: id,
              relationshipType: relType,
            });
          }
        };
        addCapRel(rels.enables, 'enables');
        addCapRel(rels.dependsOn, 'depends_on');
        addCapRel(rels.feedsInto, 'feeds_into');
      }

      set({ connectedEntities: connected, isLoadingConnected: false });
    } catch {
      set({ connectedEntities: { tasks: [], sessions: [], knowledge: [], capabilities: [] }, isLoadingConnected: false });
    }
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
  },

  computeProjectGoals: () => {
    const { capabilityTree } = get();
    if (capabilityTree.length === 0) {
      set({ projectGoalsData: null });
      return;
    }

    const domains: ProjectGoalsDomain[] = capabilityTree.map((l0Node) => {
      const subGoals: ProjectGoalsSubGoal[] = l0Node.children.map((l1Node) => {
        const cap = l1Node.capability;
        const reqs = cap.requirements || [];
        const score = computeCapScore(reqs);
        const purpose = typeof cap.purpose === 'string' ? cap.purpose : cap.purpose?.objective || cap.purpose?.description || '';
        const completedCount = reqs.filter((r) => {
          const e = normalizeReq(r);
          return e.status === 'done';
        }).length;

        return {
          capability: cap,
          score,
          goal: purpose,
          requirementCount: reqs.length,
          completedCount,
        };
      });

      const domainScore = subGoals.length > 0
        ? Math.round(subGoals.reduce((sum, sg) => sum + sg.score, 0) / subGoals.length)
        : 0;

      return {
        domain: l0Node.capability,
        score: domainScore,
        subGoals,
      };
    });

    const overallScore = domains.length > 0
      ? Math.round(domains.reduce((sum, d) => sum + d.score, 0) / domains.length)
      : 0;

    set({ projectGoalsData: { overallScore, domains } });
  },

  fetchContextBar: async (projectId) => {
    try {
      const [tasksRes, sessionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/tasks?projectId=${encodeURIComponent(projectId)}&status=in_progress`),
        fetch(`${API_BASE}/api/sessions/query/active`),
      ]);
      const tasksData = await tasksRes.json();
      const sessionsData = await sessionsRes.json();
      set({
        contextBar: {
          activeTasks: tasksData.tasks?.length || 0,
          runningSessions: sessionsData.sessions?.length || 0,
        },
      });
    } catch {
      // Silent fail
    }
  },
}));

// ============================================================================
// Helpers (outside store)
// ============================================================================

function normalizeReq(req: CapabilityRequirement): EnrichedRequirement {
  if (typeof req === 'string') {
    return { description: req };
  }
  return req;
}

function computeCapScore(requirements: CapabilityRequirement[]): number {
  if (!requirements || requirements.length === 0) return 0;
  let totalScore = 0;
  for (const req of requirements) {
    const enriched = normalizeReq(req);
    if (enriched.status === 'done') {
      totalScore += 100;
    } else if (enriched.completeness !== undefined) {
      totalScore += enriched.completeness;
    } else if (enriched.status === 'in-progress') {
      totalScore += 50;
    }
  }
  return Math.round(totalScore / requirements.length);
}
