/**
 * Team Store
 *
 * Zustand store for managing agent teams, their state,
 * and recovery events.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { create } from "zustand";

// =============================================================================
// Types
// =============================================================================

export type TeamStatus = "active" | "paused" | "archived";
export type MemberStatus = "active" | "idle" | "failed" | "recovering" | "paused";

export interface TeamMemberConfig {
  id: string;
  role: string;
  specialty?: string;
  agentType: string;
  terminalId?: string;
  claudeSessionId?: string;
  currentTaskId?: string;
  currentSpecId?: string;
  failureCount: number;
  lastFailure?: string;
  recoveredFrom?: string;
}

export interface TeamConfig {
  id: string;
  name: string;
  projectPath: string;
  createdAt: string;
  createdBy: string;
  orchestrator: TeamMemberConfig;
  workers: TeamMemberConfig[];
  autoRecovery: boolean;
  maxRecoveryAttempts: number;
  recoveryDelayMs: number;
  description?: string;
  tags: string[];
}

export interface MemberTaskInfo {
  taskId: string;
  specId?: string;
  phase: string;
  progress: number;
}

export interface MemberState {
  status: MemberStatus;
  terminalId?: string;
  claudeSessionId?: string;
  currentTask?: MemberTaskInfo;
  lastHeartbeat?: string;
}

export interface TerminalSessionInfo {
  memberId: string;
  terminalId: string;
  claudeSessionId?: string;
  cwd: string;
}

export interface SessionInfo {
  savedAt: string;
  terminals: TerminalSessionInfo[];
}

export interface TeamState {
  teamId: string;
  status: TeamStatus;
  lastActive: string;
  members: Record<string, MemberState>;
  activeSpecs: string[];
  sessionInfo?: SessionInfo;
}

export interface TeamData {
  config: TeamConfig;
  state: TeamState;
}

export interface TeamSummary {
  id: string;
  name: string;
  projectPath: string;
  status: TeamStatus;
  memberCount: number;
  lastActive: string;
  autoRecovery: boolean;
}

export interface MemberWithState {
  id: string;
  role: string;
  specialty?: string;
  agentType: string;
  status: MemberStatus;
  terminalId?: string;
  claudeSessionId?: string;
  currentTask?: MemberTaskInfo;
  failureCount: number;
}

export interface RecoveryContext {
  specId?: string;
  taskId?: string;
  phase?: string;
  progress: number;
  completedSteps: string[];
  currentStep?: string;
  artifacts: string[];
  resumeInstructions: string;
}

export interface RecoveryEvent {
  id: string;
  timestamp: string;
  failedMemberId: string;
  failedMemberRole: string;
  replacementMemberId: string;
  reason: string;
  specId?: string;
  taskId?: string;
  recoveryContext?: {
    progress: number;
    artifacts: string[];
    currentStep?: string;
  };
  success: boolean;
}

export interface CreateTeamInput {
  name: string;
  projectPath: string;
  autoRecovery?: boolean;
  maxRecoveryAttempts?: number;
  members?: { role: string; agentType: string }[];
  description?: string;
}

// =============================================================================
// Store State
// =============================================================================

interface TeamStoreState {
  // Data
  teams: TeamSummary[];
  activeTeam: TeamData | null;
  teamMembers: MemberWithState[];
  recoveryHistory: RecoveryEvent[];

  // UI State
  isLoading: boolean;
  error: string | null;
  currentProjectPath: string | null;

  // Actions
  setProjectPath: (path: string) => void;
  loadTeams: (projectPath?: string, status?: TeamStatus) => Promise<void>;
  loadTeam: (teamId: string) => Promise<void>;
  loadMembers: (teamId: string) => Promise<void>;
  loadRecoveryHistory: (teamId: string, limit?: number) => Promise<void>;

  createTeam: (input: CreateTeamInput) => Promise<TeamData>;
  updateTeam: (teamId: string, updates: { name?: string; autoRecovery?: boolean; maxRecoveryAttempts?: number }) => Promise<void>;
  archiveTeam: (teamId: string) => Promise<void>;

  addMember: (teamId: string, role: string, agentType: string) => Promise<TeamMemberConfig>;
  removeMember: (teamId: string, memberId: string) => Promise<void>;

  pauseTeam: (teamId: string, terminalSessions?: TerminalSessionInfo[]) => Promise<void>;
  resumeTeam: (teamId: string) => Promise<{ team: TeamData; sessionInfo?: SessionInfo }>;

  recoverMember: (teamId: string, memberId: string, reason?: string) => Promise<TeamMemberConfig>;
  getRecoveryContext: (teamId: string, memberId: string) => Promise<RecoveryContext>;

  // Subscriptions
  subscribeToEvents: () => Promise<UnlistenFn[]>;
  clearError: () => void;
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useTeamStore = create<TeamStoreState>((set, get) => ({
  // Initial state
  teams: [],
  activeTeam: null,
  teamMembers: [],
  recoveryHistory: [],
  isLoading: false,
  error: null,
  currentProjectPath: null,

  setProjectPath: (path: string) => {
    set({ currentProjectPath: path });
  },

  loadTeams: async (projectPath?: string, status?: TeamStatus) => {
    const path = projectPath || get().currentProjectPath;
    if (!path) {
      set({ error: "No project path set" });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const teams = await invoke<TeamSummary[]>("team_list", {
        projectPath: path,
        status: status || null,
      });
      set({ teams, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load teams",
        isLoading: false,
      });
    }
  },

  loadTeam: async (teamId: string) => {
    const path = get().currentProjectPath;
    if (!path) {
      set({ error: "No project path set" });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const team = await invoke<TeamData>("team_get", {
        projectPath: path,
        teamId,
      });
      set({ activeTeam: team, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load team",
        isLoading: false,
      });
    }
  },

  loadMembers: async (teamId: string) => {
    const path = get().currentProjectPath;
    if (!path) {
      set({ error: "No project path set" });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const members = await invoke<MemberWithState[]>("team_get_members", {
        projectPath: path,
        teamId,
      });
      set({ teamMembers: members, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load members",
        isLoading: false,
      });
    }
  },

  loadRecoveryHistory: async (teamId: string, limit = 20) => {
    const path = get().currentProjectPath;
    if (!path) {
      set({ error: "No project path set" });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const history = await invoke<RecoveryEvent[]>("team_get_recovery_history", {
        projectPath: path,
        teamId,
        limit,
      });
      set({ recoveryHistory: history, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load recovery history",
        isLoading: false,
      });
    }
  },

  createTeam: async (input: CreateTeamInput) => {
    set({ isLoading: true, error: null });
    try {
      const team = await invoke<TeamData>("team_create", input as unknown as Record<string, unknown>);
      // Refresh teams list
      await get().loadTeams();
      set({ activeTeam: team, isLoading: false });
      return team;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to create team";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  updateTeam: async (teamId, updates) => {
    const path = get().currentProjectPath;
    if (!path) throw new Error("No project path set");

    set({ isLoading: true, error: null });
    try {
      const team = await invoke<TeamData>("team_update", {
        projectPath: path,
        teamId,
        ...updates,
      });
      set({ activeTeam: team, isLoading: false });
      await get().loadTeams();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to update team";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  archiveTeam: async (teamId: string) => {
    const path = get().currentProjectPath;
    if (!path) throw new Error("No project path set");

    set({ isLoading: true, error: null });
    try {
      await invoke("team_archive", { projectPath: path, teamId });
      set({ activeTeam: null, isLoading: false });
      await get().loadTeams();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to archive team";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  addMember: async (teamId, role, agentType) => {
    const path = get().currentProjectPath;
    if (!path) throw new Error("No project path set");

    set({ isLoading: true, error: null });
    try {
      const member = await invoke<TeamMemberConfig>("team_add_member", {
        projectPath: path,
        teamId,
        role,
        agentType,
      });
      await get().loadTeam(teamId);
      await get().loadMembers(teamId);
      set({ isLoading: false });
      return member;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to add member";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  removeMember: async (teamId, memberId) => {
    const path = get().currentProjectPath;
    if (!path) throw new Error("No project path set");

    set({ isLoading: true, error: null });
    try {
      await invoke("team_remove_member", { projectPath: path, teamId, memberId });
      await get().loadTeam(teamId);
      await get().loadMembers(teamId);
      set({ isLoading: false });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to remove member";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  pauseTeam: async (teamId, terminalSessions = []) => {
    const path = get().currentProjectPath;
    if (!path) throw new Error("No project path set");

    set({ isLoading: true, error: null });
    try {
      await invoke("team_pause", { projectPath: path, teamId, terminalSessions });
      await get().loadTeams();
      set({ activeTeam: null, isLoading: false });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to pause team";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  resumeTeam: async (teamId) => {
    const path = get().currentProjectPath;
    if (!path) throw new Error("No project path set");

    set({ isLoading: true, error: null });
    try {
      const result = await invoke<{ team: TeamData; sessionInfo?: SessionInfo }>("team_resume", {
        projectPath: path,
        teamId,
      });
      set({ activeTeam: result.team, isLoading: false });
      await get().loadTeams();
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to resume team";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  recoverMember: async (teamId, memberId, reason) => {
    const path = get().currentProjectPath;
    if (!path) throw new Error("No project path set");

    set({ isLoading: true, error: null });
    try {
      // Report failure
      await invoke("team_report_member_failure", {
        projectPath: path,
        teamId,
        memberId,
        reason: reason || "Manual recovery triggered",
      });

      // Create replacement
      const replacement = await invoke<TeamMemberConfig>("team_create_replacement", {
        projectPath: path,
        teamId,
        failedMemberId: memberId,
      });

      await get().loadTeam(teamId);
      await get().loadMembers(teamId);
      await get().loadRecoveryHistory(teamId);
      set({ isLoading: false });
      return replacement;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to recover member";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  getRecoveryContext: async (teamId, memberId) => {
    const path = get().currentProjectPath;
    if (!path) throw new Error("No project path set");

    try {
      const context = await invoke<RecoveryContext>("team_get_recovery_context", {
        projectPath: path,
        teamId,
        memberId,
      });
      return context;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to get recovery context";
      throw new Error(msg);
    }
  },

  subscribeToEvents: async () => {
    const unlistenFns: UnlistenFn[] = [];

    // Listen for team state changes
    const unlistenTeamChange = await listen<{ teamId: string; status: TeamStatus }>(
      "team-state-changed",
      (event) => {
        const { teamId, status } = event.payload;
        // Update teams list
        set((state) => ({
          teams: state.teams.map((t) =>
            t.id === teamId ? { ...t, status } : t
          ),
        }));
        // Refresh active team if it's the one that changed
        if (get().activeTeam?.config.id === teamId) {
          get().loadTeam(teamId);
        }
      }
    );
    unlistenFns.push(unlistenTeamChange);

    // Listen for member status changes
    const unlistenMemberChange = await listen<{
      teamId: string;
      memberId: string;
      status: MemberStatus;
    }>("member-status-changed", (event) => {
      const { memberId, status } = event.payload;
      set((state) => ({
        teamMembers: state.teamMembers.map((m) =>
          m.id === memberId ? { ...m, status } : m
        ),
      }));
    });
    unlistenFns.push(unlistenMemberChange);

    // Listen for recovery events
    const unlistenRecovery = await listen<RecoveryEvent>(
      "recovery-event",
      (event) => {
        const recoveryEvent = event.payload;
        set((state) => ({
          recoveryHistory: [recoveryEvent, ...state.recoveryHistory],
        }));
      }
    );
    unlistenFns.push(unlistenRecovery);

    return unlistenFns;
  },

  clearError: () => {
    set({ error: null });
  },
}));

// =============================================================================
// Selectors
// =============================================================================

export const selectActiveTeams = (state: TeamStoreState) =>
  state.teams.filter((t) => t.status === "active");

export const selectPausedTeams = (state: TeamStoreState) =>
  state.teams.filter((t) => t.status === "paused");

export const selectArchivedTeams = (state: TeamStoreState) =>
  state.teams.filter((t) => t.status === "archived");

export const selectTeamById = (teamId: string) => (state: TeamStoreState) =>
  state.teams.find((t) => t.id === teamId);

export const selectActiveMemberCount = (state: TeamStoreState) =>
  state.teamMembers.filter((m) => m.status === "active").length;

export const selectFailedMembers = (state: TeamStoreState) =>
  state.teamMembers.filter((m) => m.status === "failed");
