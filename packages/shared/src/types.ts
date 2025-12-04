// Project Types
export interface Project {
  id: string;
  name: string;
  path: string;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
}

export enum ProjectStatus {
  Active = 'active',
  Archived = 'archived',
}

// Feature Types
export interface Feature {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  description: string;
  status: FeatureStatus;
  version?: string;
  createdAt: number;
  updatedAt: number;
  releasedAt?: number;
}

export enum FeatureStatus {
  Planned = 'planned',
  InProgress = 'in_progress',
  Testing = 'testing',
  Released = 'released',
  Deprecated = 'deprecated',
}

// Agent Types

/** Core agent roles aligned with governance model (3 roles) */
export type AgentRole = "orchestrator" | "worker" | "reviewer";

/** Optional specialty for worker agents */
export type WorkerSpecialty = "frontend" | "backend" | "database" | "devops" | "qa" | "docs" | string;

/** All valid agent roles */
export const AGENT_ROLES = ["orchestrator", "worker", "reviewer"] as const;

/** Normalize legacy role strings to the 3-role model */
export function normalizeRole(role: string): AgentRole {
  const r = role.toLowerCase();
  if (r === "orchestrator") return "orchestrator";
  if (r === "review" || r === "reviewer") return "reviewer";
  return "worker";
}

/** Extract specialty from legacy role strings (e.g. "frontend" -> "frontend") */
export function extractSpecialty(role: string): string | undefined {
  const r = role.toLowerCase();
  if (r === "orchestrator" || r === "worker" || r === "reviewer" || r === "review") return undefined;
  return r;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  specialty?: WorkerSpecialty;
  status: AgentStatus;
  capabilities: string[];
  config: Record<string, unknown>;
  createdAt: number;
  lastActive?: number;
  projectId?: string;
}

export enum AgentStatus {
  Idle = 'idle',
  Busy = 'busy',
  Error = 'error',
  Offline = 'offline',
}

// Task Types
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignedTo?: string;
  createdAt: number;
  completedAt?: number;
  priority: number;
  metadata: Record<string, unknown>;
  projectId?: string;
  featureId?: string;
}

export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

// Message Types
export interface Message {
  id: string;
  content: string;
  role: MessageRole;
  senderId: string;
  timestamp: number;
  sessionId: string;
  parentMessageId?: string;
  embeddingId?: string;
  tags: string[];
}

export type MessageRole = 'user' | 'assistant' | 'system';

// Session Types
export interface Session {
  id: string;
  projectId: string;
  startedAt: number;
  endedAt?: number;
  messageCount: number;
  summary?: string;
}

// Search Types
export interface SearchResult {
  id: string;
  score: float;
  content: string;
  metadata: Record<string, unknown>;
}

type float = number;

