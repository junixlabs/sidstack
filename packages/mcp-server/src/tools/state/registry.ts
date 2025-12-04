/**
 * Role Registry and Message Queue State
 * Shared state for agent coordination
 */

// ============================================================
// Role Registry - Ensures unique role per agent
// ============================================================

export interface RoleRegistryEntry {
  terminalId: string;
  agentId?: string;
  spawnedAt: string;
  taskId?: string;
}

const roleRegistry: Map<string, RoleRegistryEntry> = new Map();

export function registerRole(role: string, terminalId: string, agentId?: string, taskId?: string): void {
  roleRegistry.set(role, {
    terminalId,
    agentId,
    spawnedAt: new Date().toISOString(),
    taskId,
  });
}

export function unregisterRole(role: string): boolean {
  return roleRegistry.delete(role);
}

export function unregisterRoleByTerminalId(terminalId: string): string | null {
  for (const [role, entry] of roleRegistry.entries()) {
    if (entry.terminalId === terminalId) {
      roleRegistry.delete(role);
      return role;
    }
  }
  return null;
}

export function checkRole(role: string): RoleRegistryEntry | null {
  return roleRegistry.get(role) || null;
}

export function getAllRoles(): Map<string, RoleRegistryEntry> {
  return roleRegistry;
}

// ============================================================
// Message Queue - FIFO processing for orchestrator
// ============================================================

export interface QueuedMessage {
  id: string;
  fromAgent: string;
  fromRole: string;
  content: string;
  timestamp: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'processing' | 'processed';
}

const messageQueue: QueuedMessage[] = [];
const MESSAGE_QUEUE_MAX_SIZE = 100;

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export function detectPriority(content: string): QueuedMessage['priority'] {
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('urgent') || lowerContent.includes('critical')) return 'urgent';
  if (lowerContent.includes('blocker') || lowerContent.includes('blocked')) return 'high';
  if (lowerContent.includes('fyi') || lowerContent.includes('info')) return 'low';
  return 'normal';
}

export function enqueueMessage(message: Omit<QueuedMessage, 'id' | 'status'>): string {
  // Drop oldest pending if queue full
  if (messageQueue.length >= MESSAGE_QUEUE_MAX_SIZE) {
    const oldestPendingIdx = messageQueue.findIndex(m => m.status === 'pending');
    if (oldestPendingIdx >= 0) {
      messageQueue.splice(oldestPendingIdx, 1);
    }
  }

  const id = generateMessageId();
  messageQueue.push({
    ...message,
    id,
    status: 'pending',
  });

  return id;
}

export function getNextPendingMessage(): QueuedMessage | null {
  return messageQueue.find(m => m.status === 'pending') || null;
}

export function markMessageProcessing(id: string): boolean {
  const msg = messageQueue.find(m => m.id === id);
  if (msg && msg.status === 'pending') {
    msg.status = 'processing';
    return true;
  }
  return false;
}

export function markMessageProcessed(id: string): boolean {
  const msg = messageQueue.find(m => m.id === id);
  if (msg) {
    msg.status = 'processed';
    return true;
  }
  return false;
}

export function getPendingMessages(): QueuedMessage[] {
  return messageQueue.filter(m => m.status === 'pending');
}

export function getQueueStats() {
  return {
    total: messageQueue.length,
    pending: messageQueue.filter(m => m.status === 'pending').length,
    processing: messageQueue.filter(m => m.status === 'processing').length,
    processed: messageQueue.filter(m => m.status === 'processed').length,
  };
}

// ============================================================
// Agent Health Metrics - Track agent effectiveness
// ============================================================

export interface AgentHealthMetrics {
  agentId: string;
  role: string;
  totalMessages: number;
  lastMessageTime: Date | null;
  duplicateMessages: number;
  lastMessages: string[];  // Last 5 messages for duplicate detection
  effectivenessScore: number;  // 0-100
}

const agentHealthMap: Map<string, AgentHealthMetrics> = new Map();

export function trackAgentMessage(agentId: string, _terminalId: string, role: string, content: string): void {
  let metrics = agentHealthMap.get(agentId);

  if (!metrics) {
    metrics = {
      agentId,
      role,
      totalMessages: 0,
      lastMessageTime: null,
      duplicateMessages: 0,
      lastMessages: [],
      effectivenessScore: 100,
    };
    agentHealthMap.set(agentId, metrics);
  }

  // Check for duplicate
  const isDuplicate = metrics.lastMessages.includes(content);
  if (isDuplicate) {
    metrics.duplicateMessages++;
    metrics.effectivenessScore = Math.max(0, metrics.effectivenessScore - 10);
  }

  // Update metrics
  metrics.totalMessages++;
  metrics.lastMessageTime = new Date();
  metrics.lastMessages = [content, ...metrics.lastMessages.slice(0, 4)];

  agentHealthMap.set(agentId, metrics);
}

export function getAgentHealthMetrics(agentId: string): AgentHealthMetrics | null {
  return agentHealthMap.get(agentId) || null;
}

export function getAllAgentHealthMetrics(): AgentHealthMetrics[] {
  return Array.from(agentHealthMap.values());
}

export function clearAgentHealthMetrics(agentId: string): void {
  agentHealthMap.delete(agentId);
}
