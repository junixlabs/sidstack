/**
 * Team IPC Client for Agent Manager
 *
 * Connects to the Agent Manager Tauri app via WebSocket IPC
 * to manage agent teams programmatically.
 */

import WebSocket from 'ws';

const IPC_URL = 'ws://127.0.0.1:17432';
const REQUEST_TIMEOUT = 10000; // 10 seconds

interface IpcRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface IpcResponse {
  id: string;
  status: 'success' | 'error';
  data?: unknown;
  message?: string;
  code?: string;
}

// Team types
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

export interface TeamState {
  teamId: string;
  status: 'active' | 'paused' | 'archived';
  lastActive: string;
  members: Record<string, MemberState>;
  activeSpecs: string[];
  sessionInfo?: SessionInfo;
}

export interface MemberState {
  status: 'active' | 'idle' | 'failed' | 'recovering' | 'paused';
  terminalId?: string;
  claudeSessionId?: string;
  currentTask?: MemberTaskInfo;
  lastHeartbeat?: string;
}

export interface MemberTaskInfo {
  taskId: string;
  specId?: string;
  phase: string;
  progress: number;
}

export interface SessionInfo {
  savedAt: string;
  terminals: TerminalSessionInfo[];
}

export interface TerminalSessionInfo {
  memberId: string;
  terminalId: string;
  claudeSessionId?: string;
  cwd: string;
}

export interface TeamData {
  config: TeamConfig;
  state: TeamState;
}

export interface TeamSummary {
  id: string;
  name: string;
  projectPath: string;
  status: 'active' | 'paused' | 'archived';
  memberCount: number;
  lastActive: string;
  autoRecovery: boolean;
}

export interface MemberWithState {
  id: string;
  role: string;
  specialty?: string;
  agentType: string;
  status: 'active' | 'idle' | 'failed' | 'recovering' | 'paused';
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

export interface ResumeTeamResult {
  team: TeamData;
  sessionInfo?: SessionInfo;
}

/**
 * WebSocket client singleton with request/response correlation
 */
class TeamIpcClient {
  private ws: WebSocket | null = null;
  private pendingRequests: Map<string, {
    resolve: (value: IpcResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private connecting: Promise<void> | null = null;
  private messageCounter = 0;

  /**
   * Ensure WebSocket connection is established
   */
  private async ensureConnected(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = new Promise<void>((resolve, reject) => {
      if (this.ws) {
        this.ws.removeAllListeners();
        this.ws.close();
        this.ws = null;
      }

      const ws = new WebSocket(IPC_URL);

      const connectTimeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection to Agent Manager timed out. Is the Agent Manager app running?'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(connectTimeout);
        this.ws = ws;
        this.connecting = null;
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(connectTimeout);
        this.connecting = null;
        reject(new Error(`Failed to connect to Agent Manager: ${error.message}`));
      });

      ws.on('close', () => {
        this.ws = null;
        for (const [_id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();
      });

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString()) as IpcResponse;
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(response.id);
            pending.resolve(response);
          }
        } catch {
          // Ignore non-JSON messages
        }
      });
    });

    return this.connecting;
  }

  /**
   * Send a request and wait for response
   */
  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    await this.ensureConnected();

    const id = `team-${++this.messageCounter}-${Date.now()}`;
    const request: IpcRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, REQUEST_TIMEOUT);

      this.pendingRequests.set(id, {
        resolve: (response) => {
          if (response.status === 'success') {
            resolve(response.data);
          } else {
            reject(new Error(response.message || 'Unknown error'));
          }
        },
        reject,
        timeout,
      });

      this.ws?.send(JSON.stringify(request));
    });
  }
}

// Singleton instance
const client = new TeamIpcClient();

// ===== Team CRUD Operations =====

export async function createTeam(input: CreateTeamInput): Promise<TeamData> {
  const result = await client.request('team_create', input as unknown as Record<string, unknown>);
  return result as TeamData;
}

export async function listTeams(projectPath: string, status?: string): Promise<TeamSummary[]> {
  const result = await client.request('team_list', { projectPath, status });
  return result as TeamSummary[];
}

export async function getTeam(projectPath: string, teamId: string): Promise<TeamData> {
  const result = await client.request('team_get', { projectPath, teamId });
  return result as TeamData;
}

export async function updateTeam(
  projectPath: string,
  teamId: string,
  updates: {
    name?: string;
    autoRecovery?: boolean;
    maxRecoveryAttempts?: number;
  }
): Promise<TeamData> {
  const result = await client.request('team_update', { projectPath, teamId, ...updates });
  return result as TeamData;
}

export async function archiveTeam(projectPath: string, teamId: string): Promise<void> {
  await client.request('team_archive', { projectPath, teamId });
}

// ===== Member Operations =====

export async function addMember(
  projectPath: string,
  teamId: string,
  role: string,
  agentType: string
): Promise<TeamMemberConfig> {
  const result = await client.request('team_add_member', { projectPath, teamId, role, agentType });
  return result as TeamMemberConfig;
}

export async function removeMember(
  projectPath: string,
  teamId: string,
  memberId: string
): Promise<void> {
  await client.request('team_remove_member', { projectPath, teamId, memberId });
}

export async function updateMemberSession(
  projectPath: string,
  teamId: string,
  memberId: string,
  terminalId?: string,
  claudeSessionId?: string
): Promise<void> {
  await client.request('team_update_member_session', {
    projectPath, teamId, memberId, terminalId, claudeSessionId
  });
}

export async function updateMemberStatus(
  projectPath: string,
  teamId: string,
  memberId: string,
  status: string
): Promise<void> {
  await client.request('team_update_member_status', { projectPath, teamId, memberId, status });
}

export async function updateMemberTask(
  projectPath: string,
  teamId: string,
  memberId: string,
  taskId?: string,
  specId?: string,
  phase?: string,
  progress?: number
): Promise<void> {
  await client.request('team_update_member_task', {
    projectPath, teamId, memberId, taskId, specId, phase, progress
  });
}

export async function getMembers(
  projectPath: string,
  teamId: string
): Promise<MemberWithState[]> {
  const result = await client.request('team_get_members', { projectPath, teamId });
  return result as MemberWithState[];
}

// ===== Team Lifecycle =====

export async function pauseTeam(
  projectPath: string,
  teamId: string,
  terminalSessions: TerminalSessionInfo[]
): Promise<void> {
  await client.request('team_pause', { projectPath, teamId, terminalSessions });
}

export async function resumeTeam(
  projectPath: string,
  teamId: string
): Promise<ResumeTeamResult> {
  const result = await client.request('team_resume', { projectPath, teamId });
  return result as ResumeTeamResult;
}

// ===== Recovery Operations =====

export async function reportMemberFailure(
  projectPath: string,
  teamId: string,
  memberId: string,
  reason: string
): Promise<void> {
  await client.request('team_report_member_failure', { projectPath, teamId, memberId, reason });
}

export async function createReplacement(
  projectPath: string,
  teamId: string,
  failedMemberId: string
): Promise<TeamMemberConfig> {
  const result = await client.request('team_create_replacement', {
    projectPath, teamId, failedMemberId
  });
  return result as TeamMemberConfig;
}

export async function getRecoveryContext(
  projectPath: string,
  teamId: string,
  memberId: string
): Promise<RecoveryContext> {
  const result = await client.request('team_get_recovery_context', {
    projectPath, teamId, memberId
  });
  return result as RecoveryContext;
}

export async function getRecoveryHistory(
  projectPath: string,
  teamId: string,
  limit?: number
): Promise<RecoveryEvent[]> {
  const result = await client.request('team_get_recovery_history', {
    projectPath, teamId, limit
  });
  return result as RecoveryEvent[];
}

export async function memberHeartbeat(
  projectPath: string,
  teamId: string,
  memberId: string
): Promise<void> {
  await client.request('team_member_heartbeat', { projectPath, teamId, memberId });
}
